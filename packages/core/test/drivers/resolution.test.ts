import { describe, expect, it } from 'vitest';
import { resolveDrivers } from '../../src/drivers/index.js';
import type { VisualDriver, VisualTarget } from '../../src/types/index.js';
import { discoverFrom } from '../support/drivers.js';

describe('driver resolution', () => {
  it('resolves default StorybookDriver when no specific driver configured', () => {
    const drivers = resolveDrivers({});
    expect(drivers).toHaveLength(1);
    expect(drivers[0]?.name).toBe('storybook');
  });

  it('resolves UrlDriver when typed url driver config is provided', () => {
    const drivers = resolveDrivers({
      drivers: {
        driver: 'url',
        urls: ['/home', '/pricing'],
      },
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0]?.name).toBe('url');
  });

  it('resolves ImageDriver when typed image driver config is provided', () => {
    const drivers = resolveDrivers({
      drivers: {
        driver: 'image',
        dir: './fixtures/screenshots',
      },
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0]?.name).toBe('image');
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
    expect(drivers[0]?.name).toBe('targets');

    const discovered = await drivers[0]?.discover?.({
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
      drivers: customDriver,
    });
    expect(drivers).toHaveLength(1);
    expect(drivers[0]?.name).toBe('playwright-e2e');

    const [firstDriver] = drivers;
    if (!firstDriver) throw new Error('expected a driver');
    const discovered = await discoverFrom(firstDriver, {
      config: { drivers: customDriver },
      cwd: process.cwd(),
    });
    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.id).toBe('flow--checkout');
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
    expect(drivers[0]?.name).toBe('storybook');
    expect(drivers[1]?.name).toBe('url');
    expect(drivers[2]?.name).toBe('custom-tool');
  });
});
