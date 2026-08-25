# @diffra/core

Core test execution pipeline, Playwright orchestration, Git merge-base resolution, and pluggable drivers for Diffra.

---

## Overview

`@diffra/core` is the central orchestration package for Diffra. It manages:
* **Target discovery**: Automated discovery of stories from Storybook `index.json`, live web application URLs, local image directories, or Figma design components.
* **Hermetic browser pool**: Dynamic allocation and reuse of Playwright browser instances, contexts, and isolated pages with automatic teardown.
* **Git merge-base resolution**: Deterministic discovery of common Git ancestor commits (`git merge-base`) and baseline snapshot coordinates.
* **Storage and notification plugins**: Pluggable storage providers (S3, Cloudflare R2, Google Cloud Storage, Azure Blob, Local) and notifiers (GitHub Commit Statuses / PR comments, Slack webhooks).
* **Playwright visual matcher**: Custom Playwright matcher `expect(page).toMatchVisualBaseline(name, options)` for seamless end-to-end integration.

---

## Installation

```bash
pnpm add @diffra/core
```

---

## Programmatic API

### Running visual regressions

```typescript
import { runVisualRegression } from '@diffra/core';

const report = await runVisualRegression({
  config: {
    driver: 'storybook',
    storybookUrl: 'http://localhost:6006',
    diffThreshold: 0.05,
    concurrency: 4,
  },
  onProgress: (step, current, total) => {
    console.log(`[${current}/${total}] ${step}`);
  },
});

console.log(`Passed: ${report.summary.passed}, Changed: ${report.summary.changed}`);
```

### Playwright custom visual matcher

```typescript
import { test, expect } from '@playwright/test';
import { toMatchVisualBaseline } from '@diffra/core/playwright';

expect.extend({ toMatchVisualBaseline });

test('landing page visual regression', async ({ page }) => {
  await page.goto('/');
  await expect(page).toMatchVisualBaseline('landing-hero', {
    diffThreshold: 0.05,
  });
});
```

### Pluggable drivers

* `StorybookDriver`: Discovers stories from `index.json` / `stories.json` via local build directory or running dev server.
* `UrlDriver`: Tests responsive web application routes across custom viewport matrices.
* `ImageDriver`: Compares pre-rendered static screenshots and canvas exports directly.
* `FigmaDriver`: Downloads vector component frames via Figma REST API for Design QA.

---

## Package exports

* `@diffra/core`: Top-level runner, approval, report builder, and engine utilities.
* `@diffra/core/config`: Configuration schema definitions and cosmiconfig loader.
* `@diffra/core/drivers`: Pluggable driver base classes and concrete implementations.
* `@diffra/core/playwright`: Custom Playwright visual assertions and matchers.
* `@diffra/core/plugins`: Storage adapters and CI notification plugins.
* `@diffra/core/types`: Complete TypeScript type declarations and interfaces.

---

## License

MIT
