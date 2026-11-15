import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { ledgerDocumentName, type RenderLedger } from '../context/ledger.js';
import { changedFilesSince, getGitInfo } from '../git/baseline.js';
import { resolveStorageAdapter } from '../plugins/storage/index.js';
import { RUNS_DIR, resolveOutputDir } from '../report/bundle.js';
import { isTestRunReport } from '../report/generator.js';
import type {
  DiffraConfig,
  TestRunReport,
  VisualTestResult,
} from '../types/index.js';
import { loadRunReport } from './approve.js';
import { matchesChangedFile } from './explain.js';

export interface AffectedSelection {
  /** Targets that the changed files are known to style, or that are defined in them. */
  ids: string[];
  /** Files that differ from the baseline commit. */
  changedFiles: string[];
  /** Changed files that a snapshot is known to depend on. */
  matchedFiles: string[];
  /**
   * Changed files that no snapshot is known to depend on. When these are the
   * source of components, the snapshots they affect are not in `ids`.
   */
  unmatchedFiles: string[];
  /** `ledgers` when an earlier run showed what each snapshot depends on. */
  basis: 'ledgers' | 'none';
  note: string;
}

/**
 * Drops the files inside a directory. Diffra's own output is untracked in a
 * project that does not ignore it, and is not a change anyone made.
 */
export function withoutDirectory(files: string[], directory: string): string[] {
  const dir = directory.split(path.sep).join('/').replace(/\/+$/, '');
  if (!dir || dir.startsWith('..')) return files;
  return files.filter((file) => file !== dir && !file.startsWith(`${dir}/`));
}

function normalize(file: string): string {
  return file.replace(/^\.?\/+/, '');
}

const REPORT_FILE = 'report.json';
const RUN_ID_PATTERN = /^run-(\d+)$/;

const keyOf = (r: VisualTestResult) =>
  `${r.id}|${r.browser ?? ''}|${r.viewport.width}x${r.viewport.height}`;

/**
 * The snapshots whose page context is known. A run of only some of the targets
 * knows nothing about the rest, so earlier runs are read back, newest first,
 * until one that covered everything. A snapshot is described by the newest run
 * that captured it.
 */
async function knownResults(
  latest: TestRunReport,
  config: DiffraConfig,
  cwd: string,
): Promise<VisualTestResult[]> {
  const known = new Map(latest.results.map((r) => [keyOf(r), r]));
  if (!latest.filter && !latest.shard) return [...known.values()];

  const runsDir = path.join(resolveOutputDir(config, cwd), RUNS_DIR);
  let names: string[];
  try {
    names = await fs.readdir(runsDir);
  } catch {
    return [...known.values()];
  }
  const earlier = names
    .map((name) => ({ name, at: Number(RUN_ID_PATTERN.exec(name)?.[1]) }))
    .filter((run) => Number.isFinite(run.at) && run.name !== latest.runId)
    .sort((a, b) => b.at - a.at);
  for (const run of earlier) {
    let report: unknown;
    try {
      report = JSON.parse(
        await fs.readFile(path.join(runsDir, run.name, REPORT_FILE), 'utf-8'),
      );
    } catch {
      continue;
    }
    if (!isTestRunReport(report)) continue;
    for (const result of report.results) {
      const key = keyOf(result);
      if (!known.has(key)) known.set(key, result);
    }
    if (!report.filter && !report.shard) break;
  }
  return [...known.values()];
}

/**
 * Finds the snapshots a change can reach, from what the last run recorded
 * about them: the stylesheets that styled each one, and the file that defines
 * it. No bundler is involved, so what is not a stylesheet or a defining file
 * is not known to reach anything, and is reported as unmatched.
 */
export async function selectAffected(options: {
  cwd?: string;
  config?: Partial<DiffraConfig>;
  configFile?: string;
}): Promise<AffectedSelection> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd, options.config, options.configFile);
  const git = await getGitInfo(config.runner?.baselineBranch, cwd);
  const changedFiles = withoutDirectory(
    await changedFilesSince(git.baselineCommit, cwd),
    path.relative(cwd, resolveOutputDir(config, cwd)),
  );
  const none = (note: string): AffectedSelection => ({
    ids: [],
    changedFiles,
    matchedFiles: [],
    unmatchedFiles: changedFiles,
    basis: 'none',
    note,
  });

  let report: Awaited<ReturnType<typeof loadRunReport>>;
  try {
    report = await loadRunReport(config, cwd);
  } catch {
    return none(
      'There is no earlier run to learn what each snapshot depends on.',
    );
  }
  const storage = resolveStorageAdapter(config, cwd);
  if (storage.init) await storage.init();
  if (!storage.downloadDocument) {
    return none(
      'This storage keeps no page context, so what each snapshot depends on is not known.',
    );
  }

  const matched = new Set<string>();
  const ids = new Set<string>();
  let known = 0;
  await Promise.all(
    (await knownResults(report, config, cwd)).map(async (result) => {
      const hash = result.candidate.hash;
      if (!hash || result.status === 'failed' || result.status === 'removed') {
        return;
      }
      const stored = await storage.downloadDocument?.(ledgerDocumentName(hash));
      const origins = stored
        ? new Set(
            (
              JSON.parse(stored.toString('utf-8')) as RenderLedger
            ).elements.flatMap((element) =>
              element.rules.map((rule) => rule.origin),
            ),
          )
        : new Set<string>();
      if (stored) known++;
      const definedIn = result.filePath
        ? normalize(result.filePath)
        : undefined;
      for (const file of changedFiles) {
        const touches =
          [...origins].some((origin) => matchesChangedFile(origin, [file])) ||
          (definedIn !== undefined && normalize(file) === definedIn);
        if (touches) {
          ids.add(result.id);
          matched.add(file);
        }
      }
    }),
  );

  if (known === 0) {
    return none(
      'The last run recorded no page context, so what each snapshot depends on is not known.',
    );
  }
  const unmatchedFiles = changedFiles.filter((file) => !matched.has(file));
  return {
    ids: [...ids],
    changedFiles,
    matchedFiles: [...matched],
    unmatchedFiles,
    basis: 'ledgers',
    note:
      unmatchedFiles.length > 0
        ? `${unmatchedFiles.length} changed ${unmatchedFiles.length === 1 ? 'file is' : 'files are'} not known to affect any snapshot. If they are component code, run everything.`
        : 'Every changed file is known to affect the snapshots listed.',
  };
}
