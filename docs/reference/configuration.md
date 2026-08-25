# Configuration reference

Diffra supports type-safe configuration via `diffra.config.ts`, `diffra.config.js`, or `.diffrarc.json`.

---

## Example configuration

```typescript
import { defineConfig } from '@diffra/core/config';
import {
  createLocalStorage,
  createS3Storage,
  createGitHubNotifier,
  createSlackNotifier,
} from '@diffra/core/plugins';
import { devices } from 'playwright';

export default defineConfig({
  // Visual target driver ('storybook', 'url', 'image', 'figma', or custom VisualDriver)
  driver: 'storybook',

  // Running server URL
  storybookUrl: 'http://localhost:6006',

  // Glob patterns matching story files
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],

  // Playwright multi-engine projects and device descriptors
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

  // Default viewports when projects are not explicitly defined
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 800 },
  ],

  // Perceptual sensitivity threshold (0.00 strict to 1.00 permissive)
  diffThreshold: 0.063,

  // Settle wait time (ms) before taking screenshot
  delay: 100,

  // Automatically pause CSS animations at final frame
  pauseAnimationAtEnd: true,

  // Number of parallel Playwright browser instances
  concurrency: 4,

  // Target Git branch for merge-base baseline discovery
  baselineBranch: 'origin/main',

  // Output directory for reports and candidate screenshots
  outputDir: '.diffra',

  // Storage adapter configuration
  storage: createLocalStorage({
    baselineDir: '.diffra/baselines',
  }),

  // Notifiers
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

## Configuration schema options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `driver` | `'storybook' \| 'url' \| 'image' \| 'figma' \| VisualDriver` | `'storybook'` | Visual target discovery and capture driver. |
| `drivers` | `(VisualDriver \| string)[]` | `undefined` | Multiple drivers to run sequentially in a single test pass. |
| `storybookUrl` | `string` | `'http://localhost:6006'` | Base preview URL or running Storybook dev server URL. |
| `stories` | `string[]` | `['src/**/*.stories.@(js\|jsx\|ts\|tsx)']` | Glob patterns for CSF story files. |
| `urls` | `Array<string \| UrlTargetConfig>` | `[]` | Route URLs to test with the URL driver. |
| `imagesDir` | `string` | `undefined` | Directory of candidate screenshots for the Image driver. |
| `figma` | `FigmaDriverOptions` | `undefined` | Figma driver options (fileKey, token, components map, mode, scale). |
| `targets` | `VisualTarget[] \| (() => Promise<VisualTarget[]>)` | `undefined` | Explicit in-memory target list or async target provider. |
| `projects` | `Project[]` | `[{ name: 'chromium', browser: 'chromium' }]` | Playwright projects (`chromium`, `firefox`, `webkit`) and devices. |
| `viewports` | `(number \| Viewport)[]` | `[{ width: 1280, height: 800, name: 'desktop' }]` | Viewports to capture when `projects` are not defined. |
| `diffThreshold` / `threshold` | `number` | `0.063` | Perceptual sensitivity threshold (`0.0` strict to `1.0` permissive). |
| `delay` | `number` | `100` | Settle wait time (ms) after page load before taking screenshot. |
| `pauseAnimationAtEnd` | `boolean` | `true` | When `true`, freezes CSS animations and transitions at final frame. |
| `animations` | `'disabled' \| 'allow'` | `'disabled'` | Playwright animation handling mode. |
| `concurrency` | `number` | `4` | Number of parallel browser workers in the Playwright pool. |
| `shard` | `string` | `undefined` | CI sharding slice (e.g. `'1/4'`). |
| `outputDir` | `string` | `'.diffra'` | Output directory for reports and candidate screenshots. |
| `baselineBranch` | `string` | `'origin/main'` | Target Git branch for merge-base baseline discovery. |
| `storage` | `StorageAdapter \| object` | `{ type: 'local' }` | Storage driver or custom storage adapter. |
| `notifiers` | `NotifierAdapter[]` | `[]` | Notification drivers (GitHub, Slack, or custom). |
| `diffEngine` | `DiffEngineAdapter` | Native Rust SIMD | Custom perceptual diff comparison engine. |
| `plugins` | `DiffraPlugin[]` | `[]` | Lifecycle plugins for custom pipeline hooks. |
| `viewerUrl` | `string` | `undefined` | Base URL of deployed review viewer (e.g. GitHub Pages). |
