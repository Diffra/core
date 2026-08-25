# Diffra

A self-hosted, general-purpose visual regression testing platform for web applications, design systems, and component libraries.

Diffra catches visual bugs and unintended layout shifts automatically across your entire UI surface — from production routes and web app pages to design systems and Storybook components. It runs entirely within your existing CI/CD workflow with zero subscription costs, no screenshot limits, and complete data privacy.

---

## Why choose Diffra?

Traditional cloud-hosted visual testing platforms charge recurring subscription fees per screenshot, impose strict concurrency caps, and require sending proprietary UI mockups and customer data to external servers.

Diffra gives you full control and ownership of your visual regression testing pipeline:

* **Zero vendor costs**: Run unlimited visual regression tests without screenshot quotas, per-seat billing, or tier limits.
* **Complete data privacy**: Screenshots and baselines stay entirely within your infrastructure (local disk or your own private cloud storage bucket).
* **Universal testing scope**: Test live web applications, local development servers, staging routes, custom image sets, or Storybook components with first-class pluggable drivers.
* **Self-hosted and self-contained**: Built as a lightweight CLI and GitHub Action that runs natively on your existing CI runners.
* **Interactive local review UI**: Self-contained visual reports with side-by-side, swipe slider, onion skin, and diff mask inspection modes.
* **Deterministic baseline management**: Automatic Git merge-base baseline discovery and single-command baseline promotion (`diffra approve`).

---

## How it works

1. **Target discovery**: Diffra discovers your visual targets — whether web application routes, static pages, custom target lists, or Storybook stories.
2. **Headless capture**: A parallel browser pool renders each target in clean isolation, freezing CSS animations and waiting for web fonts to stabilize.
3. **Pixel comparison**: Candidate screenshots are compared against the target branch baselines using perceptual color difference algorithms.
4. **Interactive report & review**: Diffra compiles a standalone interactive HTML report and posts a summary directly to your pull request.
5. **Approval**: Approved changes are promoted as the new baseline when pull requests are merged.

---

## Getting started

Ready to set up visual testing in your project? Follow our quickstarts and guides:

* [Storybook quickstart](docs/getting-started/storybook-quickstart.md): 5-minute setup for Storybook 7/8/9.
* [Web applications quickstart](docs/getting-started/web-apps-quickstart.md): 5-minute setup for Next.js, Remix, Vite, and Astro.
* [Playwright test runner quickstart](docs/getting-started/playwright-quickstart.md): Visual assertions with `toMatchVisualBaseline`.

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
  * [TypeScript API types](docs/reference/types-reference.md)
  * [Core comparison engine & SIMD](docs/architecture/core-engine.md)
  * [Execution pipeline](docs/architecture/execution-pipeline.md)
  * [Design system principles](docs/architecture/design-principles.md)

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
