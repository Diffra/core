# Getting started with Diffra

Diffra is an automated visual regression platform designed to run natively inside your GitHub Actions CI/CD pipeline.

---

## The automated CI/CD workflow

Diffra integrates directly into your existing pull request review lifecycle:

```
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │ Developer opens │ ────► │ GitHub Action   │ ────► │ Diff against    │
 │ Pull Request    │       │ builds assets   │       │ Cloud Baselines │
 └─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                              │
 ┌─────────────────┐       ┌─────────────────┐                │
 │ PR merged into  │ ◄──── │ Developer views │ ◄──────────────┘
 │ main: Baselines │       │ review link on  │   PR Comment & Check
 │ auto-promoted   │       │ Pull Request    │   posted automatically
 └─────────────────┘       └─────────────────┘
```

1. **Push or Pull Request**: A developer opens or updates a pull request.
2. **Automated headless capture**: Your GitHub Actions runner executes the Diffra action, captures screenshots for each target in parallel, and computes perceptual differences against the cloud baseline (`origin/main`).
3. **Automated PR review link**: Diffra posts a status check and rich comment directly on the PR linking to the visual review report (`https://viewer.diffra.dev/?report=...`).
4. **Auto-accept on merge**: When the pull request merges into `main`, candidate screenshots are automatically accepted into your private cloud storage as the updated baseline.

---

## 3-step setup

### Step 1: Install packages

Add Diffra to your repository:

```bash
pnpm add -D @diffra/cli @diffra/core @diffra/engine
```

### Step 2: Configure your driver

Create `diffra.config.ts` in your repository root:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  drivers: 'storybook',
  snapshot: {
    diffThreshold: 0.05,
  },
});
```

### Step 3: Add the GitHub Action

Add `.github/workflows/visual-regression.yml`:

```yaml
name: Visual Regression

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history needed for git merge-base

      - uses: pnpm/action-setup@v3
        with:
          version: 10

      - run: pnpm install --frozen-lockfile
      - run: pnpm build-storybook

      - name: Run Diffra
        uses: Diffra/core@v1
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          storybookBuildDir: 'storybook-static'
          autoAcceptChanges: 'main'
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          DIFFRA_STORAGE_BUCKET: 'my-team-baselines'
          DIFFRA_STORAGE_REGION: 'us-east-1'
```

---

## Choose your quickstart

Select the quickstart guide that matches your framework:

* **[Storybook quickstart](storybook-quickstart.md)**: Automated CI/CD setup for Storybook 7/8/9 with React, Vue, Svelte, and Vite.
* **[Web applications quickstart](web-apps-quickstart.md)**: Automated CI/CD setup for Next.js, Remix, Vite, Astro, Nuxt, or any running server.
* **[Playwright test runner quickstart](playwright-quickstart.md)**: Visual assertions inside Playwright test suites using `toMatchVisualBaseline`.
* **[GitHub Actions workflow guide](../ci-cd/github-actions.md)**: Advanced CI/CD configuration, secret masking, and sharding.
