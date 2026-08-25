# Diffra documentation

Diffra is a self-hosted, general-purpose visual regression testing platform engineered for web applications, design systems, and component libraries.

---

## Documentation by role and workflow

Find the guides and references tailored to your development stack and workflow:

### 1. Quickstarts and onboarding
* [Getting started overview](getting-started/index.md): Core concepts, how Diffra works, and choosing your setup.
* [Storybook quickstart](getting-started/storybook-quickstart.md): 5-minute setup for Storybook 7/8/9 with React, Vue, Svelte, and Vite.
* [Web applications quickstart](getting-started/web-apps-quickstart.md): 5-minute setup for Next.js, Remix, Vite, Astro, and running servers.
* [Playwright test runner quickstart](getting-started/playwright-quickstart.md): 5-minute setup extending Playwright's `expect` with visual baseline assertions.

### 2. In-depth guides
* [Testing Storybook components](guides/testing-storybook-components.md): CSF3 parameters, interaction testing via `play()`, and responsive `modes`.
* [Testing web applications and routes](guides/testing-web-applications.md): Route testing, selector isolation, SSR hydration delays, and element masking.
* [Playwright matcher integration](guides/playwright-integration.md): `toMatchVisualBaseline`, locator masking, and test assertions.
* [Figma design parity and QA](guides/figma-design-qa.md): Automated Design Parity (Figma vs Code) and Design Regression (Figma vs Figma).
* [Static images and canvas diffing](guides/static-images-and-canvas.md): Zero-browser pixel diffing for canvas outputs, chart exports, and icon sets.
* [Monorepos and workspaces](guides/monorepos-and-workspaces.md): Turborepo, Nx, and pnpm workspace setups with per-package configs.
* [Baseline management and Git merge-base](guides/baseline-management.md): Merge-base resolution, Content-Addressed Storage (CAS), and approval flows.
* [Flakiness and determinism](guides/flakiness-and-determinism.md): Web fonts, animation freezing, dynamic masking, and cross-OS font parity.

### 3. CI/CD and production workflows
* [GitHub Actions workflow](ci-cd/github-actions.md): Complete setup for pull request sticky comments, annotations, and merge approvals.
* [Parallel CI sharding and report merger](ci-cd/parallel-sharding.md): Matrix sharding with `--shard` and merging with `diffra merge-reports`.
* [Self-hosted report deployment](ci-cd/hosting-reports.md): Deploying reports to GitHub Pages, Cloudflare Pages, Amazon S3, or Vercel.
* [Other CI providers](ci-cd/other-ci-providers.md): GitLab CI, CircleCI, Bitbucket Pipelines, and Jenkins recipes.

### 4. Review interface and inspection
* [Review interface overview](review-ui/overview.md): Scandinavian minimalist design, typography, and layout hierarchy.
* [Comparison inspection modes](review-ui/inspection-modes.md): Movement highlight, Split view, Swipe slider, Onion skin, and Diff mask.
* [Keyboard shortcuts and navigation](review-ui/keyboard-shortcuts.md): Navigation shortcuts, filter popover, and cross-branch jumping.

### 5. Storage, notifiers, and extensibility
* [Storage adapters](storage-and-plugins/storage-adapters.md): Local disk, Amazon S3, Cloudflare R2, Google Cloud Storage, and Azure Blob.
* [Notification adapters](storage-and-plugins/notifiers.md): GitHub commit checks, PR sticky comments, and Slack webhooks.
* [Custom drivers and lifecycle plugins](storage-and-plugins/custom-plugins-and-drivers.md): Custom `VisualDriver`, `StorageAdapter`, and lifecycle hooks.

### 6. Reference manuals
* [Configuration reference](reference/configuration.md): Complete `diffra.config.ts` options and TypeScript schema.
* [Command-line interface (CLI)](reference/cli.md): Commands, flags, exit codes, and environment variables.
* [Storybook snapshot parameters](reference/story-parameters.md): Complete `parameters.snapshot` reference.
* [GitHub Action inputs and outputs](reference/action-reference.md): Action schema reference and flags.
* [TypeScript API types](reference/types-reference.md): Core interfaces and type definitions.

### 7. Architecture and engine internals
* [Core comparison engine](architecture/core-engine.md): Native Rust SIMD pixel diffing, YIQ color space, and clustering algorithms.
* [Execution pipeline](architecture/execution-pipeline.md): Step-by-step test execution lifecycle from discovery to report generation.
