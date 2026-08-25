import { describe, expect, it } from 'vitest';
import { DiffraConfigSchema } from '../src/config/schema.js';

describe('Diffra Config Schema', () => {
  it('applies default configuration values across domains', () => {
    const config = DiffraConfigSchema.parse({});
    expect(config.drivers).toBe('storybook');
    expect(config.snapshot.viewports).toEqual([
      { width: 1280, height: 800, name: 'desktop' },
    ]);
    expect(config.snapshot.diffThreshold).toBe(0.063);
    expect(config.snapshot.delay).toBe(100);
    expect(config.snapshot.pauseAnimationAtEnd).toBe(true);
    expect(config.runner.concurrency).toBe(4);
    expect(config.runner.baselineBranch).toBeUndefined();
    expect(config.storage.provider).toBe('local');
  });

  it('validates custom 5-domain options', () => {
    const custom = DiffraConfigSchema.parse({
      drivers: {
        driver: 'storybook',
        url: 'http://localhost:9009',
      },
      snapshot: {
        diffThreshold: 0.05,
        viewports: [
          { width: 375, height: 667, name: 'mobile' },
          { width: 1920, height: 1080, name: 'desktop-hd' },
        ],
      },
      runner: {
        concurrency: 8,
      },
      storage: {
        provider: 's3',
        bucket: 'my-visual-baselines',
        region: 'eu-west-1',
      },
    });

    expect(custom.snapshot.diffThreshold).toBe(0.05);
    expect(custom.snapshot.viewports).toHaveLength(2);
    expect(custom.runner.concurrency).toBe(8);
    expect(custom.storage.provider).toBe('s3');
    expect(custom.storage.bucket).toBe('my-visual-baselines');
  });

  it('rejects invalid threshold values outside [0, 1]', () => {
    expect(() =>
      DiffraConfigSchema.parse({ snapshot: { diffThreshold: 2.5 } }),
    ).toThrow();
    expect(() =>
      DiffraConfigSchema.parse({ snapshot: { diffThreshold: -0.1 } }),
    ).toThrow();
  });

  it('provides identity helper via defineConfig', async () => {
    const { defineConfig } = await import('../src/config/index.js');
    const userConfig = { drivers: 'storybook' };
    expect(defineConfig(userConfig)).toBe(userConfig);
  });
});
