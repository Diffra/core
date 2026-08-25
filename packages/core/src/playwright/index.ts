import type { Locator, Page, PageScreenshotOptions } from 'playwright';
import { getGitInfo } from '../git/baseline.js';
import { loadConfig } from '../config/loader.js';
import { resolveDiffEngine } from '../plugins/diff/index.js';
import { resolveStorageAdapter } from '../plugins/storage/index.js';
import type { DiffOptions } from '../types/index.js';

export interface VisualBaselineOptions extends DiffOptions {
  threshold?: number;
  diffThreshold?: number;
  mask?: Locator[];
  maxDiffPixels?: number;
  maxDiffPixelRatio?: number;
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
  omitBackground?: boolean;
  animations?: 'disabled' | 'allow';
  screenshotOptions?: PageScreenshotOptions;
}

let cachedContext: {
  cwd: string;
  config: import('../types/index.js').DiffraConfig;
  gitInfo: import('../git/baseline.js').GitInfo;
  storage: import('../types/index.js').StorageAdapter;
  runId: string;
} | null = null;

async function getPlaywrightContext(cwd: string) {
  if (cachedContext && cachedContext.cwd === cwd) {
    return cachedContext;
  }
  const config = await loadConfig(cwd);
  const gitInfo = await getGitInfo(config.baselineBranch, cwd);
  const storage = resolveStorageAdapter(config, cwd);
  if (storage.init) await storage.init();
  const runId = `playwright-${Date.now()}`;
  cachedContext = { cwd, config, gitInfo, storage, runId };
  return cachedContext;
}

/**
 * Custom visual baseline matcher for Playwright test runners.
 */
export async function toMatchVisualBaselineMatcher(
  received: Page | Locator,
  snapshotId: string,
  options: VisualBaselineOptions = {},
): Promise<{ pass: boolean; message: () => string }> {
  const screenshotOpts: PageScreenshotOptions = {
    type: 'png',
    mask: options.mask,
    fullPage: options.fullPage,
    clip: options.clip,
    omitBackground: options.omitBackground,
    animations: options.animations,
    ...(options.screenshotOptions || {}),
  };

  // Capture screenshot buffer from Page or Locator
  const buffer = (await received.screenshot(screenshotOpts)) as Buffer;

  const cwd = process.cwd();
  const { config, gitInfo, storage, runId } = await getPlaywrightContext(cwd);

  let viewport = { width: 1280, height: 800 };
  if ('viewportSize' in received && typeof (received as any).viewportSize === 'function') {
    const vp = (received as Page).viewportSize();
    if (vp) viewport = vp;
  } else if ('page' in received && typeof (received as any).page === 'function') {
    const vp = (received as Locator).page().viewportSize();
    if (vp) viewport = vp;
  }

  const baselineBuffer = await storage.downloadBaseline(
    gitInfo.baselineCommit,
    snapshotId,
    viewport,
  );

  await storage.uploadCandidate(runId, snapshotId, viewport, buffer);

  if (!baselineBuffer) {
    await storage.uploadBaseline(
      gitInfo.commit || 'HEAD',
      snapshotId,
      viewport,
      buffer,
    );
    return {
      pass: true,
      message: () => `Visual baseline created for "${snapshotId}".`,
    };
  }

  const diffEngine = resolveDiffEngine(config);
  const threshold =
    options.diffThreshold ?? options.threshold ?? config.diffThreshold ?? 0.063;

  const diffResult = await diffEngine.compare(baselineBuffer, buffer, {
    threshold,
    diffThreshold: threshold,
    generateDiffImage: true,
  });

  if (diffResult.hasDiff && diffResult.diffImage) {
    await storage.uploadDiff(runId, snapshotId, viewport, diffResult.diffImage);
  }

  const pass = !diffResult.hasDiff;
  const message = () =>
    pass
      ? `Visual snapshot matched baseline "${snapshotId}".`
      : `Visual regression detected for "${snapshotId}": ${diffResult.diffCount} changed pixels (${diffResult.diffPercentage.toFixed(2)}%).`;

  return {
    pass,
    message,
  };
}
