# Troubleshooting

Symptoms first, then the cause and the fix.

## Every snapshot is reported as added

Diffra found no baseline. Three causes are common:

* **It is the first run.** Approve the run to create the baseline. See [baseline management](guides/baseline-management.md).
* **The checkout is shallow.** Diffra prints `Shallow Git repository detected` and cannot find the merge-base. Check out with `fetch-depth: 0`. See the [GitHub Actions workflow](ci-cd/github-actions.md).
* **Storage is not reachable from this job.** Check the bucket, the credentials and the `DIFFRA_STORAGE_*` variables. See [storage adapters](storage-and-plugins/storage-adapters.md).

## The run stops with an error about storage

An unknown provider, or a provider without its required variable, stops the run. The variables and what each one selects are listed in [storage adapters](storage-and-plugins/storage-adapters.md).

## `Invalid Diffra configuration`

The configuration failed validation and the message names the field. Check it against the [configuration reference](reference/configuration.md).

## `Cannot find native binding`

The comparison engine has no binary for this platform. Release builds cover Linux (x64, arm64), macOS (x64, arm64) and Windows (x64). From a source checkout, run `pnpm build`. See [core engine](architecture/core-engine.md).

## `No latest test run found`

`approve`, `status`, `intent`, `prove`, `fix`, `verify` and the MCP server read the report of the latest run from the output directory. Run `diffra test` first, and pass the same `--output-dir` to both commands. See the [CLI reference](reference/cli.md).

## `Images are too large to compare`

The baseline and candidate together cover more than 100,000,000 pixels, measured on the larger width and the larger height. The snapshot is reported as failed and the run continues. A full-page capture of a very long page, or a candidate of a very different shape from its baseline, are the usual causes. See [core engine](architecture/core-engine.md).

## Snapshots differ between machines

Different operating systems render fonts differently. Capture baselines in the same environment that runs your checks, usually the CI runner. See [flakiness and determinism](guides/flakiness-and-determinism.md).

## A snapshot is reported as failed

The target produced no usable image, for example the page did not load, or the image could not be decoded. Each target is attempted `runner.captureAttempts` times, default 2, before it is reported as failed. The result carries the error. See the [configuration reference](reference/configuration.md).

## A changed snapshot has no explanation

An explanation needs the render ledger of both sides. It is missing when:

* the target came from the `image` or `figma` driver, or from a custom driver that returns images, because there is no page to record;
* `agent.context` is `false`;
* the baseline was captured before ledgers were recorded. Approve the run, and the next change will be explained.

See [explained changes](agents/explained-changes.md).

## No removed snapshots are reported

Removed targets are not reported for sharded runs, for filtered runs, for storage adapters without baseline key support, or when no baseline was found. See [baseline management](guides/baseline-management.md).

## `No valid shard reports found to merge`

None of the paths passed to `diffra merge-reports` held a shard report. See [parallel sharding](ci-cd/parallel-sharding.md).

## Agent problems

### The agent does not see the Diffra tools

Run `diffra agent init` in the project root, then restart the agent. Check that `.mcp.json` has a `diffra` entry. A client that stores MCP servers elsewhere can run `npx diffra mcp` as the server command. See the [agent quickstart](getting-started/agent-quickstart.md).

### `diffra_prove` cannot prove a change

The page has to be reachable again, such as a running Storybook or development server. A proof is `unproven` when undoing the cause did not restore the baseline, and `not-attempted` when the change is a text, an added element or a removed one. See [proof](agents/proof.md).

### `diffra_suggest_fix` returns no patch

A patch needs a proven cause, a rule found in a stylesheet of the project, and values that match exactly as the browser computed them. Without a patch, the suggestion still names the values to restore and where. See [fixes and verification](agents/fixes-and-verification.md).

### `diffra_approve` refuses a snapshot

The refusal says what is missing: no declared intent, an intent that does not cover the change, or a cause that is not proven yet. Declare an intent only if the change is part of the task. A person can always run `diffra approve`. See [approvals](agents/approvals.md).

### The server is read-only

A server started with `--report` cannot run, prove, verify or approve. Start `diffra mcp` in the project instead. See [agent workflows](agents/workflows.md#triage-a-failing-pull-request).

## Still stuck

Search the [issues](https://github.com/Diffra/core/issues), or open one with the template. Include the command, the output, and the versions of Node and Diffra.
