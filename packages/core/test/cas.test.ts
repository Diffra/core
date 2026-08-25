import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalFilesystemAdapter } from '../src/plugins/storage/local.js';

describe('Content-Addressed Storage (CAS)', () => {
  it('stores and deduplicates blobs by SHA-256 hash', async () => {
    const tmpDir = path.join(process.cwd(), '.diffra-test-cas');
    const storage = new LocalFilesystemAdapter({ outputDir: tmpDir });
    await storage.init!();

    const imgBuffer = Buffer.from('fake-png-data-for-cas-test');
    const hash = crypto.createHash('sha256').update(imgBuffer).digest('hex');

    const blobPath = await storage.uploadBlob!(hash, imgBuffer);
    expect(blobPath).toContain(hash);

    const has = await storage.hasBlob!(hash);
    expect(has).toBe(true);

    const downloaded = await storage.downloadBlob!(hash);
    expect(downloaded).toEqual(imgBuffer);

    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
