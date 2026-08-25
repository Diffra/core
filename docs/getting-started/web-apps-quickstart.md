# Web applications quickstart

Set up automated route-level visual regression testing for web applications (Next.js, Remix, Vite, Astro, Nuxt) in your GitHub Actions CI/CD pipeline in under 5 minutes.

---

## The automated CI/CD workflow

Diffra tests your production build or preview server directly inside GitHub Actions on every pull request:

```
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │ Developer opens │ ────► │ GitHub Action   │ ────► │ Diff against    │
 │ Pull Request    │       │ builds app routes│      │ Cloud Baselines │
 └─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                              │
 ┌─────────────────┐       ┌─────────────────┐                │
 │ PR merged into  │ ◄──── │ Developer views │ ◄──────────────┘
 │ main: Baselines │       │ review link on  │   PR Comment & Check
 │ auto-promoted   │       │ Pull Request    │   posted automatically
 └─────────────────┘       └─────────────────┘
```

---

## Step 1: Install packages

Install Diffra in your web application repository:

```bash
pnpm add -D @diffra/cli @diffra/core @diffra/engine
```

---

## Step 2: Configure route testing

Create a `diffra.config.ts` in your project root:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  // Domain 1: Driver & Routes
  drivers: {
    driver: 'url',
    baseUrl: 'http://localhost:4173',
    urls: [
      '/',
      '/pricing',
      {
        url: '/dashboard',
        name: 'Analytics Dashboard',
        group: 'App Routes',
        snapshot: {
          selector: '#main-content', // Optional selector isolation
          delay: 200,                // Extra wait time for client-side rendering
          mask: ['.user-timestamp'], // Mask dynamic timestamps
        },
      },
    ],
  },

  // Domain 2: Viewport and capture rules
  snapshot: {
    viewports: [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'desktop', width: 1280, height: 800 },
    ],
  },
});
```

---

## Step 3: Add GitHub Actions workflow

Create `.github/workflows/visual-regression.yml`:

```yaml
name: Web App Visual Regression

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history needed for Git merge-base baseline discovery

      - uses: pnpm/action-setup@v3
        with:
          version: 10

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      # Start production preview server in background
      - name: Start preview server
        run: pnpm preview --port 4173 &
        env:
          PORT: 4173

      - name: Wait for preview server
        run: npx wait-on http://localhost:4173 --timeout 30000

      - name: Run Diffra Action
        uses: Diffra/core@v1
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          storybookUrl: 'http://localhost:4173'
          autoAcceptChanges: 'main'
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          DIFFRA_STORAGE_BUCKET: 'my-app-baselines'
          DIFFRA_STORAGE_REGION: 'us-east-1'
```

---

## Step 4: Open a pull request

1. Push your branch to GitHub and open a Pull Request.
2. The GitHub Action executes, captures screenshots across all configured routes and viewports, and compares them against `main` baselines in your cloud storage.
3. A status check and PR comment are automatically posted with a direct link to the visual review UI (`https://viewer.diffra.dev/?report=...`).
4. Merging the PR into `main` automatically promotes candidate screenshots to cloud storage as the new baseline.

---

## Next steps

* Deep dive into route configuration, selectors, and masks in [Testing web applications and routes](../guides/testing-web-applications.md).
* Learn how to eliminate font and animation flakiness in [Flakiness and determinism](../guides/flakiness-and-determinism.md).
* Configure cloud storage providers in [Storage adapters](../storage-and-plugins/storage-adapters.md).
