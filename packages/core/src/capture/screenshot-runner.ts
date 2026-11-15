import type { Locator, Page, PageScreenshotOptions } from 'playwright';
import { captureLedger, type RenderLedger } from '../context/ledger.js';
import type {
  Project,
  SnapshotConfig,
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
  /**
   * Runs in the page after it has settled and just before the screenshot, for
   * a browser capture. Used to change the page, for example to undo a style.
   */
  prepare?: (page: Page) => Promise<void>;
}

export interface CaptureResult {
  target: VisualTarget;
  viewport: Viewport;
  project?: Project;
  buffer: Buffer;
  /** What was on the page, when ledgers are enabled and the capture was in a browser */
  ledger?: RenderLedger;
}

export interface CaptureFailure {
  target: VisualTarget;
  viewport: Viewport;
  project?: Project;
  error: string;
}

export interface CaptureOutcome {
  results: CaptureResult[];
  failures: CaptureFailure[];
}

export interface CaptureOptions {
  concurrency?: number;
  /** Attempts per browser target before it is recorded as a failure */
  attempts?: number;
  delay?: number;
  pauseAnimationAtEnd?: boolean;
  cwd?: string;
  /** Record a render ledger with every browser capture (default: false) */
  ledger?: boolean;
  /**
   * Called once per task before it is captured, whichever way it is captured.
   * A throwing handler records that target as failed and skips its capture.
   */
  onBeforeCapture?: (target: VisualTarget, viewport: Viewport) => Promise<void>;
  /**
   * Receives each image as soon as it is captured. When set, images are not
   * kept in the outcome, so a run uses memory for the images in flight rather
   * than for all of them. A throwing handler records that target as failed.
   */
  onCapture?: (result: CaptureResult) => Promise<void>;
}

const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_CAPTURE_ATTEMPTS = 2;
const DEFAULT_NAVIGATION_TIMEOUT = 30000;
const DEFAULT_SELECTOR_TIMEOUT = 10000;

/**
 * Captures visual targets and returns only the successful images.
 * Use runCaptures to also learn which targets could not be captured.
 */
export async function captureTargets(
  tasks: CaptureTask[],
  baseUrl?: string,
  options: CaptureOptions = {},
): Promise<CaptureResult[]> {
  const { results } = await runCaptures(tasks, baseUrl, options);
  return results;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Identifies a capture by target and viewport. The browser project is left
 * out on purpose: drivers that produce images themselves do not echo it back.
 */
function taskKey(task: { target: VisualTarget; viewport: Viewport }): string {
  return `${task.target.id}|${task.viewport.width}x${task.viewport.height}`;
}

/**
 * Orchestrates parallel Playwright browser capture for any visual targets.
 * Every task ends up either in results or in failures, never dropped.
 */
export async function runCaptures(
  tasks: CaptureTask[],
  baseUrl?: string,
  options: CaptureOptions = {},
): Promise<CaptureOutcome> {
  const maxAttempts = Math.max(1, options.attempts ?? DEFAULT_CAPTURE_ATTEMPTS);
  const failures: CaptureFailure[] = [];
  const concurrency = Math.min(
    options.concurrency || DEFAULT_CONCURRENCY,
    Math.max(1, tasks.length),
  );

  const results: CaptureResult[] = [];
  const browserTasks: CaptureTask[] = [];

  const deliver = async (result: CaptureResult) => {
    if (!options.onCapture) {
      results.push(result);
      return;
    }
    try {
      await options.onCapture(result);
    } catch (err) {
      failures.push({
        target: result.target,
        viewport: result.viewport,
        project: result.project,
        error: `Could not process the capture: ${describeError(err)}`,
      });
    }
  };

  // 1. Separate tasks handled directly by custom driver capture hooks (e.g. Figma API, static images)
  const captureAllGroups = new Map<VisualDriver, CaptureTask[]>();

  for (const task of tasks) {
    const target = task.target;
    try {
      await options.onBeforeCapture?.(target, task.viewport);
    } catch (err) {
      failures.push({
        target,
        viewport: task.viewport,
        project: task.project,
        error: `onBeforeCapture failed: ${describeError(err)}`,
      });
      continue;
    }
    if (task.driver?.captureAll) {
      let group = captureAllGroups.get(task.driver);
      if (!group) {
        group = [];
        captureAllGroups.set(task.driver, group);
      }
      group.push(task);
    } else if (task.driver?.capture) {
      try {
        const buf = await task.driver.capture(
          { target, viewport: task.viewport, project: task.project },
          { config: {}, cwd: options.cwd || process.cwd() },
        );
        if (buf && buf.length > 0) {
          await deliver({
            target,
            viewport: task.viewport,
            project: task.project,
            buffer: buf,
          });
        } else {
          failures.push({
            target,
            viewport: task.viewport,
            project: task.project,
            error: `Driver ${task.driver.name} returned an empty image`,
          });
        }
      } catch (err) {
        const msg = describeError(err);
        console.warn(
          `[diffra] Driver ${task.driver.name} capture failed for ${target.id}: ${msg}`,
        );
        failures.push({
          target,
          viewport: task.viewport,
          project: task.project,
          error: msg,
        });
      }
    } else {
      browserTasks.push({ ...task, target });
    }
  }

  for (const [driver, driverTasks] of captureAllGroups) {
    if (driver.captureAll) {
      try {
        const batchResults = await driver.captureAll(
          driverTasks.map((t) => ({
            target: t.target,
            viewport: t.viewport,
            project: t.project,
          })),
          { config: {}, cwd: options.cwd || process.cwd() },
        );
        // Count expected captures per key so a task listed under several
        // projects needs one returned image per project.
        const pending = new Map<string, number>();
        for (const t of driverTasks) {
          pending.set(taskKey(t), (pending.get(taskKey(t)) ?? 0) + 1);
        }
        for (const res of batchResults) {
          if (res.buffer && res.buffer.length > 0) {
            await deliver(res);
            pending.set(taskKey(res), (pending.get(taskKey(res)) ?? 0) - 1);
          }
        }
        for (const t of driverTasks) {
          const missing = pending.get(taskKey(t)) ?? 0;
          if (missing > 0) {
            pending.set(taskKey(t), missing - 1);
            failures.push({
              target: t.target,
              viewport: t.viewport,
              project: t.project,
              error: `Driver ${driver.name} returned no image for this target`,
            });
          }
        }
      } catch (err) {
        const msg = describeError(err);
        console.warn(
          `[diffra] Driver ${driver.name} captureAll failed: ${msg}`,
        );
        for (const t of driverTasks) {
          failures.push({
            target: t.target,
            viewport: t.viewport,
            project: t.project,
            error: msg,
          });
        }
      }
    }
  }

  if (browserTasks.length === 0) {
    return { results, failures };
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

      const targetParams: SnapshotConfig = target.snapshot || {};

      // Headers, credentials and cookies are applied to the page itself, so a
      // page that carries them is not reused for another target.
      const request = target.request || {};
      const isolated = Boolean(
        request.headers || request.auth || request.cookies?.length,
      );

      let captured: CaptureResult | undefined;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const workerPage = await pool.acquirePage(viewport, project, {
          pauseAnimationAtEnd: targetParams.pauseAnimationAtEnd,
          isolated,
        });
        let healthy = false;

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

          const { headers, auth, cookies } = request;

          const pageAny = workerPage.page as unknown as {
            setExtraHTTPHeaders?: (
              headers: Record<string, string>,
            ) => Promise<void>;
          };
          const contextAny = workerPage.context as unknown as {
            setHTTPCredentials?: (auth: {
              username: string;
              password?: string;
            }) => Promise<void>;
            addCookies?: (cookies: Record<string, unknown>[]) => Promise<void>;
          };

          if (headers && typeof pageAny.setExtraHTTPHeaders === 'function') {
            await pageAny.setExtraHTTPHeaders(headers);
          }
          if (auth && typeof contextAny.setHTTPCredentials === 'function') {
            await contextAny.setHTTPCredentials(auth);
          }
          if (
            cookies &&
            cookies.length > 0 &&
            typeof contextAny.addCookies === 'function'
          ) {
            let cookieOrigin = url;
            try {
              cookieOrigin = new URL(url).origin;
            } catch {}
            const formattedCookies = cookies.map((c) => ({
              ...c,
              url: c.domain ? undefined : cookieOrigin,
            }));
            await contextAny.addCookies(formattedCookies);
          }

          const response = (await workerPage.page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: DEFAULT_NAVIGATION_TIMEOUT,
          })) as
            | { status?: () => number; ok?: () => boolean }
            | null
            | undefined;

          if (response && typeof response.status === 'function') {
            const status = response.status();
            if (status >= 400) {
              console.warn(
                `[diffra] Warning: HTTP ${status} when loading ${url} for ${target.id}`,
              );
            }
          }

          // Wait for element selector if specified by target snapshot parameters
          const selector = targetParams.selector;

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
          await task.prepare?.(workerPage.page);

          // Collect mask locators (accepts CSS selector strings or Playwright Locator instances)
          const maskItems = targetParams.mask || [];
          const maskLocators: Locator[] = maskItems
            .map((item) =>
              typeof item === 'string' ? workerPage.page.locator(item) : item,
            )
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
          let ledgerRoot: string | undefined;
          if (selector) {
            const el = await workerPage.page.$(selector);
            if (el) {
              ledgerRoot = selector;
              screenshotBuffer = await el.screenshot(screenshotOptions);
            } else {
              screenshotBuffer =
                await workerPage.page.screenshot(screenshotOptions);
            }
          } else {
            screenshotBuffer =
              await workerPage.page.screenshot(screenshotOptions);
          }

          healthy = true;
          let ledger: RenderLedger | undefined;
          if (options.ledger) {
            try {
              ledger = await captureLedger(workerPage.page, {
                selector: ledgerRoot,
                fullPage: targetParams.fullPage,
              });
            } catch (err) {
              // The ledger explains a snapshot; losing it must not lose the snapshot.
              console.warn(
                `[diffra] Warning: could not record the page for ${target.id}: ${describeError(err)}`,
              );
            }
          }

          captured = {
            target,
            viewport,
            project,
            buffer: screenshotBuffer,
            ...(ledger ? { ledger } : {}),
          };
          break;
        } catch (err) {
          const message = describeError(err);
          console.warn(
            `[diffra] Warning capturing ${target.id} (attempt ${attempt}/${maxAttempts}): ${message}`,
          );
          if (attempt >= maxAttempts) {
            failures.push({ target, viewport, project, error: message });
          }
        } finally {
          await pool.releasePage(workerPage, { discard: !healthy });
        }
      }
      // Handed over after the page is released, so comparing one capture
      // does not hold a browser page that another capture could use.
      if (captured) await deliver(captured);
    }
  };

  try {
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
  } finally {
    await pool.close();
  }

  return { results, failures };
}
