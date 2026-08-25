# @diffra/cli

Zero-dependency command-line binary (`diffra`) for executing visual regression test runs, approving baselines, merging shard reports, and reviewing visual differences.

---

## Overview

`@diffra/cli` provides the standard `diffra` executable for terminal and CI workflows. Built strictly with standard Node.js APIs (`node:util` `parseArgs`, standard ANSI escape sequences), it introduces zero runtime dependencies.

---

## Installation

```bash
# Local project installation
pnpm add -D @diffra/cli

# Global CLI installation
npm install -g @diffra/cli
```

---

## Commands

### `diffra test`

Executes visual regression tests against configured targets.

```bash
# Run tests against local Storybook dev server
diffra test --url http://localhost:6006

# Run tests against pre-built static Storybook build
diffra test --driver storybook

# Run tests with custom threshold and concurrency
diffra test --diff-threshold 0.05 --concurrency 8

# Run tests on a parallel CI shard
diffra test --shard 1/4

# Automatically link to review viewer
diffra test --open
```

### `diffra approve`

Promotes candidate screenshots to active baseline reference images for the current branch or commit.

```bash
diffra approve
```

### `diffra merge-reports`

Merges distributed shard test manifests into a single consolidated `report.json`.

```bash
diffra merge-reports --shard-dir ./shard-1 --shard-dir ./shard-2 --output-dir .diffra
```

### `diffra serve`

Generates an interactive review link to inspect test results and visual differences in the review UI.

```bash
diffra serve
```

---

## Command-line options

| Option | Type | Description |
| :--- | :--- | :--- |
| `--driver` | `string` | Driver to execute (`storybook`, `url`, `image`, `figma`) |
| `--url` | `string` | Preview URL to test against |
| `--branch` | `string` | Baseline branch for comparison (default: `main`) |
| `--diff-threshold` | `number` | Perceptual color delta threshold (default: `0.063`) |
| `--concurrency` | `number` | Parallel browser workers |
| `--shard` | `string` | CI shard index and total count (e.g. `1/4`) |
| `--open` | `boolean` | Display viewer link upon run completion |
| `--output-dir` | `string` | Output directory for reports and snapshots |
| `--pass-on-changes` | `boolean` | Exit with status code 0 even if changes are detected |

---

## License

MIT
