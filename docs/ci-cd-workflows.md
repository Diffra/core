# CI/CD workflows and GitHub Action

Diffra provides an official GitHub Action for continuous visual testing with automatic baseline discovery, PR sticky summaries, warning annotations, and merge-based baseline promotion.

---

## Continuous review lifecycle

Diffra implements a self-hosted visual review workflow:

1. **Pull request phase**:
   - The runner resolves the merge base with the target branch (`origin/main`).
   - Candidate screenshots are captured and compared against the merge-base baseline.
   - If visual diffs are detected:
     - Warning annotations are emitted on changed components.
     - A sticky PR comment is created or updated with the comparison table.
     - A GitHub Actions Job Step Summary is published to the workflow run.
     - A commit status check (`diffra/visual-tests`) is updated.
2. **Merge approval phase**:
   - Merging the pull request into `main` signals approval of the visual diffs.
   - When the workflow runs on push to `main` with `autoAcceptChanges: 'main'`, the candidate snapshots are automatically promoted and stored as the new baseline for subsequent pull requests.

---

## Production GitHub Action workflow

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
    name: Visual Regression (Storybook)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full Git history required for merge-base resolution

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Restore baselines cache
        uses: actions/cache/restore@v4
        with:
          path: .diffra/baselines
          key: diffra-baselines-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            diffra-baselines-${{ runner.os }}-main-
            diffra-baselines-${{ runner.os }}-

      - name: Build Storybook
        run: pnpm build-storybook

      - name: Run Diffra visual tests
        uses: Diffra/core@v1
        with:
          storybookBuildDir: 'storybook-static'
          token: ${{ secrets.GITHUB_TOKEN }}
          autoAcceptChanges: 'main'
          exitZeroOnChanges: 'true'

      - name: Save updated baselines cache on main
        if: github.ref == 'refs/heads/main' && always()
        uses: actions/cache/save@v4
        with:
          path: .diffra/baselines
          key: diffra-baselines-${{ runner.os }}-main-${{ github.sha }}

      - name: Upload visual report artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-report
          path: |
            .diffra/runs/**/index.html
            .diffra/runs/**/report.json
            .diffra/runs/**/diffs/
            .diffra/runs/**/candidates/
          retention-days: 14
```

---

## Action inputs reference

| Input | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `projectToken` | `string` | `undefined` | Token for project or storage authentication. |
| `token` | `string` | `${{ github.token }}` | GitHub token for posting PR comments, commit statuses, and summaries. |
| `storybookBuildDir` | `string` | `undefined` | Path to pre-built static Storybook directory (e.g. `storybook-static`). |
| `storybookUrl` | `string` | `undefined` | URL of a running Storybook server (e.g. `http://localhost:6006`). |
| `storybookPort` | `number` | `6006` | Port to run the local preview server on. |
| `exitZeroOnChanges` | `boolean \| string` | `false` | Pass the action step (exit `0`) even if visual differences are detected, or specify a branch name (e.g. `main` or `true`). |
| `autoAcceptChanges` | `boolean \| string` | `false` | Automatically promote candidate screenshots as the new baseline on `main` or a specific branch. |
| `exitOnceUploaded` | `boolean \| string` | `false` | Exit with code `0` immediately after snapshots are saved. |
| `onlyChanged` | `boolean` | `false` | Only capture and test stories whose component files have changed. |
| `diffThreshold` | `number` | `0.063` | Perceptual sensitivity threshold (from `0.00` to `1.00`). |
| `concurrency` | `number` | `4` | Number of parallel browser workers. |
| `workingDir` | `string` | `.` | Working directory for monorepo setups. |
| `debug` | `boolean` | `false` | Enable verbose logging in CI output. |

---

## Action outputs reference

| Output | Description |
| :--- | :--- |
| `url` / `buildUrl` | Full URL or file path to the generated visual report. |
| `storybookUrl` | URL of the Storybook preview server used during testing. |
| `code` | Process exit status code (`0` or `1`). |
| `changeCount` | Total number of visual differences detected. |
| `storyCount` | Total number of stories and viewports tested. |
| `status` | Execution status string (`passed`, `changes_found`, `failed`). |

---

## Advanced workflow examples

### Monorepo setup with custom diff threshold
```yaml
- name: Run visual tests for UI package
  uses: Diffra/core@v1
  with:
    workingDir: 'packages/ui'
    storybookBuildDir: 'packages/ui/storybook-static'
    diffThreshold: 0.05
    concurrency: 8
    autoAcceptChanges: 'main'
    token: ${{ secrets.GITHUB_TOKEN }}
```

