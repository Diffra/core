import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFilesystemAdapter } from '../src/storage/index.js';
import type { TestRunReport, Viewport } from '../src/types/index.js';

describe('LocalFilesystemAdapter', () => {
  const testOutputDir = '.diffra/test-tmp';
  const testBaselineDir = '.diffra/test-tmp/baselines';
  let adapter: LocalFilesystemAdapter;

  beforeEach(async () => {
    adapter = new LocalFilesystemAdapter(testOutputDir, testBaselineDir);
    await adapter.init();
  });

  afterEach(async () => {
    await fs.rm(path.resolve(process.cwd(), testOutputDir), {
      recursive: true,
      force: true,
    });
  });

  it('uploads candidates and retrieves baselines correctly', async () => {
    const storyId = 'button--primary';
    const viewport: Viewport = { width: 800, height: 600, name: 'desktop' };
    const sampleBuffer = Buffer.from('fake-png-data');

    // 1. Upload baseline for commit 'c1'
    await adapter.uploadBaseline('c1', storyId, viewport, sampleBuffer);

    // 2. Download baseline
    const downloaded = await adapter.downloadBaseline('c1', storyId, viewport);
    expect(downloaded).not.toBeNull();
    expect(downloaded?.toString()).toBe('fake-png-data');

    // 3. Upload candidate
    const candidatePath = await adapter.uploadCandidate(
      'run-123',
      storyId,
      viewport,
      sampleBuffer,
    );
    expect(candidatePath).toContain('run-123');
    expect(candidatePath).toContain('candidates');
  });

  it('saves and formats test report manifest', async () => {
    const report: TestRunReport = {
      runId: 'run-999',
      timestamp: new Date().toISOString(),
      branch: 'feature/dark-mode',
      commit: 'abc1234',
      baselineCommit: 'main567',
      summary: {
        total: 1,
        changed: 1,
        added: 0,
        removed: 0,
        unchanged: 0,
      },
      results: [
        {
          id: 'card--hover',
          name: 'Hover',
          component: 'Card',
          viewport: { width: 800, height: 600 },
          status: 'changed',
        },
      ],
    };

    const savedPath = await adapter.saveReport(report);
    expect(savedPath).toContain('run-999');

    const fileContent = await fs.readFile(savedPath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    expect(parsed.runId).toBe('run-999');
    expect(parsed.summary.changed).toBe(1);
  });
});
