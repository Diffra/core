import fs from 'node:fs/promises';
import path from 'node:path';
import {
  isTestRunReport,
  LATEST_REPORT_FILE,
  REPORT_FILE,
  readFileWithin,
  runDirectory,
  type TestRunReport,
} from '@diffra/core';

/** Where an agent reads a run from: its report and the images it names. */
export interface ReviewSource {
  /** Whether runs can be started and baselines approved from here. */
  readonly writable: boolean;
  readReport(): Promise<TestRunReport>;
  /** Reads an image by the `url` the report gives it. */
  readImage(url: string): Promise<Buffer>;
}

const HTTP_URL = /^https?:\/\//i;

/** Longest wait for one request to a published bundle. */
const FETCH_TIMEOUT_MS = 30_000;

/** Most redirects followed within the report's host. */
const MAX_REDIRECTS = 3;

/** Largest body read from a published bundle. */
const MAX_BODY_BYTES = 32 * 1024 * 1024;

/** Reads a response body, stopping at the size limit instead of buffering all of it. */
async function readLimited(response: Response, url: URL): Promise<Buffer> {
  const tooLarge = () =>
    new Error(`${url.href} is larger than ${MAX_BODY_BYTES} bytes.`);
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_BODY_BYTES) throw tooLarge();
  if (!response.body) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > MAX_BODY_BYTES) throw tooLarge();
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseReport(text: string, origin: string): TestRunReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${origin} is not valid JSON.`);
  }
  if (!isTestRunReport(parsed)) {
    throw new Error(`${origin} is not a Diffra report.`);
  }
  return parsed;
}

/** Resolves a path inside a root and refuses any that leaves it. */
export function resolveWithin(root: string, relative: string): string {
  const base = path.resolve(root);
  const resolved = path.resolve(base, relative);
  if (!resolved.startsWith(base + path.sep)) {
    throw new Error(`Image path leaves the review bundle: ${relative}`);
  }
  return resolved;
}

/** A review bundle on disk: a folder holding report.json and its images. */
export class DirectorySource implements ReviewSource {
  readonly writable: boolean;
  private readonly dir: string;

  constructor(dir: string, writable = false) {
    this.dir = dir;
    this.writable = writable;
  }

  async readReport(): Promise<TestRunReport> {
    const file = path.join(this.dir, REPORT_FILE);
    try {
      return parseReport(await fs.readFile(file, 'utf-8'), file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`No report found at ${file}.`);
      }
      throw err;
    }
  }

  async readImage(url: string): Promise<Buffer> {
    // Checked lexically first for a clear message, then through symbolic links.
    resolveWithin(this.dir, url);
    return readFileWithin(this.dir, url);
  }
}

/**
 * The runs of a project on this machine. The latest run is looked up on every
 * read, so a run started meanwhile is seen.
 */
export class LocalRunSource implements ReviewSource {
  readonly writable = true;
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async readReport(): Promise<TestRunReport> {
    const latest = path.join(this.outputDir, LATEST_REPORT_FILE);
    let runId: string;
    try {
      runId = parseReport(await fs.readFile(latest, 'utf-8'), latest).runId;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('No test run found yet. Call diffra_run first.');
      }
      throw err;
    }
    return new DirectorySource(
      runDirectory(this.outputDir, runId),
    ).readReport();
  }

  async readImage(url: string): Promise<Buffer> {
    const { runId } = await this.readReport();
    return new DirectorySource(runDirectory(this.outputDir, runId)).readImage(
      url,
    );
  }
}

/** A published review bundle. Images must come from the same origin. */
export class UrlSource implements ReviewSource {
  readonly writable = false;
  private readonly reportUrl: URL;

  constructor(location: string) {
    const url = new URL(location);
    if (!url.pathname.endsWith('.json')) {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/${REPORT_FILE}`;
    }
    this.reportUrl = url;
  }

  /**
   * Fetches a file of the bundle. Redirects are followed only within the
   * report's own host, the wait is bounded, and so is the size of the body, so
   * a hostile or broken host cannot send the reader elsewhere, hold it, or
   * exhaust its memory.
   */
  private async fetchBytes(start: URL): Promise<Buffer> {
    let url = start;
    for (let hop = 0; ; hop++) {
      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || hop >= MAX_REDIRECTS) {
          throw new Error(`${url.href} redirected too many times.`);
        }
        const next = new URL(location, url);
        if (next.origin !== this.reportUrl.origin) {
          throw new Error(
            `${url.href} redirected to another host: ${next.origin}`,
          );
        }
        url = next;
        continue;
      }
      if (!response.ok) {
        throw new Error(`${url.href} answered ${response.status}.`);
      }
      return readLimited(response, url);
    }
  }

  async readReport(): Promise<TestRunReport> {
    const bytes = await this.fetchBytes(this.reportUrl);
    return parseReport(bytes.toString('utf-8'), this.reportUrl.href);
  }

  async readImage(url: string): Promise<Buffer> {
    const resolved = new URL(url, this.reportUrl);
    if (resolved.origin !== this.reportUrl.origin) {
      throw new Error(`Image is not served by the report's host: ${url}`);
    }
    return this.fetchBytes(resolved);
  }
}

/** Opens a published bundle: an address, a folder, or a report.json file. */
export function openBundle(location: string): ReviewSource {
  if (HTTP_URL.test(location)) return new UrlSource(location);
  const dir = location.endsWith('.json') ? path.dirname(location) : location;
  return new DirectorySource(path.resolve(dir));
}
