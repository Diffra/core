# @diffra/action

Official GitHub Action for Diffra visual regression testing.

---

## Overview

`@diffra/action` runs visual regressions directly inside your GitHub Actions CI pipeline, reporting status checks on commits and posting PR comments with interactive review links.

---

## Workflow usage

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
          fetch-depth: 0 # Full history needed for git merge-base resolution

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
          AWS_ACCESS_KEY_ID: ${{ secrets.S3_ACCESS_KEY }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.S3_SECRET_KEY }}
          DIFFRA_STORAGE_BUCKET: 'my-visual-baselines'
          DIFFRA_STORAGE_REGION: 'us-east-1'
```

---

## Inputs

| Input | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `githubToken` | Yes | N/A | GitHub token for status checks and PR comments (`${{ secrets.GITHUB_TOKEN }}`) |
| `storybookBuildDir` | No | `'storybook-static'` | Path to pre-built static Storybook directory |
| `storybookUrl` | No | `''` | URL of running Storybook server |
| `autoAcceptChanges` | No | `'main'` | Branch pattern on which candidate snapshots are automatically approved |
| `exitZeroOnChanges` | No | `'true'` | Exit with status code 0 when visual changes are found |
| `shard` | No | `''` | CI shard index and count (e.g. `1/4`) |

---

## Outputs

| Output | Description |
| :--- | :--- |
| `reportPath` | Path to generated structured `report.json` manifest |
| `viewerUrl` | Public or hosted interactive review URL |
| `changedCount` | Total number of changed visual targets |
| `totalCount` | Total number of visual targets tested |

---

## License

MIT
