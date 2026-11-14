import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toMatchVisualBaselineMatcher } from '../../src/playwright/index.js';

describe('toMatchVisualBaselineMatcher in @diffra/core/playwright', () => {
  let projectDir: string;

  beforeEach(async () => {
    // The matcher keeps its output under the working directory.
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-matcher-'));
    vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it('captures screenshot from page or locator and compares baseline', async () => {
    const mockBuffer = Buffer.from('mock-png-buffer-for-matcher');
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(mockBuffer),
      viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 800 }),
    };

    const result = await toMatchVisualBaselineMatcher(
      mockPage,
      'test-hero-section',
      { diffThreshold: 0.08 },
    );

    expect(mockPage.screenshot).toHaveBeenCalled();
    expect(result.pass).toBe(true);
  });
});
