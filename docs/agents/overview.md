# Working with AI agents

Diffra lets a coding agent find a visual regression, understand its cause, undo it and check the result. An agent that only sees screenshots has to guess. With Diffra it gets the element, the style and the rule behind each change, a test of whether that cause is the whole story, a patch that undoes it, and a check that the fix worked. Diffra never calls a model: it supplies evidence and applies decisions, and the agent supplies the reasoning.

To set it up in one command, follow the [agent quickstart](../getting-started/agent-quickstart.md). For concrete situations, see [workflows](workflows.md).

## In CI

The automated workflow comes first. Every run in CI produces a [review bundle](../architecture/review-bundle.md) that contains `report.json` and the images it names. Once the bundle is published, an agent job that responds to a failing check can read it directly:

```bash
diffra mcp --report https://reports.example.com/runs/run-1700000000000/
```

A server started with `--report` is read-only. It can list changes and return images, but it cannot run tests or approve baselines, so a CI-triggered agent cannot change what the team has accepted.

## On a developer machine

Started without `--report`, the server works against the project in the current directory. The agent can run the tests, usually with a filter so that only the component it is working on is captured, look at the result, and approve the snapshots whose change it intended.

```bash
diffra mcp
```

`diffra agent init` registers it in `.mcp.json` and installs the skill. To register it by hand, add it to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "diffra": { "command": "npx", "args": ["diffra", "mcp"] }
  }
}
```

## The loop

Before editing, declare what you are about to change with `diffra_declare_intent`. Later runs then tell your changes from collateral damage. See [Intent contracts](intent-contracts.md).

1. Run `diffra_run` with a `filter` for the component being changed.
2. Read the list of changes. Each entry names the source file of the snapshot, how many regions changed, what its state means, and, when known, a sentence on what in the page caused it.
3. Call `diffra_explain` for a changed snapshot to see its causes: which element and styles changed, which stylesheet rule set them, and whether that file changed in this branch. See [Explained changes](explained-changes.md).
4. Call `diffra_view` with a `region` to see the baseline and candidate cropped to one changed area. Cropped images are far smaller than whole screenshots.
5. Decide whether the change is intended. If it is not, call `diffra_prove` to test the cause, then `diffra_suggest_fix` for a patch that undoes it, or fix the code yourself.
6. Call `diffra_verify`, with `affected` while you iterate, to see which open changes are resolved. See [Fixes and verification](fixes-and-verification.md).
7. Approve the intended snapshots by id with `diffra_approve`.

## Safety

* Approval always lists snapshot ids. There is no call that accepts a whole run.
* A server connected to a published bundle cannot run tests or approve anything.
* Images are read only from inside the bundle. A path that leaves it is refused.
* Images over a fixed size limit are refused with a hint to request a region.

## Reading reports without the server

Every command that prints a report accepts `--json`. With `--json`, standard output contains only JSON and all human-readable text goes to standard error, so the output can be piped directly into other tools:

```bash
diffra --json --pass-on-changes
diffra status --json
diffra approve image--card_png --json
```

The report carries a `schemaVersion`. It is raised whenever a field is removed or changes meaning.
