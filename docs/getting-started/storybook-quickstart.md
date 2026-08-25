# Storybook quickstart

Set up automated visual regression testing for Storybook 7, 8, and 9 in your GitHub Actions CI/CD workflow in under 5 minutes.

---

## The automated CI/CD workflow

Once set up, your visual testing runs completely hands-free on every pull request:

```
 ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
 │ Developer opens │ ────► │ GitHub Action   │ ────► │ Diff against    │
 │ Pull Request    │       │ builds Storybook│       │ Cloud Baselines │
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

Install Diffra in your Storybook project:

```bash
pnpm add -D @diffra/cli @diffra/core @diffra/engine
```

---

## Step 2: Create configuration file

Create a `diffra.config.ts` in your project root:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  // Domain 1: Driver
  drivers: 'storybook',

  // Domain 2: Snapshot rules and viewports
  snapshot: {
    diffThreshold: 0.063,
    delay: 100,
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
name: Storybook Visual Regression

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history required for Git merge-base baseline discovery

      - name: Setup Node.js & pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Run Diffra Action
        uses: Diffra/core@v1
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          storybookBuildDir: 'storybook-static'
          autoAcceptChanges: 'main'
          exitZeroOnChanges: 'true'
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          DIFFRA_STORAGE_BUCKET: 'my-storybook-baselines'
          DIFFRA_STORAGE_REGION: 'us-east-1'
```

---

## Step 4: Open a pull request

1. Commit and push your changes to a new feature branch.
2. Open a Pull Request on GitHub.
3. The Diffra GitHub Action executes automatically, renders your story index, compares candidate screenshots against the `main` branch baselines in your cloud bucket, and posts:
   * **Commit status check**: Passed or changed.
   * **Sticky PR comment**: Direct link to inspect changes in the review UI (`https://viewer.diffra.dev/?report=...`).
4. When the PR merges into `main`, candidate screenshots are automatically promoted to cloud storage as the new baseline.

---

## Optional: Local debugging

For local development or offline visual checks:

```bash
# 1. Run against local Storybook dev server
diffra test --url http://localhost:6006

# 2. View results directly in the review UI
diffra test --open
```

---

## Next steps

* Learn about story-level configuration and the `play` function in [Testing Storybook components](../guides/testing-storybook-components.md).
* Read the [Storybook snapshot parameters](../reference/story-parameters.md) reference.
* Configure alternative storage adapters in [Storage adapters](../storage-and-plugins/storage-adapters.md).
