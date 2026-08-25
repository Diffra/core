import { describe, expect, it, vi } from 'vitest';
import { toMatchVisualBaselineMatcher } from '../src/playwright/index.js';

describe('toMatchVisualBaselineMatcher in @diffra/core/playwright', () => {
  it('captures screenshot from page or locator and compares baseline', async () => {
    const mockBuffer = Buffer.from('mock-png-buffer-for-matcher');
    const mockPage = {
      screenshot: vi.fn().mockResolvedValue(mockBuffer),
      viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 800 }),
    };

    const result = await toMatchVisualBaselineMatcher(
      mockPage as any,
      'test-hero-section',
      { diffThreshold: 0.08 },
    );

    expect(mockPage.screenshot).toHaveBeenCalled();
    expect(result.pass).toBe(true);
  });
});
