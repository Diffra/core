# Command-line interface (CLI)

The `diffra` command-line utility provides tools for running tests, approving baselines, and serving review reports.

---

## Global options

| Flag | Description |
| :--- | :--- |
| `-V, --version` | Output the version number |
| `-h, --help` | Display help for command |

---

## Commands

### 1. diffra test

Executes the visual regression testing pipeline against Storybook.

```bash
diffra test [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-c, --config <path>` | `string` | Auto-detected | Path to custom configuration file (`diffra.config.ts` or `diffra.config.js`). |
| `-u, --url <url>` | `string` | `http://localhost:6006` | Storybook server URL. |
| `-b, --branch <branch>` | `string` | `origin/main` | Target baseline Git branch for merge-base resolution. |
| `-t, --threshold <number>` | `number` | `0.1` | Global pixel diff sensitivity threshold (from `0.0` strict to `1.0` permissive). |
| `-o, --output-dir <dir>` | `string` | `.diffra` | Output directory for test reports, candidates, and diffs. |
| `--concurrency <number>` | `number` | `4` | Number of parallel browser workers in the Playwright pool. |
| `--pass-on-changes` | `boolean` | `false` | Exits with status code `0` even if visual differences are detected. |
| `--open` | `boolean` | `false` | Automatically starts the review server and opens the report in the default browser upon completion. |

#### Examples

```bash
# Basic run against local Storybook server
diffra test

# Run against custom port with strict threshold and auto-open report
diffra test --url http://127.0.0.1:8080 --threshold 0.02 --open

# CI run with 8 parallel browser workers that targets main
diffra test --branch origin/main --concurrency 8
```

---

### 2. diffra approve

Promotes the candidate screenshots from the latest test run as the new approved baselines for the current Git commit.

```bash
diffra approve [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-c, --config <path>` | `string` | Auto-detected | Path to custom configuration file. |

#### Examples

```bash
# Approve latest candidates
diffra approve

# Commit newly approved baselines to version control
git add .diffra/baselines
git commit -m "chore(visual): approve updated component baselines"
```

---

### 3. diffra serve

Launches a local HTTP preview server hosting the interactive static HTML review report.

```bash
diffra serve [options]
```

#### Options

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-p, --port <number>` | `number` | `9000` | Port for the review report server. |
| `-r, --report <path>` | `string` | Auto-detected | Path to a specific `index.html` report file. If omitted, serves the latest run. |

#### Examples

```bash
# Serve latest test report on default port (http://localhost:9000)
diffra serve

# Serve specific run on port 3000
diffra serve --port 3000 --report .diffra/runs/run-1787517339526/index.html
```
