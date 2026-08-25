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

const RECYCLE_THRESHOLD = 100;

export class BrowserPool {
  private browsers = new Map<string, Browser>();
  private operationCounts = new Map<string, number>();
  public readonly concurrency: number;
  public readonly pauseAnimationAtEnd: boolean;

  constructor(concurrency = 4, pauseAnimationAtEnd = true) {
    this.concurrency = Math.max(1, concurrency);
    this.pauseAnimationAtEnd = pauseAnimationAtEnd;
  }

  async getBrowser(
    browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium',
    launchOptions?: LaunchOptions,
  ): Promise<Browser> {
    const key = `${browserType}:${JSON.stringify(launchOptions || {})}`;
    const existing = this.browsers.get(key);
    const count = this.operationCounts.get(key) || 0;

    if (existing && count < RECYCLE_THRESHOLD) {
      this.operationCounts.set(key, count + 1);
      return existing;
    }

    if (existing) {
      try {
        await existing.close();
      } catch {}
      this.browsers.delete(key);
    }

    const launcher =
      browserType === 'firefox'
        ? firefox
        : browserType === 'webkit'
          ? webkit
          : chromium;

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

    const finalLaunchOptions: LaunchOptions = {
      headless: true,
      args: defaultArgs,
      ...(launchOptions || {}),
    };

    const browser = await launcher.launch(finalLaunchOptions);

    this.browsers.set(key, browser);
    this.operationCounts.set(key, 1);
    return browser;
  }

  async acquirePage(
    viewport: Viewport,
    project?: Project,
    options?: { animations?: 'disabled' | 'allow'; pauseAnimationAtEnd?: boolean },
  ): Promise<WorkerPage> {
    const browserType = project?.browser || 'chromium';
    const browser = await this.getBrowser(browserType, project?.launchOptions);

    const projectUse = project?.use || {};
    const context = await browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      deviceScaleFactor: 1,
      ...projectUse,
    });

    const page = await context.newPage();

    let shouldFreezeAnimations = this.pauseAnimationAtEnd;
    if (options?.animations === 'allow') {
      shouldFreezeAnimations = false;
    } else if (options?.animations === 'disabled') {
      shouldFreezeAnimations = true;
    } else if (options?.pauseAnimationAtEnd !== undefined) {
      shouldFreezeAnimations = options.pauseAnimationAtEnd;
    }

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
  }

  async releasePage(worker: WorkerPage): Promise<void> {
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

  async close(): Promise<void> {
    for (const browser of this.browsers.values()) {
      try {
        await browser.close();
      } catch {
        // Ignore
      }
    }
    this.browsers.clear();
    this.operationCounts.clear();
  }
}
