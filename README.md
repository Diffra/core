# Diffra

Automated visual regression testing natively integrated into your GitHub Actions CI/CD pipeline.

Diffra protects your web applications, design systems, and component libraries from unintended layout shifts and visual breakage on every pull request. It runs directly inside your existing GitHub Actions workflow with zero subscription fees, unlimited snapshots, and complete data privacy in your own cloud storage.

---

## Automated GitHub Actions workflow

Add Diffra to `.github/workflows/visual-regression.yml` to enable automated pull request visual checks in seconds:

```yaml
name: Visual Regression Testing

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  visual-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Needed for Git merge-base baseline resolution

      - name: Setup Node.js and pnpm
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
          DIFFRA_STORAGE_BUCKET: 'my-team-visual-baselines'
          DIFFRA_STORAGE_REGION: 'us-east-1'
```

### How the automated pull request workflow works

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

1. **Pull Request trigger**: Every push or PR automatically triggers your GitHub Actions runner.
2. **Deterministic baseline diffing**: Diffra determines the exact common Git ancestor (`git merge-base`) and streams baseline snapshots on demand from your private cloud bucket (S3, Cloudflare R2, Google Cloud Storage, Azure Blob).
3. **Automated PR review comment**: Diffra posts a status check and rich sticky comment with a direct link to inspect visual changes in the Scandinavian review UI (`https://viewer.diffra.dev/?report=...`).
4. **Auto-approval on merge**: When pull requests merge into `main`, candidate snapshots are automatically promoted as the authoritative baseline for future branches.

---

## Why choose Diffra?

Traditional cloud-hosted visual testing platforms charge monthly subscription fees per screenshot, throttle concurrency, and transmit proprietary UI source code and customer data to external servers.

Diffra gives you full control and ownership of your visual regression testing pipeline:

* **Automated CI/CD first**: Designed specifically to run seamlessly in GitHub Actions and modern CI providers without manual coordination.
* **Zero vendor subscription costs**: Run unlimited visual regression tests without screenshot quotas, per-seat licensing, or tier limits.
* **Complete data privacy**: Screenshots and baselines stay entirely within your infrastructure (local disk or your private cloud storage bucket).
* **Universal testing scope**: Test live web applications, local development servers, staging routes, custom image sets, or Storybook components with first-class pluggable drivers.
* **Hardware-accelerated engine**: Rust SIMD vectorization (AVX2, SSE4.1, ARM NEON) computes perceptual pixel differences at gigapixel/second throughput.
* **Interactive review UI**: Flat, Scandinavian minimalism with four instant comparison modes (movement highlight, side-by-side, split slider, onion skin).

---

## Getting started

Explore the step-by-step CI/CD setup guides for your framework:

* [Storybook quickstart](docs/getting-started/storybook-quickstart.md): Automated CI/CD setup for Storybook 7/8/9.
* [Web applications quickstart](docs/getting-started/web-apps-quickstart.md): Automated CI/CD setup for Next.js, Remix, Vite, and Astro.
* [Playwright test runner quickstart](docs/getting-started/playwright-quickstart.md): Visual assertions in Playwright test suites using `toMatchVisualBaseline`.
* [GitHub Actions workflow guide](docs/ci-cd/github-actions.md): Complete configuration, secret management, and sharding.

---

## Documentation

Explore the complete [Diffra documentation hub](docs/index.md):

* **Guides**:
  * [Testing Storybook components](docs/guides/testing-storybook-components.md)
  * [Testing web applications and routes](docs/guides/testing-web-applications.md)
  * [Playwright matcher integration](docs/guides/playwright-integration.md)
  * [Figma design parity and QA](docs/guides/figma-design-qa.md)
  * [Static images and canvas diffing](docs/guides/static-images-and-canvas.md)
  * [Monorepos and workspaces](docs/guides/monorepos-and-workspaces.md)
  * [Baseline management and Git merge-base](docs/guides/baseline-management.md)
  * [Flakiness and determinism](docs/guides/flakiness-and-determinism.md)
* **CI/CD & Production**:
  * [GitHub Actions workflow](docs/ci-cd/github-actions.md)
  * [Parallel CI sharding and report merger](docs/ci-cd/parallel-sharding.md)
  * [Self-hosted report deployment](docs/ci-cd/hosting-reports.md)
  * [Other CI providers (GitLab, CircleCI, Bitbucket)](docs/ci-cd/other-ci-providers.md)
* **Review UI & Inspection**:
  * [Review interface overview](docs/review-ui/overview.md)
  * [Comparison inspection modes](docs/review-ui/inspection-modes.md)
  * [Keyboard shortcuts and navigation](docs/review-ui/keyboard-shortcuts.md)
* **Storage & Plugins**:
  * [Storage adapters (S3, R2, GCS, Azure, Local)](docs/storage-and-plugins/storage-adapters.md)
  * [Notification adapters (GitHub, Slack)](docs/storage-and-plugins/notifiers.md)
  * [Custom drivers and lifecycle plugins](docs/storage-and-plugins/custom-plugins-and-drivers.md)
* **Reference & Architecture**:
  * [Configuration reference](docs/reference/configuration.md)
  * [Command-line interface (CLI)](docs/reference/cli.md)
  * [Storybook snapshot parameters](docs/reference/story-parameters.md)
  * [GitHub Action reference](docs/reference/action-reference.md)
  * [Core comparison engine & SIMD](docs/architecture/core-engine.md)
  * [Execution pipeline](docs/architecture/execution-pipeline.md)

---

## Monorepo packages

| Package | Directory | Description |
| :--- | :--- | :--- |
| `@diffra/cli` | `packages/cli` | Zero-dependency command-line binary (`diffra`) |
| `@diffra/core` | `packages/core` | Core test runner, Playwright matcher, pluggable drivers, and report generator |
| `@diffra/engine` | `packages/engine` | High-performance pixel comparison engine with SIMD acceleration |
| `@diffra/viewer` | `packages/viewer` | Standalone interactive review UI bundle |
| `@diffra/action` | `packages/action` | GitHub Action runner for CI/CD pipelines |
| `@diffra/demo-storybook` | `packages/demo-storybook` | Real working demo of Storybook 8 with Diffra visual regression |
| `@diffra/demo-app` | `packages/demo-app` | Real working demo of a Vite TypeScript web app with Diffra configured |

---

## License

MIT
