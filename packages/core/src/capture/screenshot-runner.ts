import type {
  Locator,
  PageScreenshotOptions,
} from 'playwright';
import type {
  Project,
  TargetParameters,
  Viewport,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';
import { BrowserPool } from './browser-pool.js';

export interface CaptureTask {
  target: VisualTarget;
  viewport: Viewport;
  project?: Project;
  driver?: VisualDriver;
}

export interface CaptureResult {
  target: VisualTarget;
  viewport: Viewport;
  project?: Project;
  buffer: Buffer;
}

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_NAVIGATION_TIMEOUT = 30000;
const DEFAULT_SELECTOR_TIMEOUT = 10000;

/**
 * Orchestrates parallel Playwright browser capture for any visual targets.
 */
export async function captureTargets(
  tasks: CaptureTask[],
  baseUrl?: string,
  options: {
    concurrency?: number;
    delay?: number;
    pauseAnimationAtEnd?: boolean;
    cwd?: string;
  } = {},
): Promise<CaptureResult[]> {
  const concurrency = Math.min(
    options.concurrency || DEFAULT_CONCURRENCY,
    Math.max(1, tasks.length),
  );

  const results: CaptureResult[] = [];
  const browserTasks: CaptureTask[] = [];

  // 1. Separate tasks handled directly by custom driver capture hooks (e.g. Figma API, static images)
  for (const task of tasks) {
    const target = task.target;
    if (task.driver?.capture) {
      try {
        const buf = await task.driver.capture(
          { target, viewport: task.viewport, project: task.project },
          { config: {}, cwd: options.cwd || process.cwd() },
        );
        if (buf) {
          results.push({
            target,
            viewport: task.viewport,
            project: task.project,
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
    browserTasks.push({ ...task, target });
  }

  if (browserTasks.length === 0) {
    return results;
  }

  // 2. Capture remaining targets via Playwright browser pool
  const pauseAnimationAtEnd = options.pauseAnimationAtEnd ?? true;
  const pool = new BrowserPool(concurrency, pauseAnimationAtEnd);

  const queue = [...browserTasks];

  const worker = async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const target = task.target;
      const { viewport, project } = task;

      const targetParams: TargetParameters = (target.parameters?.snapshot ||
        target.parameters?.visual ||
        target.parameters?.diffra ||
        {}) as TargetParameters;

      const workerPage = await pool.acquirePage(viewport, project, {
        animations: targetParams.animations,
        pauseAnimationAtEnd: targetParams.pauseAnimationAtEnd,
      });

      try {
        let url = target.url;
        if (!url) {
          if (baseUrl) {
            url = `${baseUrl.replace(/\/$/, '')}/${target.id}`;
          } else {
            throw new Error(
              `Target "${target.id}" has no target URL and no baseUrl was configured.`,
            );
          }
        }

        await workerPage.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: DEFAULT_NAVIGATION_TIMEOUT,
        });

        // Wait for element selector if specified by target or snapshot parameters
        const selector = target.selector || targetParams.selector;

        if (selector) {
          try {
            await workerPage.page.waitForSelector(selector, {
              state: 'attached',
              timeout: DEFAULT_SELECTOR_TIMEOUT,
            });
          } catch {}
        }

        const waitDelay = targetParams.delay ?? options.delay ?? 0;
        if (waitDelay > 0) {
          await workerPage.page.waitForTimeout(waitDelay);
        }

        // Collect mask locators (accepts CSS selector strings or Playwright Locator instances)
        const maskItems = (target.mask || targetParams.mask || []) as Array<string | Locator>;
        const maskLocators: Locator[] = maskItems
          .map((item) => (typeof item === 'string' ? workerPage.page.locator(item) : item))
          .filter(Boolean);

        // Build standard Playwright PageScreenshotOptions
        const screenshotOptions: PageScreenshotOptions = {
          type: 'png',
          mask: maskLocators.length > 0 ? maskLocators : undefined,
          fullPage: targetParams.fullPage,
          clip: targetParams.clip,
          omitBackground: targetParams.omitBackground,
          ...(targetParams.screenshotOptions || {}),
        };

        let screenshotBuffer: Buffer;
        if (selector) {
          const el = await workerPage.page.$(selector);
          if (el) {
            screenshotBuffer = (await el.screenshot(screenshotOptions)) as Buffer;
          } else {
            screenshotBuffer = (await workerPage.page.screenshot(screenshotOptions)) as Buffer;
          }
        } else {
          screenshotBuffer = (await workerPage.page.screenshot(screenshotOptions)) as Buffer;
        }

        results.push({
          target,
          viewport,
          project,
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
