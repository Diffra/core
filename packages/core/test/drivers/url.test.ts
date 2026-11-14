import { describe, expect, it } from 'vitest';
import { createUrlDriver } from '../../src/drivers/url.js';
import { discoverFrom } from '../support/drivers.js';

describe('URL driver', () => {
  it('UrlDriver discovers clean normalized visual targets from routes', async () => {
    const driver = createUrlDriver({
      baseUrl: 'https://example.com',
      urls: [
        '/',
        '/pricing-table',
        {
          url: '/dashboard',
          name: 'Analytics Dashboard',
          group: 'App',
          snapshot: {
            selector: '#analytics-grid',
            delay: 150,
          },
        },
      ],
    });
    const targets = await discoverFrom(driver, {
      config: {},
      cwd: process.cwd(),
    });

    expect(targets).toHaveLength(3);
    expect(targets[0]?.id).toBe('route--home');
    expect(targets[0]?.name).toBe('Home');
    expect(targets[0]?.url).toBe('https://example.com/');

    expect(targets[1]?.id).toBe('route--pricing_table');
    expect(targets[1]?.name).toBe('pricing table');
    expect(targets[1]?.url).toBe('https://example.com/pricing-table');

    expect(targets[2]?.id).toBe('route--dashboard');
    expect(targets[2]?.name).toBe('Analytics Dashboard');
    expect(targets[2]?.group).toBe('App');
    expect(targets[2]?.snapshot?.selector).toBe('#analytics-grid');
    expect(targets[2]?.snapshot?.delay).toBe(150);
  });

  it('UrlDriver incorporates query parameters and hash fragments to prevent target ID collisions', async () => {
    const driver = createUrlDriver({
      baseUrl: 'https://example.com',
      urls: [
        '/search?q=shoes',
        '/search?q=hats',
        '/dashboard#overview',
        '/dashboard#reports',
      ],
    });

    const targets = await discoverFrom(driver, {
      config: {},
      cwd: process.cwd(),
    });
    expect(targets).toHaveLength(4);
    const ids = targets.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(4);
    expect(ids[0]).toBe('route--search_q_shoes');
    expect(ids[1]).toBe('route--search_q_hats');
    expect(ids[2]).toBe('route--dashboard_overview');
    expect(ids[3]).toBe('route--dashboard_reports');
  });

  it('UrlDriver propagates custom headers, auth credentials, and cookies to target metadata', async () => {
    const driver = createUrlDriver({
      baseUrl: 'https://auth.example.com',
      headers: { 'X-Global-Header': 'val' },
      urls: [
        {
          url: '/protected',
          name: 'Protected View',
          headers: { Authorization: 'Bearer token-123' },
          auth: { username: 'admin', password: 'secret' },
          cookies: [{ name: 'session', value: 'xyz789' }],
        },
      ],
    });

    const targets = await discoverFrom(driver, {
      config: {},
      cwd: process.cwd(),
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.metadata?.headers).toEqual({
      Authorization: 'Bearer token-123',
    });
    expect(targets[0]?.metadata?.auth).toEqual({
      username: 'admin',
      password: 'secret',
    });
    expect(targets[0]?.metadata?.cookies).toEqual([
      { name: 'session', value: 'xyz789' },
    ]);
  });

  it('UrlDriver discovers routes from context.config when options are omitted', async () => {
    const driver = createUrlDriver();
    const targets = await discoverFrom(driver, {
      config: {
        drivers: {
          driver: 'url',
          baseUrl: 'https://fallback.domain',
          urls: ['/from-config'],
        },
      },
      cwd: process.cwd(),
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]?.url).toBe('https://fallback.domain/from-config');
    expect(targets[0]?.id).toBe('route--from_config');
  });

  describe('URL Driver Route ID Collision Analysis', () => {
    it('discovers routes with complex query parameters, hashes, and symbols', async () => {
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: [
          '/search?q=shoes',
          '/search?q=hats',
          '/dashboard#overview',
          '/dashboard#reports',
          '/products?cat=shoes&sort=price',
          '/products?cat=shoes&sort=rating',
        ],
      });

      const targets = await discoverFrom(driver, {
        config: {},
        cwd: process.cwd(),
      });

      expect(targets).toHaveLength(6);
      const ids = (targets ?? []).map((t) => t.id);
      expect(new Set(ids).size).toBe(6);
    });

    it('identifies collision boundaries between identical query and hash fragments', async () => {
      // Testing the boundary: query vs hash with identical fragment name
      // e.g. /profile?tab=settings vs /profile#tab=settings
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: ['/profile?tab=settings', '/profile#tab=settings'],
      });

      const targets =
        (await discoverFrom(driver, {
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      // Both URLs produce route--profile_tab_settings under the current sanitizer
      // Documenting the exact empirical collision behavior:
      const id1 = targets[0]?.id;
      const id2 = targets[1]?.id;
      expect(id1).toBe('route--profile_tab_settings');
      expect(id2).toBe('route--profile_tab_settings');
      // They collide because query and hash use identical '_' delimiter
      expect(id1).toBe(id2);
    });

    it('identifies collision boundaries between path separator and query delimiters', async () => {
      // /search_q_shoes (static path) vs /search?q=shoes (path + query)
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: ['/search_q_shoes', '/search?q=shoes'],
      });

      const targets =
        (await discoverFrom(driver, {
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      expect(targets[0]?.id).toBe('route--search_q_shoes');
      expect(targets[1]?.id).toBe('route--search_q_shoes');
      expect(targets[0]?.id).toBe(targets[1]?.id);
    });

    it('handles special characters and URI encoded values safely without crashing', async () => {
      const driver = createUrlDriver({
        baseUrl: 'https://example.com',
        urls: [
          '/api?param=@foo',
          '/api?param=$foo',
          '/api?filter=100%25',
          '/api?complex=a+b*c',
          '/home//double//slashes/',
          '///multiple///leading///',
        ],
      });

      const targets =
        (await discoverFrom(driver, {
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(6);
      for (const target of targets) {
        expect(target.id).toMatch(/^route--[a-z0-9_]+$/);
        expect(target.url).toBeDefined();
      }
    });

    it('handles completely malformed URLs without throwing exceptions', async () => {
      const driver = createUrlDriver({
        baseUrl: '',
        urls: ['http://::invalid::url', 'not-a-valid-url'],
      });

      const targets = await discoverFrom(driver, {
        config: {},
        cwd: process.cwd(),
      });

      expect(Array.isArray(targets)).toBe(true);
      expect(targets?.length).toBe(2);
    });
  });
});
