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

Ready to set up visual testing in your project? Follow the step-by-step [Getting started guide](docs/getting-started.md) to learn how to test web application routes or Storybook components, run your first test, and configure automated CI checks.

---

## Documentation

* [Getting started guide](docs/getting-started.md): Step-by-step onboarding walkthrough for web applications and design systems.
* [Command-line interface (CLI)](docs/cli.md): Reference for all CLI commands, arguments, and flags.
* [Configuration reference](docs/configuration.md): Complete configuration schema and TypeScript options.
* [Storybook integration](docs/storybook-integration.md): Story-level configuration with `parameters.snapshot`.
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
