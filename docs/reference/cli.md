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
| `--threshold <num>` | `number` | `0.063` | Alias for `--diff-threshold`. |
| `-o, --output-dir <dir>` | `string` | `.diffra` | Output directory for reports, candidates, and diffs. |
| `--concurrency <number>` | `number` | `4` | Number of parallel browser workers in the Playwright pool. |
| `--shard <index/total>` | `string` | `undefined` | Execute a deterministic partition slice of tests (e.g. `1/4`). |
| `--delay <ms>` | `number` | `undefined` | Settle wait time in ms after component render before screenshot. |
| `--pass-on-changes` | `boolean` | `false` | Exits with status code `0` even if visual differences are detected. |
| `--open` | `boolean` | `false` | Automatically starts the review server and opens the report in your browser. |

#### Exit codes
* `0`: All visual tests matched baselines cleanly, or `--pass-on-changes` was supplied.
* `1`: Visual differences were detected, or an execution error occurred.

---

### 2. diffra approve

Promotes candidate screenshots from the latest test run as the new approved baselines for the current Git commit.

```bash
diffra approve [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-c, --config <path>` | `string` | Auto-detected | Path to custom configuration file. |

---

### 3. diffra merge-reports

Merges multiple partial shard report directories into a single unified `report.json` manifest.

```bash
diffra merge-reports <shardPaths...> [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-o, --output-dir <dir>` | `string` | `.diffra` | Output directory for the merged report manifest. |

---

### 4. diffra serve

Starts a local HTTP server serving report JSON and images to the interactive review UI.

```bash
diffra serve [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-p, --port <number>` | `number` | `9000` | Port for the review report server. |
| `-r, --report <path>` | `string` | Auto-detected | Path to a specific `report.json` file or directory. |
