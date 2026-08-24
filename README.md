# Diffra

A self-hosted, zero-dependency visual regression testing platform for Storybook, modern design systems, and web applications.

Diffra catches visual bugs and unintended layout shifts automatically on every commit and pull request. It runs entirely within your existing CI/CD environment with zero subscription fees, no screenshot limits, and complete data privacy.

---

## Why choose Diffra?

Traditional cloud-hosted visual testing platforms charge recurring subscription fees per screenshot, impose strict concurrency caps, and require sending proprietary UI mockups and internal assets to third-party servers.

Diffra gives you full control and ownership of your visual regression testing pipeline:

* **Zero subscription costs**: Run unlimited visual regression tests without screenshot quotas, per-seat billing, or tier limits.
* **Complete data privacy**: Screenshots and baselines stay entirely within your infrastructure (local disk or your own private cloud storage bucket).
* **Self-hosted and self-contained**: Built as a lightweight CLI and GitHub Action that runs natively on your existing CI runners.
* **Storybook and web app ready**: Native discovery for Storybook CSF stories, responsive viewports, custom delays, and standalone route URLs.
* **Interactive local review UI**: Self-contained visual reports with side-by-side, swipe slider, onion skin, and diff mask inspection modes.
* **Deterministic baseline management**: Automatic Git merge-base baseline discovery and single-command baseline promotion ().

---

## How it works

1. **Target discovery**: Diffra parses your Storybook stories or route lists to identify all component states and viewport configurations.
2. **Headless capture**: A parallel browser pool renders each component in clean isolation, freezing CSS animations and waiting for web fonts to stabilize.
3. **Pixel comparison**: Candidate screenshots are compared against the target branch baselines using perceptual color difference algorithms.
4. **Interactive report & review**: Diffra compiles a standalone interactive HTML report and posts a summary directly to your pull request.
5. **Approval**: Approved changes are promoted as the new baseline when PRs are merged.

---

## Quickstart

### 1. Installation

```bash
pnpm add -D @diffra/cli @diffra/core @diffra/diff
```

### 2. Configuration

Create a `diffra.config.ts` in your project root:

```typescript
import { defineConfig } from '@diffra/core';

export default defineConfig({
  storybookUrl: 'http://localhost:6006',
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],
  threshold: 0.063,
  delay: 100,
});
```

### 3. Run visual tests

```bash
# Run visual tests against your running Storybook or dev server
diffra test

# Start the interactive review report viewer
diffra serve

# Approve candidate screenshots as the new baseline
diffra approve
```

---

## Continuous integration

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
          fetch-depth: 0

      - name: Setup Node.js and pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11

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

---

## Documentation

Explore the full documentation guides:

* [Getting started guide](docs/getting-started.md): Step-by-step onboarding walkthrough for new projects.
* [Storybook integration](docs/storybook-integration.md): Story-level configuration with `parameters.snapshot`.
* [Command-line interface (CLI)](docs/cli.md): Reference for all CLI commands, arguments, and flags.
* [Configuration reference](docs/configuration.md): Complete configuration schema and TypeScript options.
* [Storage drivers and plugins](docs/plugins-and-storage.md): Local disk, Amazon S3, Cloudflare R2, Google Cloud Storage, Azure Blob, and Slack notifications.
* [CI/CD workflows and GitHub Action](docs/ci-cd-workflows.md): Pull request integration, sticky comment markers, and baseline caching.
* [Review interface guide](docs/viewer-guide.md): How to use the interactive comparison UI and inspection modes.
* [Architecture and core engine](docs/architecture.md): Monorepo structure, comparison algorithm, and execution pipeline.

---

## Monorepo packages

| Package | Directory | Description |
| :--- | :--- | :--- |
| `@diffra/cli` | `packages/cli` | Zero-dependency command-line binary (`diffra`) |
| `@diffra/core` | `packages/core` | Core test runner, browser coordinator, AST parser, and report inliner |
| `@diffra/diff` | `packages/diff` | High-performance pixel comparison engine with SIMD acceleration |
| `@diffra/viewer` | `packages/viewer` | Standalone interactive review UI bundle |
| `@diffra/action` | `packages/action` | GitHub Action runner for CI/CD pipelines |
| `@diffra/storybook` | `packages/storybook` | Showcase design system with Storybook 8 and React 19 |

---

## License

MIT
