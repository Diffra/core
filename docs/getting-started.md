# Getting started with Diffra

This guide walks you through setting up automated visual regression testing in your project from scratch.

---

## What is visual regression testing?

Visual regression testing captures screenshots of your UI components and pages, comparing them against approved baseline images on every code change. When visual differences are detected, Diffra generates an interactive visual diff report highlighting exactly what pixels changed, preventing unintended styling bugs before they reach production.

---

## Step 1: Install Diffra

Install the CLI and core packages as development dependencies in your project:

```bash
pnpm add -D @diffra/cli @diffra/core @diffra/diff
```

Or using npm / yarn:

```bash
npm install --save-dev @diffra/cli @diffra/core @diffra/diff
```

---

## Step 2: Create your configuration file

Create a `diffra.config.ts` (or `diffra.config.js`) file in the root of your project:

```typescript
import { defineConfig } from '@diffra/core';

export default defineConfig({
  // URL to your running Storybook or local web server
  storybookUrl: 'http://localhost:6006',

  // Glob patterns matching your CSF story files
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],

  // Default viewports to capture
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],

  // Color difference threshold (0 to 1, default: 0.063)
  threshold: 0.063,

  // Settle wait time in ms after rendering
  delay: 100,
});
```

---

## Step 3: Run your first visual test

Ensure your Storybook or local development server is running:

```bash
# Terminal 1: Start Storybook
pnpm storybook
```

Then run Diffra in a separate terminal:

```bash
# Terminal 2: Run visual tests
pnpm diffra test
```

Diffra will:
1. Discover all visual targets and stories.
2. Launch parallel headless browsers to capture screenshots.
3. Compare candidate screenshots against existing baselines (or register them if this is your first run).
4. Generate a self-contained interactive HTML review report in `.diffra/runs/<runId>/index.html`.

---

## Step 4: Review and approve baselines

When you first run Diffra or when you intentionally update a component design, approve the candidate images as the new baseline:

```bash
pnpm diffra approve
```

Your approved baselines are saved into `.diffra/baselines` and can be committed to Git or stored in your cloud bucket.

---

## Step 5: Start the local review report server

To inspect visual diffs in the interactive browser viewer:

```bash
pnpm diffra serve
```

This starts a local review server at `http://localhost:9000` with:
* Side-by-side comparison mode
* Interactive swipe slider mode
* Onion-skin opacity blending
* Highlighted difference mask overlay

---

## Step 6: Automate in CI/CD

Add Diffra to your GitHub Actions workflow (`.github/workflows/visual-tests.yml`):

```yaml
name: Visual Regression Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full git history required for baseline discovery

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Run Diffra visual regression
        uses: Rawlings/diffra@v1
        with:
          storybookBuildDir: 'storybook-static'
          token: ${{ secrets.GITHUB_TOKEN }}
```

When a pull request is opened, Diffra automatically runs visual checks against the target base branch and posts a detailed sticky comment summarizing any visual regressions.

---

## Next steps

* Learn about story-level configuration in [Storybook integration](storybook-integration.md).
* Explore cloud storage adapters (S3, Cloudflare R2, Google Cloud Storage, Azure Blob) in [Storage drivers and plugins](plugins-and-storage.md).
* Review all available CLI flags and options in [Command-line interface (CLI)](cli.md).
