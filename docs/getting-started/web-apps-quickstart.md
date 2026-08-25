# Web applications quickstart

This guide walks you through setting up automated route-level visual regression testing for web applications (Next.js, Remix, Vite, Astro, Nuxt, or any running HTTP server) without needing Storybook.

---

## Step 1: Install dependencies

Install Diffra in your web application repository:

```bash
pnpm add -D @diffra/cli @diffra/core @diffra/engine
```

Ensure Playwright browser binaries are installed:

```bash
pnpm exec playwright install chromium
```

---

## Step 2: Configure route testing

Create a `diffra.config.ts` in your project root:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  // Visual driver for web applications
  driver: 'url',

  // Base URL of your local dev or preview server
  storybookUrl: 'http://localhost:3000',

  // Route paths or custom target configurations
  urls: [
    '/',
    '/pricing',
    {
      url: '/dashboard',
      name: 'Analytics Dashboard',
      group: 'App Routes',
      selector: '#main-content', // Optional selector isolation
      delay: 200,                // Extra time for client-side charts to render
      mask: ['.user-timestamp'], // Mask dynamic DOM elements
    },
  ],

  // Viewport sizes to test
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],
});
```

---

## Step 3: Run route tests

Start your web application local development or preview server:

```bash
pnpm dev
```

In a separate terminal, execute Diffra:

```bash
pnpm diffra test
```

You can also run ad-hoc route tests directly from the CLI without modifying your configuration file:

```bash
pnpm diffra test --driver url --url http://localhost:3000 --urls "/,/pricing,/blog,/contact"
```

---

## Step 4: Approve and review baselines

Approve your initial candidate screenshots:

```bash
pnpm diffra approve
```

Launch the local interactive review viewer to verify rendering across viewports:

```bash
pnpm diffra serve
```

---

## Next steps

* Deep dive into route configuration, selectors, and masks in [Testing web applications and routes](../guides/testing-web-applications.md).
* Learn how to eliminate font and animation flakiness in [Flakiness and determinism](../guides/flakiness-and-determinism.md).
* Configure CI pull request testing in [GitHub Actions workflow](../ci-cd/github-actions.md).
