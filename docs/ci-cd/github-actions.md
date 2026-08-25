# GitHub Actions workflow

Diffra provides an official GitHub Action (`Diffra/core@v1`) that automates visual regression testing on pull requests, publishes sticky markdown summaries, attaches inline warning annotations to changed components, and promotes baselines upon merge.

---

## Production workflow example

Create `.github/workflows/visual-tests.yml`:

```yaml
name: Visual Regression Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  statuses: write

jobs:
  visual-tests:
    name: Visual Regression
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full Git history required for merge-base baseline discovery

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Run Diffra visual regression
        uses: Diffra/core@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

Diffra automatically:
1. Hosts a secure, sandboxed static preview server for `storybook-static`.
2. Discovers Git merge-base baselines and compares candidate screenshots.
3. Generates step summaries, PR sticky comments, and commit annotations.
4. Automatically promotes baselines when pull requests merge into `main`.

---

## Action inputs reference

| Input | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `token` | `string` | `${{ github.token }}` | GitHub token for posting PR comments, commit statuses, and summaries. |
| `storybookBuildDir` | `string` | `'storybook-static'` | Path to pre-built static Storybook directory. |
| `storybookUrl` | `string` | `undefined` | URL of a running Storybook or web preview server. |
| `driver` | `string` | `'storybook'` | Target driver: `'storybook'`, `'url'`, `'image'`, or `'figma'`. |
| `urls` | `string` | `undefined` | Comma-separated list or JSON array of web route URLs to test. |
| `exitZeroOnChanges` | `boolean \| string` | `'true'` | Pass the action step (exit `0`) even if visual differences are detected, or specify a branch name (e.g. `main` or `true`). |
| `autoAcceptChanges` | `boolean \| string` | `'main'` | Automatically promote candidate screenshots as the new baseline on `main` or a specific branch. |
| `exitOnceUploaded` | `boolean \| string` | `false` | Exit with code `0` immediately after snapshots are saved. |
| `diffThreshold` | `number` | `0.063` | Perceptual sensitivity threshold (`0.00` to `1.00`). |
| `concurrency` | `number` | `4` | Number of parallel browser workers. |
| `workingDir` | `string` | `.` | Working directory for monorepo package subdirectories. |
| `viewerUrl` | `string` | `undefined` | Base URL of your deployed review viewer (e.g. GitHub Pages). |

---

## Action outputs reference

| Output | Description |
| :--- | :--- |
| `url` / `buildUrl` | File path or URL to the generated visual report manifest. |
| `storybookUrl` | URL of the Storybook preview server used during testing. |
| `code` | Process exit status code (`0` or `1`). |
| `changeCount` | Total number of visual differences detected. |
| `storyCount` | Total number of visual targets tested. |
| `status` | Execution status string (`passed`, `changes_found`, `failed`). |
