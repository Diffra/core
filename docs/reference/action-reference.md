# GitHub Action reference

Schema and configuration options reference for the official Diffra GitHub Action (`Diffra/core@v1`).

---

## Action definition (`action.yml`)

```yaml
- name: Run Diffra visual regression
  uses: Diffra/core@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Inputs

| Input | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `token` | No | `${{ github.token }}` | GitHub token for posting PR comments, commit statuses, and summaries. |
| `storybookBuildDir` | No | `undefined` | Path to a pre-built static Storybook or site directory, served on a local port during the run. |
| `storybookUrl` | No | `undefined` | URL of a running Storybook or web preview server. |
| `storybookPort` | No | `0` | Port for the local preview server. `0` picks a free port. |
| `driver` | No | inferred | Visual target driver: `'storybook'`, `'url'`, `'image'`, or `'figma'`. When no driver, `urls`, `storybookBuildDir`, or `storybookUrl` is set, drivers come from your `diffra.config.ts`. |
| `urls` | No | `undefined` | Comma-separated list or JSON array of web route URLs to test. |
| `diffThreshold` | No | `0.063` | Perceptual sensitivity threshold (`0.00` to `1.00`). |
| `concurrency` | No | `4` | Number of parallel browser workers. |
| `exitZeroOnChanges`| No | `'true'` | Pass the action step (exit `0`) even if visual differences are detected, or specify a branch name (e.g. `main` or `true`). |
| `autoAcceptChanges`| No | `'default-branch'` | Automatically promote candidate screenshots as the new baseline on the default branch, or on a named branch. |
| `exitOnceUploaded` | No | `false` | Exit with code `0` immediately after snapshots are saved. |
| `workingDir` | No | `.` | Working directory for monorepo setups. |
| `viewerUrl` | No | `undefined` | Base URL of deployed review viewer (e.g. GitHub Pages). |
| `debug` | No | `false` | Log the resolved configuration and extra diagnostics. |

---

## Outputs

| Output | Description |
| :--- | :--- |
| `url` | URL or local file path to the generated visual report manifest. |
| `buildUrl` | Alias for `url`. |
| `storybookUrl` | URL of the Storybook preview server used during testing. |
| `code` | Process exit status code (`0` or `1`). |
| `changeCount` | Total number of visual differences detected. |
| `failedCount` | Number of targets that could not be captured. A non-zero value fails the step. |
| `storyCount` | Total number of visual targets tested. |
| `status` | Execution status string (`passed`, `changes_found`, `failed`). |
