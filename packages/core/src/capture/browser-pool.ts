import {
  type Browser,
  type BrowserContext,
  chromium,
  firefox,
  type LaunchOptions,
  type Page,
  webkit,
} from 'playwright';
import type { Project, Viewport } from '../types/index.js';

export interface WorkerPage {
  context: BrowserContext;
  page: Page;
  browserType: 'chromium' | 'firefox' | 'webkit';
}

type BrowserType = WorkerPage['browserType'];

/** A browser that has served this many pages is replaced once it is idle. */
const RECYCLE_THRESHOLD = 100;
/** A page is closed after this many captures, so long runs stay bounded. */
const PAGE_REUSE_LIMIT = 50;
const BLANK_PAGE = 'about:blank';

interface BrowserEntry {
  /** Shared by every caller that asks while the browser is still starting. */
  launch: Promise<Browser>;
  uses: number;
}

export class BrowserPool {
  private readonly entries = new Map<string, BrowserEntry>();
  /** Pages in use per browser, so a browser is never closed under a worker. */
  private readonly leases = new Map<string, number>();
  /** Pages waiting to be reused, by the viewport and settings they were made for. */
  private readonly idle = new Map<string, WorkerPage[]>();
  private readonly pages = new WeakMap<
    BrowserContext,
    { browserKey: string; reuseKey: string | undefined; uses: number }
  >();
  private readonly retiring = new Set<Promise<void>>();
  public readonly concurrency: number;
  public readonly pauseAnimationAtEnd: boolean;

  constructor(concurrency = 4, pauseAnimationAtEnd = true) {
    this.concurrency = Math.max(1, concurrency);
    this.pauseAnimationAtEnd = pauseAnimationAtEnd;
  }

  private static keyOf(
    browserType: BrowserType,
    launchOptions?: LaunchOptions,
  ): string {
    return `${browserType}:${JSON.stringify(launchOptions || {})}`;
  }

  private static launcherFor(browserType: BrowserType) {
    return browserType === 'firefox'
      ? firefox
      : browserType === 'webkit'
        ? webkit
        : chromium;
  }

  private launch(
    browserType: BrowserType,
    launchOptions?: LaunchOptions,
  ): Promise<Browser> {
    const defaultArgs =
      browserType === 'chromium'
        ? [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--force-color-profile=srgb',
          ]
        : undefined;
    return BrowserPool.launcherFor(browserType).launch({
      headless: true,
      args: defaultArgs,
      ...(launchOptions || {}),
    });
  }

  private retire(key: string, entry: BrowserEntry): void {
    // Pages that were idle in this browser close along with it.
    for (const [reuseKey, pages] of this.idle) {
      const kept = pages.filter(
        (page) => this.pages.get(page.context)?.browserKey !== key,
      );
      if (kept.length > 0) this.idle.set(reuseKey, kept);
      else this.idle.delete(reuseKey);
    }
    const closing = entry.launch
      .then((browser) => browser.close())
      .catch(() => {});
    this.retiring.add(closing);
    void closing.finally(() => this.retiring.delete(closing));
  }

  /**
   * Returns the shared browser for a type, starting it when needed. The check
   * and the registration happen with no await between them, so workers that
   * start together share one launch instead of each starting a browser that
   * the pool would then lose track of.
   */
  private browserFor(
    key: string,
    browserType: BrowserType,
    launchOptions: LaunchOptions | undefined,
    ownLeases: number,
  ): Promise<Browser> {
    const entry = this.entries.get(key);
    const othersBusy = (this.leases.get(key) ?? 0) > ownLeases;
    if (entry && !(entry.uses >= RECYCLE_THRESHOLD && !othersBusy)) {
      entry.uses++;
      return entry.launch;
    }
    if (entry) this.retire(key, entry);

    const launch = this.launch(browserType, launchOptions);
    this.entries.set(key, { launch, uses: 1 });
    // A failed launch must not be served to every later caller.
    launch.catch(() => {
      if (this.entries.get(key)?.launch === launch) this.entries.delete(key);
    });
    return launch;
  }

  getBrowser(
    browserType: BrowserType = 'chromium',
    launchOptions?: LaunchOptions,
  ): Promise<Browser> {
    const key = BrowserPool.keyOf(browserType, launchOptions);
    return this.browserFor(key, browserType, launchOptions, 0);
  }

  private release(key: string | undefined): void {
    if (key === undefined) return;
    const remaining = (this.leases.get(key) ?? 1) - 1;
    if (remaining > 0) this.leases.set(key, remaining);
    else this.leases.delete(key);
  }

  async acquirePage(
    viewport: Viewport,
    project?: Project,
    options?: {
      animations?: 'disabled' | 'allow';
      pauseAnimationAtEnd?: boolean;
      /**
       * Set when the target applies state to its page, such as headers or
       * cookies. Such a page is never reused, so nothing carries over.
       */
      isolated?: boolean;
    },
  ): Promise<WorkerPage> {
    const browserType = project?.browser || 'chromium';
    const key = BrowserPool.keyOf(browserType, project?.launchOptions);

    let shouldFreezeAnimations = this.pauseAnimationAtEnd;
    if (options?.animations === 'allow') {
      shouldFreezeAnimations = false;
    } else if (options?.animations === 'disabled') {
      shouldFreezeAnimations = true;
    } else if (options?.pauseAnimationAtEnd !== undefined) {
      shouldFreezeAnimations = options.pauseAnimationAtEnd;
    }

    const projectUse = project?.use || {};
    const reuseKey = options?.isolated
      ? undefined
      : JSON.stringify([
          key,
          viewport.width,
          viewport.height,
          projectUse,
          shouldFreezeAnimations,
        ]);

    // Counted before waiting, so a recycle never closes a browser this page
    // is about to use.
    this.leases.set(key, (this.leases.get(key) ?? 0) + 1);

    try {
      const reused = reuseKey ? this.idle.get(reuseKey)?.pop() : undefined;
      if (reused) {
        const state = this.pages.get(reused.context);
        if (state) state.uses++;
        return reused;
      }

      const browser = await this.browserFor(
        key,
        browserType,
        project?.launchOptions,
        1,
      );

      const context = await browser.newContext({
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
        deviceScaleFactor: 1,
        ...projectUse,
      });
      this.pages.set(context, { browserKey: key, reuseKey, uses: 1 });

      const page = await context.newPage();

      // Deterministically freeze CSS transitions and animations at final state
      if (shouldFreezeAnimations) {
        await page.addInitScript(() => {
          const injectStyles = () => {
            const style = document.createElement('style');
            style.setAttribute('data-diffra-freeze', 'true');
            style.textContent = `
            *, *::before, *::after {
              animation-duration: 0.0001s !important;
              animation-delay: -99999s !important;
              animation-play-state: paused !important;
              transition-duration: 0.0001s !important;
              transition-delay: 0s !important;
              caret-color: transparent !important;
            }
          `;
            (document.head || document.documentElement).appendChild(style);
          };

          if (document.head || document.documentElement) {
            injectStyles();
          } else {
            window.addEventListener('DOMContentLoaded', injectStyles);
          }
        });
      }

      return { context, page, browserType };
    } catch (error) {
      this.release(key);
      throw error;
    }
  }

  /** Clears what a capture left behind, so the next one starts clean. */
  private async reset(worker: WorkerPage): Promise<boolean> {
    try {
      await worker.page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // The page has no storage, for example about:blank.
        }
      });
      await worker.context.clearCookies();
      // Unloads the story, which also stops its timers and network activity.
      await worker.page.goto(BLANK_PAGE);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hands a page back. A page from a failed capture is discarded, since it may
   * be in a bad state; a healthy one is reset and kept for the next capture.
   */
  async releasePage(
    worker: WorkerPage,
    options?: { discard?: boolean },
  ): Promise<void> {
    const state = this.pages.get(worker.context);
    this.release(state?.browserKey);

    const reuseKey = state?.reuseKey;
    if (
      reuseKey !== undefined &&
      !options?.discard &&
      (state?.uses ?? PAGE_REUSE_LIMIT) < PAGE_REUSE_LIMIT &&
      !worker.page.isClosed() &&
      (await this.reset(worker))
    ) {
      const waiting = this.idle.get(reuseKey) ?? [];
      waiting.push(worker);
      this.idle.set(reuseKey, waiting);
      return;
    }

    this.pages.delete(worker.context);
    try {
      await worker.page.close();
    } catch {
      // Ignore
    }
    try {
      await worker.context.close();
    } catch {
      // Ignore
    }
  }

  /** Closes every browser, including any still starting or being replaced. */
  async close(): Promise<void> {
    const entries = [...this.entries.values()];
    this.entries.clear();
    this.leases.clear();
    this.idle.clear();
    await Promise.all([
      ...entries.map((entry) =>
        entry.launch.then((browser) => browser.close()).catch(() => {}),
      ),
      ...this.retiring,
    ]);
  }
}
