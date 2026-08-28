export * from './azure.js';
export * from './gcs.js';
export * from './local.js';
export * from './s3.js';

import type { DiffraConfig, StorageAdapter } from '../../types/index.js';
import { createAzureStorage } from './azure.js';
import { createGCSStorage } from './gcs.js';
import { createLocalStorage } from './local.js';
import { createS3Storage } from './s3.js';

function isStorageAdapter(val: unknown): val is StorageAdapter {
  return (
    typeof val === 'object' &&
    val !== null &&
    'uploadCandidate' in val &&
    typeof (val as { uploadCandidate: unknown }).uploadCandidate === 'function'
  );
}

/**
 * Resolves the configured storage adapter plugin.
 * Downstream consumers can supply their own custom StorageAdapter object or configure built-in plugins.
 */
export function resolveStorageAdapter(
  config: DiffraConfig,
  cwd = process.cwd(),
): StorageAdapter {
  // If custom storage adapter object was passed directly
  if (isStorageAdapter(config.storage)) {
    return config.storage;
  }

  const storageConfig =
    typeof config.storage === 'object' && config.storage !== null
      ? config.storage
      : { provider: 'local' as const };

  if (storageConfig.provider === 's3') {
    return createS3Storage({
      bucket: storageConfig.bucket,
      prefix: storageConfig.prefix,
      region: storageConfig.region,
      endpoint: storageConfig.endpoint,
    });
  }

  if (storageConfig.provider === 'gcs') {
    return createGCSStorage({
      bucket: storageConfig.bucket,
      prefix: storageConfig.prefix,
    });
  }

  if (storageConfig.provider === 'azure') {
    return createAzureStorage({
      container: storageConfig.container,
      connectionString: storageConfig.connectionString,
      prefix: storageConfig.prefix,
    });
  }

  return createLocalStorage({
    outputDir:
      ('outputDir' in storageConfig && storageConfig.outputDir) || '.diffra',
    baselineDir:
      ('dir' in storageConfig && storageConfig.dir) || '.diffra/baselines',
    cwd,
  });
}
