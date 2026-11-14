import { afterEach, describe, expect, it } from 'vitest';
import { BrowserPool } from '../../src/capture/browser-pool.js';

const VIEWPORT = { width: 320, height: 240 };
const OTHER_VIEWPORT = { width: 640, height: 480 };
const COOKIE_URL = 'http://cookies.test/';

describe('BrowserPool', () => {
  let pool: BrowserPool;

  afterEach(async () => {
    await pool.close();
  });

  describe('browser lifecycle', () => {
    it('shares one browser between workers that start together', async () => {
      pool = new BrowserPool(4);
      const browsers = await Promise.all(
        Array.from({ length: 4 }, () => pool.getBrowser()),
      );
      // A browser the pool lost track of would never be closed, and its
      // process would keep the run from exiting.
      expect(new Set(browsers).size).toBe(1);
    });

    it('closes every browser it started', async () => {
      pool = new BrowserPool(4);
      const browsers = await Promise.all(
        Array.from({ length: 4 }, () => pool.getBrowser()),
      );
      await pool.close();
      expect(browsers.every((browser) => !browser.isConnected())).toBe(true);
    });

    it('starts workers that begin together on one browser', async () => {
      pool = new BrowserPool(4);
      const workers = await Promise.all(
        Array.from({ length: 4 }, () => pool.acquirePage(VIEWPORT)),
      );
      const browsers = new Set(
        workers.map((worker) => worker.context.browser()),
      );
      expect(browsers.size).toBe(1);
      await Promise.all(workers.map((worker) => pool.releasePage(worker)));
    });
  });

  describe('page reuse', () => {
    it('hands a released page to the next capture with the same viewport', async () => {
      pool = new BrowserPool(1);
      const first = await pool.acquirePage(VIEWPORT);
      await pool.releasePage(first);
      const second = await pool.acquirePage(VIEWPORT);
      expect(second.page).toBe(first.page);
      await pool.releasePage(second);
    });

    it('does not reuse a page for a different viewport', async () => {
      pool = new BrowserPool(1);
      const first = await pool.acquirePage(VIEWPORT);
      await pool.releasePage(first);
      const second = await pool.acquirePage(OTHER_VIEWPORT);
      expect(second.page).not.toBe(first.page);
      await pool.releasePage(second);
    });

    it('never reuses a page that carries per-target state', async () => {
      pool = new BrowserPool(1);
      const first = await pool.acquirePage(VIEWPORT, undefined, {
        isolated: true,
      });
      await pool.releasePage(first);
      const second = await pool.acquirePage(VIEWPORT, undefined, {
        isolated: true,
      });
      expect(second.page).not.toBe(first.page);
      expect(first.page.isClosed()).toBe(true);
      await pool.releasePage(second);
    });

    it('discards a page whose capture failed', async () => {
      pool = new BrowserPool(1);
      const first = await pool.acquirePage(VIEWPORT);
      await pool.releasePage(first, { discard: true });
      expect(first.page.isClosed()).toBe(true);
      const second = await pool.acquirePage(VIEWPORT);
      expect(second.page).not.toBe(first.page);
      await pool.releasePage(second);
    });

    it('clears cookies before a page is used again', async () => {
      pool = new BrowserPool(1);
      const first = await pool.acquirePage(VIEWPORT);
      await first.context.addCookies([
        { name: 'session', value: 'secret', url: COOKIE_URL },
      ]);
      expect(await first.context.cookies(COOKIE_URL)).toHaveLength(1);
      await pool.releasePage(first);

      const second = await pool.acquirePage(VIEWPORT);
      expect(second.page).toBe(first.page);
      expect(await second.context.cookies(COOKIE_URL)).toHaveLength(0);
      await pool.releasePage(second);
    });

    it('serves concurrent workers their own pages', async () => {
      pool = new BrowserPool(2);
      const [a, b] = await Promise.all([
        pool.acquirePage(VIEWPORT),
        pool.acquirePage(VIEWPORT),
      ]);
      expect(a.page).not.toBe(b.page);
      await Promise.all([pool.releasePage(a), pool.releasePage(b)]);
    });

    it('closes idle pages along with the browser', async () => {
      pool = new BrowserPool(1);
      const worker = await pool.acquirePage(VIEWPORT);
      await pool.releasePage(worker);
      await pool.close();
      expect(worker.page.isClosed()).toBe(true);
    });
  });
});
