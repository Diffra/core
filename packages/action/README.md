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
        uses: actions/checkout@v7
        with:
          fetch-depth: 0 # Full history needed for git merge-base resolution

      - name: Setup pnpm
        uses: pnpm/action-setup@v6

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version: 24.x
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Run Diffra Action
        uses: Diffra/core@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
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
| `token` | No | `${{ github.token }}` | GitHub token for status checks and PR comments (`${{ secrets.GITHUB_TOKEN }}`) |
| `storybookBuildDir` | No | `undefined` | Path to a pre-built static Storybook or site directory, served locally during the run |
| `storybookUrl` | No | `undefined` | URL of running Storybook server |
| `storybookPort` | No | `'0'` | Port for the local preview server (`0` picks a free port) |
| `driver` | No | `'storybook'` | Visual target driver: `'storybook'`, `'url'`, or `'image'` |
| `autoAcceptChanges` | No | `'default-branch'` | Branch pattern on which candidate snapshots are automatically approved |
| `exitZeroOnChanges` | No | `'true'` | Exit with status code 0 when visual changes are found |
| `diffThreshold` | No | `'0.063'` | Perceptual sensitivity threshold |
| `concurrency` | No | `'4'` | Number of parallel browser workers |
| `workingDir` | No | `'.'` | Working directory for monorepo packages |
| `reportBaseUrl` | No | `undefined` | Public URL under which the `.diffra` output directory is published. Review links become `<reportBaseUrl>/runs/<runId>/`; without it, the bundle is uploaded as the `diffra-report` workflow artifact and links point at it |
| `uploadReport` | No | `'true'` | Set to `false` to skip the artifact upload |

Baselines must outlive the job, so CI runs need cloud storage. Select it with environment variables:

| Variable | Description |
| :--- | :--- |
| `DIFFRA_STORAGE_BUCKET` | Bucket name. Selects S3 unless `DIFFRA_STORAGE_PROVIDER` says otherwise |
| `DIFFRA_STORAGE_PROVIDER` | `s3`, `gcs`, `azure`, or `local` |
| `DIFFRA_STORAGE_REGION` | S3 region |
| `DIFFRA_STORAGE_ENDPOINT` | S3-compatible endpoint, for Cloudflare R2 or MinIO |
| `DIFFRA_STORAGE_PREFIX` | Key prefix inside the bucket or container |
| `DIFFRA_STORAGE_CONTAINER` | Azure container. Selects Azure |

Credentials use each provider's standard variables (`AWS_ACCESS_KEY_ID`, `AZURE_STORAGE_CONNECTION_STRING`, `GOOGLE_APPLICATION_CREDENTIALS`). A `storage` block in `diffra.config.ts` takes precedence.

The action downloads Chromium itself when it is missing.

---

## Outputs

| Output | Description |
| :--- | :--- |
| `url` | Shorthand alias for the visual report build URL |
| `buildUrl` | Full URL to the visual regression review report |
| `storybookUrl` | URL of the Storybook preview server used during capture |
| `code` | Process exit status code |
| `changeCount` | Number of visual differences detected |
| `reportDir` | Directory holding the review bundle (`index.html`, `report.json`, `images/`) |
| `failedCount` | Number of targets that could not be captured |
| `storyCount` | Total number of stories and viewport combinations tested |
| `status` | Final execution status (`passed`, `changes_found`, or `failed`) |

---

## License

MIT
