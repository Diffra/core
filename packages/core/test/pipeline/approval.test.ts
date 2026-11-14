import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { approveBaselines } from '../../src/index.js';

describe('baseline approval', () => {
  it('approveBaselines throws descriptive error when no prior test run exists', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-no-run-'));
    try {
      await expect(approveBaselines({ cwd: emptyDir })).rejects.toThrow(
        /No latest test run found\. Run "diffra test" first\./,
      );
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });
});
