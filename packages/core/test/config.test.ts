import { describe, expect, it } from 'vitest';
import { DiffraConfigSchema } from '../src/config/schema.js';

describe('Diffra Config Schema', () => {
  it('applies default configuration values', () => {
    const config = DiffraConfigSchema.parse({});
    expect(config.storybookUrl).toBe('http://localhost:6006');
    expect(config.viewports).toEqual([
      { width: 1280, height: 800, name: 'desktop' },
    ]);
    expect(config.diffThreshold).toBe(0.063);
    expect(config.threshold).toBe(0.063);
    expect(config.delay).toBe(100);
    expect(config.pauseAnimationAtEnd).toBe(true);
    expect(config.concurrency).toBe(4);
    expect(config.outputDir).toBe('.diffra');
    expect(config.storage.type).toBe('local');
  });

  it('validates custom viewports and thresholds', () => {
    const custom = DiffraConfigSchema.parse({
      storybookUrl: 'http://localhost:9009',
      threshold: 0.05,
      diffThreshold: 0.05,
      viewports: [
        { width: 375, height: 667, name: 'mobile' },
        { width: 1920, height: 1080, name: 'desktop-hd' },
      ],
      storage: {
        type: 's3',
        s3: {
          bucket: 'my-visual-baselines',
          region: 'eu-west-1',
        },
      },
    });

    expect(custom.storybookUrl).toBe('http://localhost:9009');
    expect(custom.threshold).toBe(0.05);
    expect(custom.diffThreshold).toBe(0.05);
    expect(custom.viewports).toHaveLength(2);
    expect(custom.storage.type).toBe('s3');
    expect(custom.storage.s3?.bucket).toBe('my-visual-baselines');
  });

  it('rejects invalid threshold values outside [0, 1]', () => {
    expect(() => DiffraConfigSchema.parse({ threshold: 2.5 })).toThrow();
    expect(() => DiffraConfigSchema.parse({ threshold: -0.1 })).toThrow();
    expect(() => DiffraConfigSchema.parse({ diffThreshold: 2.5 })).toThrow();
    expect(() => DiffraConfigSchema.parse({ diffThreshold: -0.1 })).toThrow();
  });
});
