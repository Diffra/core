import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEFAULT_OUTPUT_DIR } from '../config/schema.js';
import type {
  DiffraConfig,
  ImageArtifact,
  TestRunReport,
} from '../types/index.js';

export const REPORT_FILE = 'report.json';
export const BUNDLE_INDEX_FILE = 'index.html';
export const IMAGES_DIR = 'images';
export const LEDGERS_DIR = 'ledgers';
export const VIEWER_SCRIPT_FILE = 'viewer.bundle.js';
export const VIEWER_STYLES_FILE = 'viewer.css';
export const RUNS_DIR = 'runs';

/** Directory that holds the viewer files, overriding automatic discovery. */
export const VIEWER_DIR_ENV = 'DIFFRA_VIEWER_DIR';

/** Where run output (reports, images, local baselines) is written. */
/**
 * Reads a file of a review bundle. A path that leaves the bundle is refused,
 * whether by `..` or by a symbolic link that points elsewhere.
 */
export async function readFileWithin(
  root: string,
  relative: string,
): Promise<Buffer> {
  const base = await fs.realpath(path.resolve(root));
  const inside = (file: string) => file.startsWith(base + path.sep);
  const resolved = path.resolve(base, relative);
  if (!inside(resolved)) {
    throw new Error(`File leaves the review bundle: ${relative}`);
  }
  const real = await fs.realpath(resolved);
  if (!inside(real)) {
    throw new Error(`File leaves the review bundle: ${relative}`);
  }
  return fs.readFile(real);
}

export function resolveOutputDir(config: DiffraConfig, cwd: string): string {
  const storage = config.storage;
  const configured =
    typeof storage === 'object' && storage !== null && 'outputDir' in storage
      ? storage.outputDir
      : undefined;
  return path.resolve(cwd, configured || DEFAULT_OUTPUT_DIR);
}

export function runDirectory(outputDir: string, runId: string): string {
  return path.join(outputDir, RUNS_DIR, runId);
}

interface ViewerFiles {
  script: string;
  styles: string;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds the built review interface. In order: DIFFRA_VIEWER_DIR, a `viewer`
 * folder next to the running script (how the GitHub Action ships it), and the
 * installed @diffra/viewer package.
 */
export async function findViewerFiles(): Promise<ViewerFiles | undefined> {
  const candidates: Array<() => ViewerFiles | undefined> = [
    () => {
      const dir = process.env[VIEWER_DIR_ENV];
      return dir
        ? {
            script: path.join(dir, VIEWER_SCRIPT_FILE),
            styles: path.join(dir, VIEWER_STYLES_FILE),
          }
        : undefined;
    },
    () => {
      const dir = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'viewer',
      );
      return {
        script: path.join(dir, VIEWER_SCRIPT_FILE),
        styles: path.join(dir, VIEWER_STYLES_FILE),
      };
    },
    () => {
      try {
        const require = createRequire(import.meta.url);
        return {
          script: require.resolve('@diffra/viewer/bundle'),
          styles: require.resolve('@diffra/viewer/style.css'),
        };
      } catch {
        return undefined;
      }
    },
  ];

  for (const candidate of candidates) {
    const files = candidate();
    if (files && (await exists(files.script)) && (await exists(files.styles))) {
      return files;
    }
  }
  return undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Written as character codes: a literal U+2028 or U+2029 would be a line
// terminator inside the source file itself.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** Serialises JSON so it is safe inside a script element. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replaceAll(LINE_SEPARATOR, '\\u2028')
    .replaceAll(PARAGRAPH_SEPARATOR, '\\u2029');
}

function renderIndexHtml(report: TestRunReport): string {
  const branch = report.git?.branch ?? 'unknown branch';
  const commit = report.git?.commit?.slice(0, 7) ?? '';
  const title = escapeHtml(`Diffra review: ${branch} ${commit}`.trim());
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${VIEWER_STYLES_FILE}" />
</head>
<body>
  <div id="root"></div>
  <script id="diffra-data" type="application/json">${jsonForScript(report)}</script>
  <script src="${VIEWER_SCRIPT_FILE}"></script>
</body>
</html>
`;
}

/**
 * The report as it is shared in a bundle. Storage locations (`path`) can be
 * local file paths or private object store addresses, are never loaded by the
 * review interface, and would leak where the run happened, so they are left out.
 */
function forSharing(report: TestRunReport): TestRunReport {
  const publicParts = (image: ImageArtifact | undefined) =>
    image && { hash: image.hash, url: image.url };
  return {
    ...report,
    results: report.results.map((result) => ({
      ...result,
      candidate: publicParts(result.candidate) ?? {},
      baseline: publicParts(result.baseline),
      diffImage: publicParts(result.diffImage),
    })),
  };
}

/**
 * Collects everything needed to review one run into a single static directory.
 * See docs/architecture/review-bundle.md.
 */
export class ReviewBundle {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  /** Stores an image by content hash and returns its URL relative to the bundle. */
  async addImage(image: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256').update(image).digest('hex');
    const relative = `${IMAGES_DIR}/${hash}.png`;
    const target = path.join(this.dir, relative);
    if (!(await exists(target))) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, image);
    }
    return relative;
  }

  /** Stores a ledger by content hash and returns its URL relative to the bundle. */
  async addLedger(content: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const relative = `${LEDGERS_DIR}/${hash}.json`;
    const target = path.join(this.dir, relative);
    if (!(await exists(target))) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    }
    return relative;
  }

  /** Writes the report, the review page, and the viewer files. */
  async finalize(fullReport: TestRunReport): Promise<void> {
    const report = forSharing(fullReport);
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(
      path.join(this.dir, REPORT_FILE),
      JSON.stringify(report, null, 2),
      'utf-8',
    );

    const viewer = await findViewerFiles();
    if (!viewer) {
      console.warn(
        `[diffra] Warning: the review interface was not found, so ${BUNDLE_INDEX_FILE} was not written. Set ${VIEWER_DIR_ENV} or install @diffra/viewer.`,
      );
      return;
    }
    await fs.copyFile(viewer.script, path.join(this.dir, VIEWER_SCRIPT_FILE));
    await fs.copyFile(viewer.styles, path.join(this.dir, VIEWER_STYLES_FILE));
    await fs.writeFile(
      path.join(this.dir, BUNDLE_INDEX_FILE),
      renderIndexHtml(report),
      'utf-8',
    );
  }
}

/** The address reviewers open: hosted when configured, otherwise the local file. */
export function reviewUrl(options: {
  reportBaseUrl?: string;
  runId: string;
  bundleDir: string;
}): string {
  const { reportBaseUrl, runId, bundleDir } = options;
  if (reportBaseUrl) {
    return `${reportBaseUrl.replace(/\/+$/, '')}/${RUNS_DIR}/${runId}/`;
  }
  return pathToFileURL(path.join(bundleDir, BUNDLE_INDEX_FILE)).href;
}
