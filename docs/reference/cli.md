# Command-line interface (CLI)

The `diffra` command-line utility provides commands for executing visual tests, approving baselines, merging sharded CI reports, and launching the local review viewer.

---

## Global options

| Flag | Description |
| :--- | :--- |
| `-h, --help` | Display help information for any command. |
| `-v, --version` | Output the current version number of Diffra. |

---

## Commands

### 1. diffra test

Executes visual regression tests against configured targets.

```bash
diffra test [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-d, --driver <name>` | `string` | `'storybook'` | Visual driver: `'storybook'`, `'url'`, `'image'`, or `'figma'`. |
| `-u, --url <url>` | `string` | `http://localhost:6006` | Base URL or Storybook server URL. |
| `--urls <list>` | `string` | `undefined` | Comma-separated list of web URLs or route paths to test. |
| `-c, --config <path>` | `string` | Auto-detected | Path to custom configuration file (`diffra.config.ts`). |
| `-b, --branch <branch>` | `string` | `origin/main` | Target baseline Git branch for merge-base discovery. |
| `-t, --diff-threshold <num>` | `number` | `0.063` | Perceptual sensitivity threshold (`0.0` strict to `1.0` permissive). |
| `-o, --output-dir <dir>` | `string` | `.diffra` | Output directory for reports, candidates, and diffs. |
| `--concurrency <number>` | `number` | `4` | Number of parallel browser workers in the Playwright pool. |
| `--shard <index/total>` | `string` | `undefined` | Execute a deterministic partition slice of tests (e.g. `1/4`). |
| `--delay <ms>` | `number` | `undefined` | Settle wait time in ms after component render before screenshot. |
| `--pass-on-changes` | `boolean` | `false` | Exits with status code `0` even if visual differences are detected. |
| `--gate <mode>` | `string` | `any` | `any` fails on every changed snapshot. `collateral` fails only on changes that no declared intent covers. |
| `--open` | `boolean` | `false` | Opens the review page in your browser when the run finishes. The page is always written and its location printed. |

#### Exit codes
* `0`: All visual tests matched baselines cleanly, or `--pass-on-changes` was supplied.
* `1`: Visual differences were detected, or an execution error occurred.

---

### 2. diffra approve

Promotes candidate screenshots from the latest test run as the new approved baselines for the current Git commit.

```bash
diffra approve [snapshot-id...] [options]
```

Without ids, every snapshot of the run is promoted. With one or more snapshot ids, only those are promoted, and an id that is not in the run is an error. An approval of a subset does not replace the list of snapshots that the commit's baseline holds, so it never causes other snapshots to be reported as removed.

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-c, --config <path>` | `string` | Auto-detected | Path to custom configuration file. |
| `--rationale <text>` | `string` | `undefined` | Why the changes are intended. Kept in the approval record, see [Approvals](../agents/approvals.md). |

---

### 3. diffra status

Shows the summary of the latest run. With `--json`, prints the full latest report.

```bash
diffra status [--json]
```

---

### 4. diffra mcp

Serves Diffra to AI agents over the Model Context Protocol on standard input and output. See [Working with AI agents](../agents/overview.md).

```bash
diffra mcp [--config <path>] [--report <address-or-folder>]
```

---

### 5. diffra intent

Declares what a change should alter, so that runs can tell intended changes from collateral ones. See [Intent contracts](../agents/intent-contracts.md).

```bash
diffra intent add <description> [--target <text>] [--source <file>] [--selector <selector>]
diffra intent list
diffra intent clear [id...]
```

---

### 6. diffra prove

Tests the cause of a changed snapshot by undoing it in the live page. Exits `0` when the cause is proven. See [Proof](../agents/proof.md).

```bash
diffra prove <snapshot-id> [--json]
```

---

### 7. diffra fix

Prints a patch that undoes a proven change, for `git apply`. Standard output is only the patch. See [Fixes and verification](../agents/fixes-and-verification.md).

```bash
diffra fix <snapshot-id> | git apply
```

---

### 8. diffra verify

Runs again and says which open changes are resolved. Exits `1` when anything is still changed or newly changed.

```bash
diffra verify [--affected] [--filter <text>] [--json]
```

---

### 9. diffra merge-reports

Merges multiple partial shard report directories into a single unified `report.json` manifest.

```bash
diffra merge-reports <shardPaths...> [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-o, --output-dir <dir>` | `string` | `.diffra` | Output directory for the merged report manifest. |

---

### 10. diffra serve

Serves a review bundle (the latest run by default) over HTTP on a local port.

```bash
diffra serve [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-p, --port <number>` | `number` | free port | Port for the review server. |
| `-r, --report <path>` | `string` | latest run | A review bundle directory, or the `report.json` inside one. |
