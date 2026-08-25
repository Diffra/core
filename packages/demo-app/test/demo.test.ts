import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '@diffra/core/config';
import { resolveDrivers } from '@diffra/core/drivers';

describe('Demo App Diffra Configuration', () => {
  it('loads diffra.config.ts correctly with URL driver and routes', async () => {
    const appDir = path.resolve(import.meta.dirname, '..');
    const config = await loadConfig(appDir);
    expect(config.driver).toBe('url');
    expect(config.urls).toHaveLength(2);

    const drivers = resolveDrivers(config, appDir);
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('url');

    expect(drivers[0].discover).toBeDefined();
    const targets = await drivers[0].discover!({ config, cwd: appDir });
    expect(targets).toHaveLength(2);
    expect(targets[0].name).toBe('Landing Page');
    expect(targets[1].name).toBe('Analytics Dashboard');
    expect(targets[1].mask).toEqual(['.timestamp-badge']);
  });
});
