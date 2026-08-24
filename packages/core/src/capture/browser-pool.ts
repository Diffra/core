import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from 'playwright';
import type { Viewport } from '../types/index.js';

export interface WorkerPage {
  context: BrowserContext;
  page: Page;
}

export class BrowserPool {
  private browser: Browser | null = null;
  public readonly concurrency: number;
  public readonly pauseAnimationAtEnd: boolean;

  constructor(concurrency = 4, pauseAnimationAtEnd = true) {
    this.concurrency = Math.max(1, concurrency);
    this.pauseAnimationAtEnd = pauseAnimationAtEnd;
  }

  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--force-color-profile=srgb',
      ],
    });
  }

  async acquirePage(viewport: Viewport): Promise<WorkerPage> {
    if (!this.browser) {
      await this.init();
    }
    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const context = await this.browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // Deterministically freeze CSS transitions and animations at final state
    if (this.pauseAnimationAtEnd) {
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

    return { context, page };
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
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore
      } finally {
        this.browser = null;
      }
    }
  }
}
