# Storybook quickstart

This guide gets you up and running with automated visual regression testing for Storybook 7/8/9 in under 5 minutes.

---

## Step 1: Install dependencies

Install Diffra in your Storybook project:

```bash
pnpm add -D @diffra/cli @diffra/core @diffra/engine
```

Ensure Playwright browser binaries are installed:

```bash
pnpm exec playwright install chromium
```

---

## Step 2: Create configuration file

Create a `diffra.config.ts` (or `diffra.config.js`) in your project root:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  // URL of your running Storybook dev server
  storybookUrl: 'http://localhost:6006',

  // Glob patterns matching your CSF story files
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],

  // Default viewports to capture across all stories
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],

  // Perceptual sensitivity threshold (0.00 strict to 1.00 permissive)
  diffThreshold: 0.063,

  // Settle wait time (ms) after component render
  delay: 100,
});
```

---

## Step 3: Run your first visual test

1. Start your Storybook development server in one terminal window:

```bash
pnpm storybook
```

2. Run Diffra in another terminal window:

```bash
pnpm diffra test
```

Diffra reads your Storybook index (`index.json` or live server), launches headless browser workers to capture screenshots, compares them against baseline images, and writes a test run report to `.diffra/runs/<runId>/report.json`.

---

## Step 4: Approve initial baselines

Because this is your first run, candidate screenshots are marked as `added`. Approve them as your baseline:

```bash
pnpm diffra approve
```

Approved baseline images are stored in `.diffra/baselines/` and can be committed to Git or synced to private cloud storage.

---

## Step 5: Review visual changes locally

To review diffs in the interactive Scandinavian review viewer:

```bash
pnpm diffra serve
```

Navigate to `http://localhost:9000` to inspect visual differences with side-by-side, swipe slider, onion skin, and neon movement highlight modes.

---

## Next steps

* Learn about story-level configuration and the `play` function in [Testing Storybook components](../guides/testing-storybook-components.md).
* Set up automated pull request testing in [GitHub Actions workflow](../ci-cd/github-actions.md).
* Read the [Storybook snapshot parameters](../reference/story-parameters.md) reference.
