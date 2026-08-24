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
      : { type: 'local' }
  ) as {
    type?: string;
    s3?: {
      bucket: string;
      prefix?: string;
      region?: string;
      endpoint?: string;
    };
    gcs?: { bucket: string; prefix?: string };
    azure?: { container: string; connectionString?: string; prefix?: string };
    local?: { baselineDir?: string };
  };

  if (storageConfig.type === 's3' && storageConfig.s3) {
    return createS3Storage({
      bucket: storageConfig.s3.bucket,
      prefix: storageConfig.s3.prefix,
      region: storageConfig.s3.region,
      endpoint: storageConfig.s3.endpoint,
    });
  }

  if (storageConfig.type === 'gcs' && storageConfig.gcs) {
    return createGCSStorage({
      bucket: storageConfig.gcs.bucket,
      prefix: storageConfig.gcs.prefix,
    });
  }

  if (storageConfig.type === 'azure' && storageConfig.azure) {
    return createAzureStorage({
      container: storageConfig.azure.container,
      connectionString: storageConfig.azure.connectionString,
      prefix: storageConfig.azure.prefix,
    });
  }

  return createLocalStorage({
    outputDir: config.outputDir || '.diffra',
    baselineDir: storageConfig.local?.baselineDir || '.diffra/baselines',
    cwd,
  });
}
