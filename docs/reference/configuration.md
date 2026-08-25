# Configuration reference

Diffra supports type-safe configuration via `diffra.config.ts`, `diffra.config.js`, or `.diffrarc.json`.

---

## Example configuration

```typescript
import { defineConfig } from '@diffra/core/config';
import { devices } from 'playwright';

export default defineConfig({
  // Domain 1: Drivers & Preview Servers
  drivers: [
    {
      driver: 'storybook',
      url: 'http://localhost:6006',
    },
  ],

  // Domain 2: Snapshot & Comparison Rules
  snapshot: {
    diffThreshold: 0.063,
    delay: 100,
    pauseAnimationAtEnd: true,
    viewports: [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
    ],
  },

  // Domain 3: Browser Workers & CI Execution
  runner: {
    concurrency: 4,
    baselineBranch: 'origin/main',
    projects: [
      {
        name: 'desktop-chromium',
        browser: 'chromium',
        use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
      },
      {
        name: 'mobile-safari',
        browser: 'webkit',
        use: { ...devices['iPhone 15'], colorScheme: 'light' },
      },
    ],
  },

  // Domain 4: Baseline Persistence
  storage: {
    provider: 's3',
    bucket: 'my-visual-baselines',
    region: 'us-east-1',
  },

  // Domain 5: Notifications & PR Status Checks
  reporters: [
    'github',
    {
      type: 'slack',
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: '#design-system-ci',
    },
  ],
});
```

---

## 5-domain configuration reference

### Domain 1: `drivers`
Defines visual targets and preview server endpoints. Accepts single driver names (`'storybook'`, `'url'`, `'image'`, `'figma'`), driver configuration objects, or custom `VisualDriver` implementations:

| Driver Config | Options | Description |
| :--- | :--- | :--- |
| `StorybookDriverConfig` | `{ driver: 'storybook', url?: string, buildDir?: string }` | Discovers and captures Storybook component stories. |
| `UrlDriverConfig` | `{ driver: 'url', baseUrl?: string, urls: Array<string \| UrlTargetConfig> }` | Discovers and captures static or SPA web routes. |
| `ImageDriverConfig` | `{ driver: 'image', dir: string }` | Loads pre-rendered screenshots from disk. |
| `FigmaDriverConfig` | `{ driver: 'figma', fileKey: string, token?: string, components?: Record<string, string> }` | Fetches frames directly from Figma REST API. |

### Domain 2: `snapshot`
Configures visual comparison and screenshot parameters:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `diffThreshold` | `number` | `0.063` | Perceptual sensitivity threshold (`0.0` strict to `1.0` permissive). |
| `delay` | `number` | `100` | Post-render wait delay in milliseconds before taking screenshot. |
| `pauseAnimationAtEnd` | `boolean` | `true` | Freezes CSS transitions and animations at final frame. |
| `viewports` | `(number \| Viewport)[]` | `[{ width: 1280, height: 800, name: 'desktop' }]` | Viewport dimensions to capture. |
| `selector` | `string` | `undefined` | CSS selector of specific element to capture. |
| `mask` | `(string \| Locator)[]` | `[]` | Selectors or Playwright Locators to mask with solid pink. |
| `fullPage` | `boolean` | `false` | Whether to take a full-page scroll screenshot. |

### Domain 3: `runner`
Configures parallel browser worker execution and CI integration:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `concurrency` | `number` | `4` | Number of parallel browser workers. |
| `baselineBranch` | `string` | `undefined` (auto) | Optional target branch override. When omitted, automatically discovered via CI PR target (`GITHUB_BASE_REF`), upstream tracking ref, `origin/HEAD`, or topological nearest-neighbor DAG merge base. |
| `shard` | `string` | `undefined` | Shard coordinate (e.g. `"1/4"`). |
| `projects` | `Project[]` | `[{ name: 'chromium', browser: 'chromium' }]` | Playwright projects and browser engines (`chromium`, `firefox`, `webkit`). |
| `launchOptions` | `LaunchOptions` | `undefined` | Custom Playwright browser launch options. |

### Domain 4: `storage`
Configures baseline and candidate storage:

| Provider | Options | Description |
| :--- | :--- | :--- |
| `local` | `{ provider: 'local', dir?: string }` | Local disk storage (default `.diffra/baselines`). |
| `s3` | `{ provider: 's3', bucket: string, region?: string, prefix?: string }` | AWS S3 or MinIO cloud baseline bucket. |
| `gcs` | `{ provider: 'gcs', bucket: string, prefix?: string }` | Google Cloud Storage bucket. |
| `azure` | `{ provider: 'azure', container: string, connectionString?: string }` | Azure Blob Storage container. |

### Domain 5: `reporters`
Configures PR sticky comments, status checks, and messaging alerts:

| Reporter | Options | Description |
| :--- | :--- | :--- |
| `github` | `'github'` or `{ type: 'github', token?: string, repo?: string }` | Posts sticky PR comments and commit status checks. |
| `slack` | `{ type: 'slack', webhookUrl: string, channel?: string }` | Sends visual test alerts to Slack incoming webhook. |
| `json` | `{ type: 'json', outputFile?: string }` | Emits structured test run report JSON. |
