# Storage adapters

Diffra decouples baseline storage from the test runner via pluggable storage adapters. Screenshots and test reports can be stored on local disk or synced directly to private cloud storage buckets without third-party SaaS vendors.

---

## 1. Local filesystem adapter (Default)

Stores baselines under `.diffra/baselines/` and test runs under `.diffra/runs/`:

```typescript
import { defineConfig } from '@diffra/core/config';
import { createLocalStorage } from '@diffra/core/plugins';

export default defineConfig({
  storage: createLocalStorage({
    outputDir: '.diffra',
    baselineDir: '.diffra/baselines',
  }),
});
```

---

## 2. Amazon S3 and S3-compatible backends (Cloudflare R2, MinIO)

Uploads candidate screenshots, baseline images, and JSON manifests directly to S3 or S3-compatible object storage:

```typescript
import { defineConfig } from '@diffra/core/config';
import { createS3Storage } from '@diffra/core/plugins';

export default defineConfig({
  storage: createS3Storage({
    bucket: 'my-visual-baselines',
    region: 'us-east-1',
    prefix: 'diffra',
    // endpoint: 'https://<account_id>.r2.cloudflarestorage.com', // Cloudflare R2
  }),
});
```

### Authentication
The S3 adapter uses standard AWS SDK environment variables:
* `AWS_ACCESS_KEY_ID`
* `AWS_SECRET_ACCESS_KEY`
* `AWS_REGION`

---

## 3. Google Cloud Storage (GCS)

```typescript
import { defineConfig } from '@diffra/core/config';
import { createGCSStorage } from '@diffra/core/plugins';

export default defineConfig({
  storage: createGCSStorage({
    bucket: 'gcs-visual-baselines',
    prefix: 'diffra',
  }),
});
```

### Authentication
Authenticate via `GOOGLE_APPLICATION_CREDENTIALS` or Workload Identity Federation in Google Cloud environments.

---

## 4. Azure Blob Storage

```typescript
import { defineConfig } from '@diffra/core/config';
import { createAzureStorage } from '@diffra/core/plugins';

export default defineConfig({
  storage: createAzureStorage({
    container: 'visual-baselines',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    prefix: 'diffra',
  }),
});
```

---

## 5. Custom storage adapter implementation

Implement the `StorageAdapter` interface to connect Diffra to internal proprietary object storage or database APIs:

```typescript
import { defineConfig } from '@diffra/core/config';
import type { StorageAdapter } from '@diffra/core';

const customInternalStorage: StorageAdapter = {
  name: 'custom-internal-storage',

  async init() {
    // Initialize storage client
  },

  async uploadCandidate(runId, targetId, viewport, buffer, options) {
    const key = `runs/${runId}/${targetId}-${viewport.name}.png`;
    await myStorageClient.put(key, buffer);
    return `https://storage.internal.net/${key}`;
  },

  async uploadDiff(runId, targetId, viewport, buffer, options) {
    const key = `diffs/${runId}/${targetId}-${viewport.name}.png`;
    await myStorageClient.put(key, buffer);
    return `https://storage.internal.net/${key}`;
  },

  async downloadBaseline(baselineCommit, targetId, viewport, options) {
    const key = `baselines/${baselineCommit}/${targetId}-${viewport.name}.png`;
    try {
      return await myStorageClient.getBuffer(key);
    } catch {
      return null;
    }
  },

  async uploadBaseline(commitSha, targetId, viewport, buffer, options) {
    const key = `baselines/${commitSha}/${targetId}-${viewport.name}.png`;
    await myStorageClient.put(key, buffer);
  },

  async saveReport(report) {
    const key = `runs/${report.runId}/report.json`;
    await myStorageClient.put(key, Buffer.from(JSON.stringify(report)));
    return key;
  },
};

export default defineConfig({
  storage: customInternalStorage,
});
```
