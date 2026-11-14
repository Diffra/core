import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseKeys, serializeKeys } from '../../src/plugins/storage/keys.js';
import { LocalFilesystemAdapter } from '../../src/plugins/storage/local.js';
import { S3StorageAdapter } from '../../src/plugins/storage/s3.js';
import type { SnapshotKey } from '../../src/types/index.js';

const KEYS: SnapshotKey[] = [
  {
    targetId: 'button--primary',
    browser: 'chromium',
    viewport: { width: 1280, height: 800 },
  },
  { targetId: 'card--hover', viewport: { width: 375, height: 667 } },
];

describe('baseline snapshot lists', () => {
  describe('serialization', () => {
    it('round-trips a list of snapshots', () => {
      expect(parseKeys(serializeKeys(KEYS))).toEqual(KEYS);
    });

    it('rejects anything that is not a list of snapshots', () => {
      expect(parseKeys('not json')).toBeNull();
      expect(parseKeys('{}')).toBeNull();
      expect(parseKeys('{"snapshots":"nope"}')).toBeNull();
      expect(parseKeys('null')).toBeNull();
    });

    it('drops entries that are not valid snapshots', () => {
      const raw = JSON.stringify({
        snapshots: [KEYS[0], { targetId: 5 }, { targetId: 'x' }, null],
      });
      expect(parseKeys(raw)).toEqual([KEYS[0]]);
    });
  });

  describe('local storage', () => {
    let dir: string;
    let adapter: LocalFilesystemAdapter;

    beforeEach(async () => {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-keys-'));
      adapter = new LocalFilesystemAdapter({ outputDir: dir });
      await adapter.init();
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('returns the list saved for a commit', async () => {
      await adapter.uploadBaselineKeys('abc123', KEYS);
      expect(await adapter.downloadBaselineKeys('abc123')).toEqual(KEYS);
    });

    it('falls back to the latest list for a commit that has none, like baselines do', async () => {
      await adapter.uploadBaselineKeys('abc123', KEYS);
      expect(await adapter.downloadBaselineKeys('def456')).toEqual(KEYS);
    });

    it('returns null when nothing was ever saved', async () => {
      expect(await adapter.downloadBaselineKeys('abc123')).toBeNull();
    });

    it('refuses a commit name that would leave the baseline directory', async () => {
      await expect(
        adapter.uploadBaselineKeys('../../outside', KEYS),
      ).rejects.toThrow(/Path traversal/);
    });
  });

  describe('S3 storage', () => {
    let s3: S3StorageAdapter;
    let send: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      s3 = new S3StorageAdapter({ bucket: 'b', prefix: 'p' });
      send = vi.fn();
      (s3 as unknown as { s3Client: unknown }).s3Client = { send };
    });

    it('reads the list stored for a commit', async () => {
      const bytes = new TextEncoder().encode(serializeKeys(KEYS));
      send.mockResolvedValueOnce({
        Body: { transformToByteArray: async () => bytes },
      });
      expect(await s3.downloadBaselineKeys('abc123')).toEqual(KEYS);
      expect(send.mock.calls[0]?.[0].input).toMatchObject({
        Bucket: 'b',
        Key: 'p/baselines/abc123/manifest.json',
      });
    });

    it('returns null when the list does not exist but throws on real errors', async () => {
      send.mockRejectedValueOnce({ name: 'NoSuchKey' });
      expect(await s3.downloadBaselineKeys('abc123')).toBeNull();

      send.mockRejectedValueOnce({
        name: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      await expect(s3.downloadBaselineKeys('abc123')).rejects.toBeDefined();
    });

    it('stores the list as JSON next to the commit baselines', async () => {
      send.mockResolvedValueOnce({});
      await s3.uploadBaselineKeys('abc123', KEYS);
      const input = send.mock.calls[0]?.[0].input;
      expect(input).toMatchObject({
        Key: 'p/baselines/abc123/manifest.json',
        ContentType: 'application/json',
      });
      expect(parseKeys(input.Body)).toEqual(KEYS);
    });
  });
});
