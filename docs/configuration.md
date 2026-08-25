# Configuration reference

Diffra supports type-safe configuration via `diffra.config.ts`, `diffra.config.js`, or `.diffrarc.json`.

---

## Configuration schema

```typescript
import { defineConfig } from '@diffra/core/config';
import {
  createLocalStorage,
  createS3Storage,
  createGitHubNotifier,
  createSlackNotifier,
} from '@diffra/core/plugins';

export default defineConfig({
  // URL of the running Storybook server
  storybookUrl: 'http://localhost:6006',

  // Glob patterns matching story files
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],

  // Default responsive viewports
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ],

  // Default perceptual color diff threshold (0.00 strict to 1.00 permissive)
  threshold: 0.08,

  // Stabilization wait delay in milliseconds before taking screenshot
  delay: 150,

  // Number of parallel Playwright browser instances
  concurrency: 4,

  // Target Git branch for merge-base baseline discovery
  baselineBranch: 'origin/main',

  // Output directory for reports and candidate screenshots
  outputDir: '.diffra',

  // Pluggable storage driver (local, S3/R2, GCS, Azure, or custom adapter)
  storage: createLocalStorage({
    baselineDir: '.diffra/baselines',
  }),

  // Notification drivers
  notifiers: [
    createGitHubNotifier(),
    createSlackNotifier({
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: '#design-system-ci',
    }),
  ],
});
```

---

## Available options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `storybookUrl` | `string` | `'http://localhost:6006'` | Storybook server URL. |
| `stories` | `string[]` | `['src/**/*.stories.@(js\|jsx\|ts\|tsx)']` | Glob patterns for CSF story files. |
| `viewports` | `(number \| Viewport)[]` | `[{ width: 1280, height: 800, name: 'desktop' }]` | Viewports to capture. Numeric values are treated as widths with height `800`. |
| `threshold` | `number` | `0.1` | Global color delta threshold (from `0.0` strict to `1.0` permissive). |
| `delay` | `number` | `100` | Milliseconds to wait after page load before taking screenshot. |
| `concurrency` | `number` | `4` | Number of parallel browser workers in the Playwright pool. |
| `outputDir` | `string` | `'.diffra'` | Output directory for reports and screenshots. |
| `baselineBranch` | `string` | `'origin/main'` | Target Git branch for baseline discovery. |
| `storage` | `StorageAdapter \| object` | `{ type: 'local' }` | Storage driver or custom storage adapter. |
| `notifiers` | `NotifierAdapter[]` | `[]` | Notification drivers (GitHub, Slack, or custom). |
| `diffEngine` | `DiffEngineAdapter` | Native Rust SIMD | Custom perceptual diff comparison engine. |
| `plugins` | `DiffraPlugin[]` | `[]` | Lifecycle plugins for custom pipeline hooks. |
