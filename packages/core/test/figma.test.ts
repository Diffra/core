import { describe, expect, it, vi } from 'vitest';
import { FigmaDriver, createFigmaDriver } from '../src/drivers/figma.js';

describe('FigmaDriver', () => {
  it('discovers targets from component mapping', async () => {
    const driver = createFigmaDriver({
      fileKey: 'test-file-key',
      components: {
        'Buttons/Primary': '123:45',
        'Cards/UserCard': '123:46',
      },
    });

    const targets = await driver.discover({ config: {}, cwd: process.cwd() });
    expect(targets).toHaveLength(2);
    expect(targets[0].id).toBe('figma--123_45');
    expect(targets[0].name).toBe('Primary');
    expect(targets[0].group).toBe('Buttons');
    expect(targets[1].id).toBe('figma--123_46');
    expect(targets[1].name).toBe('UserCard');
  });

  it('discovers targets from nodeIds list', async () => {
    const driver = new FigmaDriver({
      fileKey: 'test-file-key',
      nodeIds: ['10:1', '10:2'],
    });

    const targets = await driver.discover({ config: {}, cwd: process.cwd() });
    expect(targets).toHaveLength(2);
    expect(targets[0].id).toBe('figma--10_1');
  });
});
