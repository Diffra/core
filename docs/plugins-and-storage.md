# Drivers, plugins, storage, and extensibility

Diffra provides a decoupled, modular driver architecture allowing downstream consumers to customize target discovery, capture execution, storage backends, notification channels, diff engines, and test lifecycle plugins.

---

## 1. Visual drivers

Visual drivers are responsible for discovering testable UI targets (`VisualTarget`) and capturing candidate screenshots.

### Built-in Storybook driver
The default driver for Storybook component libraries, extracting CSF story metadata and parameters:

```typescript
import { defineConfig, createStorybookDriver } from '@diffra/core';

export default defineConfig({
  driver: 'storybook', // or createStorybookDriver()
  storybookUrl: 'http://localhost:6006',
});
```

### Built-in URL driver
For testing arbitrary web applications, static sites (Next.js, Astro, VitePress, Nuxt), or production routes:

```typescript
import { defineConfig } from '@diffra/core';

export default defineConfig({
  driver: 'url',
  storybookUrl: 'http://localhost:3000', // base preview URL
  urls: [
    '/',
    '/pricing',
    {
      url: '/dashboard',
      name: 'Analytics Dashboard',
      group: 'App',
      selector: '#analytics-grid', // optional selector isolation
      delay: 150,
      diffThreshold: 0.05,
    },
  ],
});
```

### Built-in Image driver
For comparing pre-rendered images, Figma design exports, or canvas renders without launching a headless browser:

```typescript
import { defineConfig } from '@diffra/core';

export default defineConfig({
  driver: 'image',
  imagesDir: './screenshots/candidates',
});
```

### Custom downstream visual driver
Downstream consumers can supply arbitrary custom discovery and capture logic (e.g. Cypress flows, custom Playwright interactions, or mobile canvas):

```typescript
import { defineConfig, VisualDriver } from '@diffra/core';

const customE2EDriver: VisualDriver = {
  name: 'custom-e2e-driver',
  async setup(context) {
    // Start local server or initialize external services
  },
  async discover(context) {
    return [
      {
        id: 'flow--checkout-modal',
        name: 'Checkout Modal',
        group: 'Checkout Flows',
      },
    ];
  },
  async capture(task, context) {
    // Custom Playwright or external capture returning PNG buffer
    return myCustomCaptureScript(task.target.id, task.viewport);
  },
  async teardown(context) {
    // Teardown background processes
  },
};

export default defineConfig({
  driver: customE2EDriver,
});
```

---

## 2. Storage drivers

Storage adapters manage uploading candidate screenshots, downloading baseline images, persisting diff masks, and saving JSON test reports.

### Local filesystem driver
Default driver for local testing or CI pipelines that cache artifacts to disk:

```typescript
import { defineConfig, createLocalStorage } from '@diffra/core';

export default defineConfig({
  storage: createLocalStorage({
    outputDir: '.diffra',
    baselineDir: '.diffra/baselines',
  }),
});
```

### Amazon S3 and S3-compatible backends (Cloudflare R2, MinIO)
Uploads screenshots and reports directly to object storage:

```typescript
import { defineConfig, createS3Storage } from '@diffra/core';

export default defineConfig({
  storage: createS3Storage({
    bucket: 'my-visual-baselines',
    region: 'us-east-1',
    prefix: 'diffra',
    // endpoint: 'https://<account_id>.r2.cloudflarestorage.com' // For Cloudflare R2
  }),
});
```

### Google Cloud Storage (GCS)
```typescript
import { defineConfig, createGCSStorage } from '@diffra/core';

export default defineConfig({
  storage: createGCSStorage({
    bucket: 'gcs-visual-baselines',
    prefix: 'diffra',
  }),
});
```

### Azure Blob Storage
```typescript
import { defineConfig, createAzureStorage } from '@diffra/core';

export default defineConfig({
  storage: createAzureStorage({
    container: 'visual-baselines',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  }),
});
```

### Custom storage adapter
Downstream consumers can implement the `StorageAdapter` interface:

```typescript
import { defineConfig, StorageAdapter } from '@diffra/core';

const customStorage: StorageAdapter = {
  name: 'my-internal-storage-service',
  async uploadCandidate(runId, storyId, viewport, buffer) {
    const res = await myApiClient.upload(`/runs/${runId}/${storyId}.png`, buffer);
    return res.url;
  },
  async uploadDiff(runId, storyId, viewport, buffer) {
    const res = await myApiClient.upload(`/diffs/${runId}/${storyId}.png`, buffer);
    return res.url;
  },
  async downloadBaseline(baselineCommit, storyId, viewport) {
    return await myApiClient.download(`/baselines/${baselineCommit}/${storyId}.png`);
  },
  async uploadBaseline(commitSha, storyId, viewport, buffer) {
    await myApiClient.upload(`/baselines/${commitSha}/${storyId}.png`, buffer);
  },
  async saveReport(report) {
    return await myApiClient.post('/reports', report);
  },
};

export default defineConfig({
  storage: customStorage,
});
```

---

## 3. Notification drivers

Notifiers execute at the conclusion of a test run to update CI status checks or post summaries to communication channels.

### GitHub commit checks and pull request comments
Updates the commit status check context `diffra/visual-tests` and maintains a single sticky comment on the pull request:

```typescript
import { defineConfig, createGitHubNotifier } from '@diffra/core';

export default defineConfig({
  notifiers: [
    createGitHubNotifier({
      token: process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPOSITORY,
      prNumber: process.env.GITHUB_PR_NUMBER ? parseInt(process.env.GITHUB_PR_NUMBER, 10) : undefined,
    }),
  ],
});
```

### Slack webhook alerts
Posts structured notification cards with pass/fail metrics directly to a Slack channel:

```typescript
import { defineConfig, createSlackNotifier } from '@diffra/core';

export default defineConfig({
  notifiers: [
    createSlackNotifier({
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: '#design-system-ci',
    }),
  ],
});
```

---

## 4. Custom lifecycle plugins

Downstream consumers can hook into every stage of the test pipeline using `DiffraPlugin`:

```typescript
import { defineConfig, DiffraPlugin } from '@diffra/core';

const customAuditPlugin: DiffraPlugin = {
  name: 'custom-audit-plugin',
  setup(config) {
    console.log('Diffra runner initializing...');
  },
  onDiscoverStories(stories) {
    // Modify, filter, or augment discovered stories
    return stories.filter((s) => !s.filePath?.includes('draft'));
  },
  onBeforeCapture(story, viewport) {
    // Custom pre-capture logic
  },
  onAfterCapture(story, viewport, buffer) {
    // Custom post-processing on captured image buffer
    return buffer;
  },
  onTestComplete(report) {
    console.log(`Pipeline complete: ${report.summary.changed} visual differences.`);
  },
};

export default defineConfig({
  plugins: [customAuditPlugin],
});
```
