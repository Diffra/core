# Getting started with Diffra

This guide walks you through setting up automated visual regression testing for web applications, route lists, and Storybook design systems.

---

## What is visual regression testing?

Visual regression testing captures screenshots of your web pages and UI components, comparing them against approved baseline images on every code change. When visual differences are detected, Diffra generates an interactive visual diff report highlighting exactly what pixels changed, preventing unintended layout shifts and styling bugs before they reach production.

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

## Step 2: Configure Diffra

Create a `diffra.config.ts` (or `diffra.config.js`) in your project root. Choose the configuration that matches your application:

### Option A: Web applications & route testing

Test pages across your web app (e.g. Next.js, Remix, Vite, Astro, or any running server):

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  // Base URL of your local dev server or staging deployment
  storybookUrl: 'http://localhost:3000',

  // List of route URLs or specific page objects to capture
  urls: [
    '/',
    '/pricing',
    {
      url: '/dashboard',
      name: 'Analytics Dashboard',
      selector: '#main-content',
      delay: 200,
    },
  ],

  // Viewport dimensions to test
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],
});
```

### Option B: Storybook & design systems

Test isolated UI components directly from your CSF stories:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  // URL to your running Storybook dev server
  storybookUrl: 'http://localhost:6006',

  // Glob patterns matching your CSF story files
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],

  // Default viewports to capture
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],
});
```

---

## Step 3: Run your first visual test

Ensure your development server or Storybook is running:

```bash
# Run visual regression tests
pnpm diffra test
```

You can also run ad-hoc visual tests against any URL directly from the CLI without a config file:

```bash
pnpm diffra test --driver url --url http://localhost:3000 --urls "/,/pricing,/blog"
```

Diffra will:
1. Discover all visual targets and pages.
2. Launch parallel headless browsers to capture screenshots.
3. Compare candidate screenshots against existing baselines.
4. Generate a self-contained interactive HTML review report in `.diffra/runs/<runId>/index.html`.

---

## Step 4: Review and approve baselines

When you first run Diffra or when you intentionally update a component or page layout, approve the candidate screenshots as the new baseline:

```bash
pnpm diffra approve
```

Your approved baselines are saved into `.diffra/baselines` and can be committed to Git or synced to your cloud storage bucket.

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

      - name: Run Diffra visual regression
        uses: Diffra/core@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

When a pull request is opened, Diffra automatically runs visual checks against the target base branch and posts a detailed sticky comment summarizing any visual regressions.

---

## Next steps

* Explore CLI commands, arguments, and flags in [Command-line interface (CLI)](cli.md).
* Learn about story-level configuration in [Storybook integration](storybook-integration.md).
* Explore cloud storage adapters (S3, Cloudflare R2, Google Cloud Storage, Azure Blob) in [Storage drivers and plugins](plugins-and-storage.md).
* Learn more about CI/CD workflows and PR integration in [CI/CD workflows and GitHub Action](ci-cd-workflows.md).
