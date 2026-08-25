export * from './azure.js';
export * from './gcs.js';
export * from './local.js';
export * from './s3.js';

import type { DiffraConfig, StorageAdapter } from '../../types/index.js';
import { createAzureStorage } from './azure.js';
import { createGCSStorage } from './gcs.js';
import { createLocalStorage } from './local.js';
import { createS3Storage } from './s3.js';

/**
 * Resolves the configured storage adapter plugin.
 * Downstream consumers can supply their own custom StorageAdapter object or configure built-in plugins.
 */
export function resolveStorageAdapter(
  config: DiffraConfig,
  cwd = process.cwd(),
): StorageAdapter {
  // If custom storage adapter object was passed directly
  if (
    config.storage &&
    typeof (config.storage as StorageAdapter).uploadCandidate === 'function'
  ) {
    return config.storage as StorageAdapter;
  }

  const storageConfig = (
    typeof config.storage === 'object' && config.storage !== null
      ? config.storage
      : { provider: 'local' }
  ) as any;

  const provider = storageConfig.provider || storageConfig.type || 'local';

  if (provider === 's3') {
    return createS3Storage({
      bucket: storageConfig.bucket || storageConfig.s3?.bucket,
      prefix: storageConfig.prefix || storageConfig.s3?.prefix,
      region: storageConfig.region || storageConfig.s3?.region,
      endpoint: storageConfig.endpoint || storageConfig.s3?.endpoint,
    });
  }

  if (provider === 'gcs') {
    return createGCSStorage({
      bucket: storageConfig.bucket || storageConfig.gcs?.bucket,
      prefix: storageConfig.prefix || storageConfig.gcs?.prefix,
    });
  }

  if (provider === 'azure') {
    return createAzureStorage({
      container: storageConfig.container || storageConfig.azure?.container,
      connectionString:
        storageConfig.connectionString || storageConfig.azure?.connectionString,
      prefix: storageConfig.prefix || storageConfig.azure?.prefix,
    });
  }

  return createLocalStorage({
    outputDir: storageConfig.outputDir || '.diffra',
    baselineDir: storageConfig.dir || storageConfig.local?.baselineDir || '.diffra/baselines',
    cwd,
  });
}
