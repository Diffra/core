import { describe, expect, it } from 'vitest';
import {
  createImageDriver,
  createStorybookDriver,
  createUrlDriver,
  ImageDriver,
  resolveDrivers,
  StorybookDriver,
  UrlDriver,
} from '../src/drivers/index.js';
import type { VisualDriver, VisualTarget } from '../src/types/index.js';

describe('Pluggable Driver Ecosystem', () => {
  it('resolves default StorybookDriver when no specific driver configured', () => {
    const drivers = resolveDrivers({});
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('storybook');
  });

  it('resolves UrlDriver when urls array is provided', () => {
    const drivers = resolveDrivers({
      urls: ['/home', '/pricing'],
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('url');
  });

  it('resolves ImageDriver when imagesDir is provided', () => {
    const drivers = resolveDrivers({
      imagesDir: './fixtures/screenshots',
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('image');
  });

  it('resolves in-memory target list driver when targets are provided', async () => {
    const sampleTargets: VisualTarget[] = [
      { id: 'custom-1', name: 'Custom Modal', group: 'Modals' },
      { id: 'custom-2', name: 'Custom Banner', group: 'Banners' },
    ];

    const drivers = resolveDrivers({
      targets: sampleTargets,
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('targets');

    const discovered = await drivers[0].discover!({
      config: { targets: sampleTargets },
      cwd: process.cwd(),
    });
    expect(discovered).toEqual(sampleTargets);
  });

  it('supports custom downstream VisualDriver objects', async () => {
    const customDriver: VisualDriver = {
      name: 'playwright-e2e',
      discover: async () => [
        {
          id: 'flow--checkout',
          name: 'Checkout Flow',
          group: 'E2E',
          url: 'http://localhost:3000/checkout',
        },
      ],
      capture: async () => Buffer.from('mock-png-data'),
    };

    const drivers = resolveDrivers({
      driver: customDriver,
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('playwright-e2e');

    const discovered = await drivers[0].discover!({
      config: { driver: customDriver },
      cwd: process.cwd(),
    });
    expect(discovered).toHaveLength(1);
    expect(discovered[0].id).toBe('flow--checkout');
  });

  it('supports multi-driver configurations', () => {
    const customDriver: VisualDriver = {
      name: 'custom-tool',
      discover: async () => [],
    };

    const drivers = resolveDrivers({
      drivers: ['storybook', 'url', customDriver],
    });
    expect(drivers).toHaveLength(3);
    expect(drivers[0].name).toBe('storybook');
    expect(drivers[1].name).toBe('url');
    expect(drivers[2].name).toBe('custom-tool');
  });

  it('UrlDriver discovers clean normalized visual targets from routes', async () => {
    const driver = createUrlDriver();
    const targets = await driver.discover!({
      config: {
        storybookUrl: 'https://example.com',
        urls: [
          '/',
          '/pricing-table',
          {
            url: '/dashboard',
            name: 'Analytics Dashboard',
            group: 'App',
            selector: '#analytics-grid',
            delay: 150,
          },
        ],
      },
      cwd: process.cwd(),
    });

    expect(targets).toHaveLength(3);
    expect(targets[0].id).toBe('route--home');
    expect(targets[0].name).toBe('Home');
    expect(targets[0].url).toBe('https://example.com/');

    expect(targets[1].id).toBe('route--pricing_table');
    expect(targets[1].name).toBe('pricing table');
    expect(targets[1].url).toBe('https://example.com/pricing-table');

    expect(targets[2].id).toBe('route--dashboard');
    expect(targets[2].name).toBe('Analytics Dashboard');
    expect(targets[2].group).toBe('App');
    expect(targets[2].selector).toBe('#analytics-grid');
    expect(targets[2].parameters?.snapshot?.delay).toBe(150);
  });
});
