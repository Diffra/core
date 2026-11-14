import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadConfig,
  STORAGE_ENV,
  storageConfigFromEnv,
} from '../../src/index.js';

describe('storageConfigFromEnv', () => {
  it('returns undefined when nothing is configured', () => {
    expect(storageConfigFromEnv({})).toBeUndefined();
  });

  it('infers s3 from a bucket and reads region, prefix and endpoint', () => {
    expect(
      storageConfigFromEnv({
        [STORAGE_ENV.bucket]: 'baselines',
        [STORAGE_ENV.region]: 'eu-north-1',
        [STORAGE_ENV.prefix]: 'team-a',
        [STORAGE_ENV.endpoint]: 'https://objects.example.test',
      }),
    ).toEqual({
      provider: 's3',
      bucket: 'baselines',
      region: 'eu-north-1',
      prefix: 'team-a',
      endpoint: 'https://objects.example.test',
    });
  });

  it('supports gcs and azure when the provider is declared', () => {
    expect(
      storageConfigFromEnv({
        [STORAGE_ENV.provider]: 'gcs',
        [STORAGE_ENV.bucket]: 'gcs-bucket',
      }),
    ).toMatchObject({ provider: 'gcs', bucket: 'gcs-bucket' });

    expect(
      storageConfigFromEnv({
        [STORAGE_ENV.container]: 'snapshots',
        [STORAGE_ENV.azureConnectionString]: 'UseDevelopmentStorage=true',
      }),
    ).toMatchObject({
      provider: 'azure',
      container: 'snapshots',
      connectionString: 'UseDevelopmentStorage=true',
    });
  });

  it('treats an explicit local provider as no remote storage', () => {
    expect(
      storageConfigFromEnv({
        [STORAGE_ENV.provider]: 'local',
        [STORAGE_ENV.bucket]: 'ignored',
      }),
    ).toBeUndefined();
  });

  it('fails loudly on an unknown provider or a missing required variable', () => {
    expect(() =>
      storageConfigFromEnv({ [STORAGE_ENV.provider]: 'ftp' }),
    ).toThrow(/Unsupported/);
    expect(() =>
      storageConfigFromEnv({ [STORAGE_ENV.provider]: 's3' }),
    ).toThrow(new RegExp(STORAGE_ENV.bucket));
  });
});

describe('loadConfig storage from environment', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-env-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('uses environment storage when the config does not set any', async () => {
    const config = await loadConfig(dir, {}, undefined, {
      [STORAGE_ENV.bucket]: 'ci-baselines',
    });
    expect(config.storage).toMatchObject({
      provider: 's3',
      bucket: 'ci-baselines',
    });
  });

  it('lets explicit configuration win over the environment', async () => {
    const config = await loadConfig(
      dir,
      { storage: { provider: 'local', outputDir: 'out' } },
      undefined,
      { [STORAGE_ENV.bucket]: 'ci-baselines' },
    );
    expect(config.storage).toMatchObject({ provider: 'local' });
  });
});
