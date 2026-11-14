import type { StorageConfig } from '../types/index.js';

/** Environment variables that select and configure baseline storage. */
export const STORAGE_ENV = {
  provider: 'DIFFRA_STORAGE_PROVIDER',
  bucket: 'DIFFRA_STORAGE_BUCKET',
  region: 'DIFFRA_STORAGE_REGION',
  prefix: 'DIFFRA_STORAGE_PREFIX',
  endpoint: 'DIFFRA_STORAGE_ENDPOINT',
  container: 'DIFFRA_STORAGE_CONTAINER',
  azureConnectionString: 'AZURE_STORAGE_CONNECTION_STRING',
} as const;

const SUPPORTED_PROVIDERS = ['local', 's3', 'gcs', 'azure'] as const;
type StorageProvider = (typeof SUPPORTED_PROVIDERS)[number];

function isProvider(value: string): value is StorageProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

function requireVar(env: NodeJS.ProcessEnv, name: string, provider: string) {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${STORAGE_ENV.provider} is "${provider}" but ${name} is not set.`,
    );
  }
  return value;
}

/**
 * Derives a storage configuration from environment variables, or returns
 * undefined when none are set. The provider is taken from
 * DIFFRA_STORAGE_PROVIDER, or inferred from which resource variable is present
 * (a bucket means s3, a container means azure).
 */
export function storageConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig | undefined {
  const raw = env[STORAGE_ENV.provider]?.trim().toLowerCase();
  let declared: StorageProvider | undefined;
  if (raw) {
    if (!isProvider(raw)) {
      throw new Error(
        `Unsupported ${STORAGE_ENV.provider} "${raw}". Use one of: ${SUPPORTED_PROVIDERS.join(', ')}.`,
      );
    }
    declared = raw;
  }

  const provider =
    declared ??
    (env[STORAGE_ENV.bucket]
      ? 's3'
      : env[STORAGE_ENV.container]
        ? 'azure'
        : undefined);

  const prefix = env[STORAGE_ENV.prefix] || undefined;

  switch (provider) {
    case undefined:
    case 'local':
      return undefined;
    case 's3':
      return {
        provider,
        bucket: requireVar(env, STORAGE_ENV.bucket, provider),
        region: env[STORAGE_ENV.region] || undefined,
        endpoint: env[STORAGE_ENV.endpoint] || undefined,
        prefix,
      };
    case 'gcs':
      return {
        provider,
        bucket: requireVar(env, STORAGE_ENV.bucket, provider),
        prefix,
      };
    case 'azure':
      return {
        provider,
        container: requireVar(env, STORAGE_ENV.container, provider),
        connectionString: env[STORAGE_ENV.azureConnectionString] || undefined,
        prefix,
      };
  }
}
