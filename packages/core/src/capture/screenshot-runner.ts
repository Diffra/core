import type {
  DriverCaptureResult,
  DriverCaptureTask,
  Viewport,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';
import { BrowserPool } from './browser-pool.js';

export interface CaptureTask {
  target: VisualTarget;
  viewport: Viewport;
  driver?: VisualDriver;
  /** Legacy alias for target */
  story?: VisualTarget;
}

export interface CaptureResult {
  target: VisualTarget;
  viewport: Viewport;
  buffer: Buffer;
  /** Legacy alias for target */
  story: VisualTarget;
}

/**
 * Orchestrates parallel Playwright browser capture for any visual targets.
 */
export async function captureTargets(
  tasks: CaptureTask[],
  baseUrl = 'http://localhost:6006',
  options: {
    concurrency?: number;
    delay?: number;
    pauseAnimationAtEnd?: boolean;
    cwd?: string;
  } = {},
): Promise<CaptureResult[]> {
  const concurrency = Math.min(
    options.concurrency || 2,
    Math.max(1, tasks.length),
  );

  const results: CaptureResult[] = [];
  const browserTasks: CaptureTask[] = [];

  // 1. Separate tasks handled directly by custom driver capture hooks
  for (const task of tasks) {
    const target = task.target || task.story!;
    if (task.driver?.capture) {
      try {
        const buf = await task.driver.capture(
          { target, viewport: task.viewport },
          { config: {}, cwd: options.cwd || process.cwd() },
        );
        if (buf) {
          results.push({
            target,
            story: target,
            viewport: task.viewport,
            buffer: buf,
          });
          continue;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[diffra] Driver ${task.driver.name} capture failed for ${target.id}: ${msg}`,
        );
      }
    }
    browserTasks.push({ ...task, target, story: target });
  }

  if (browserTasks.length === 0) {
    return results;
  }

  // 2. Capture remaining targets via Playwright browser pool
  const pauseAnimationAtEnd = options.pauseAnimationAtEnd ?? true;
  const pool = new BrowserPool(concurrency, pauseAnimationAtEnd);
  await pool.init();

  const queue = [...browserTasks];

  const worker = async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const target = task.target || task.story!;
      const { viewport } = task;
      const workerPage = await pool.acquirePage(viewport);

      try {
        const targetParams =
          target.parameters?.snapshot ||
          target.parameters?.visual ||
          target.parameters?.diffra ||
          {};

        let url = target.url;
        if (!url) {
          url = `${baseUrl.replace(/\/$/, '')}/iframe.html?id=${encodeURIComponent(
            target.id,
          )}&viewMode=story`;
        }

        await workerPage.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });

        // Wait for element selector if specified
        const selector =
          target.selector ||
          targetParams.selector ||
          (url.includes('iframe.html') ? '#storybook-root, #root' : undefined);

        if (selector) {
          try {
            await workerPage.page.waitForSelector(selector, {
              state: 'attached',
              timeout: 5000,
            });
          } catch {}
        }

        const waitDelay = targetParams.delay ?? options.delay ?? 20;
        if (waitDelay > 0) {
          await workerPage.page.waitForTimeout(waitDelay);
        }

        let screenshotBuffer: Buffer;
        if (target.selector && target.selector !== '#storybook-root, #root') {
          const el = await workerPage.page.$(target.selector);
          if (el) {
            screenshotBuffer = (await el.screenshot({ type: 'png' })) as Buffer;
          } else {
            screenshotBuffer = (await workerPage.page.screenshot({
              type: 'png',
            })) as Buffer;
          }
        } else {
          screenshotBuffer = (await workerPage.page.screenshot({
            type: 'png',
          })) as Buffer;
        }

        results.push({
          target,
          story: target,
          viewport,
          buffer: screenshotBuffer,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[diffra] Warning capturing ${target.id}: ${message}`);
      } finally {
        await pool.releasePage(workerPage);
      }
    }
  };

  try {
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
  } finally {
    await pool.close();
  }

  return results;
}

/**
 * Legacy wrapper function for Storybook captures
 */
export async function captureStories(
  tasks: Array<{ story: VisualTarget; viewport: Viewport }>,
  storybookUrl: string,
  options: {
    concurrency?: number;
    delay?: number;
    pauseAnimationAtEnd?: boolean;
  } = {},
): Promise<CaptureResult[]> {
  const normalizedTasks: CaptureTask[] = tasks.map((t) => ({
    target: t.story,
    story: t.story,
    viewport: t.viewport,
  }));
  return captureTargets(normalizedTasks, storybookUrl, options);
}
