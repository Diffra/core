import fs from 'node:fs/promises';
import type http from 'node:http';
import path from 'node:path';
import { BUNDLE_INDEX_FILE, runDirectory } from '@diffra/core';
import {
  createStaticHandler,
  formatServerUrl,
  startStaticServer,
} from '@diffra/core/server';

export { formatServerUrl };

const DEFAULT_OUTPUT_DIR = '.diffra';
const LATEST_REPORT_FILE = 'latest-report.json';

export interface ServeOptions {
  /** A review bundle directory, or the report.json inside one */
  reportPath?: string;
  /** Output directory whose latest run is served when no reportPath is given */
  outputDir?: string;
  port?: number;
}

export interface ServeInstance {
  server: http.Server;
  url: string;
  port: number;
  stop: () => Promise<void>;
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<void>;
}

/** Serves a review bundle directory with strict path traversal protection. */
export function createServeHandler(options: { staticRoot: string }) {
  return createStaticHandler({
    root: options.staticRoot,
    indexFile: BUNDLE_INDEX_FILE,
  });
}

/** Finds the review bundle directory to serve. */
export async function resolveBundleDir(
  options: Pick<ServeOptions, 'reportPath' | 'outputDir'>,
): Promise<string> {
  if (options.reportPath) {
    const target = path.resolve(options.reportPath);
    const stat = await fs.stat(target).catch(() => undefined);
    if (!stat) {
      throw new Error(`Report not found: ${target}`);
    }
    return stat.isDirectory() ? target : path.dirname(target);
  }

  const outputDir = path.resolve(options.outputDir || DEFAULT_OUTPUT_DIR);
  const latestFile = path.join(outputDir, LATEST_REPORT_FILE);
  let runId: unknown;
  try {
    runId = (
      JSON.parse(await fs.readFile(latestFile, 'utf-8')) as {
        runId?: unknown;
      }
    ).runId;
  } catch {
    throw new Error(
      `No test run found in ${outputDir}. Run "diffra test" first.`,
    );
  }
  if (typeof runId !== 'string' || !runId) {
    throw new Error(`${latestFile} does not name a run.`);
  }
  return runDirectory(outputDir, runId);
}

/** Starts a static server for a review bundle on the given or a free port. */
export async function startServeServer(
  options: ServeOptions = {},
): Promise<ServeInstance> {
  const root = await resolveBundleDir(options);
  return startStaticServer({
    root,
    indexFile: BUNDLE_INDEX_FILE,
    port: options.port,
  });
}
