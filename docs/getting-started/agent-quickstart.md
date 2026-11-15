# Agent quickstart

Let a coding agent find, explain and fix visual regressions in your project. About ten minutes, once Diffra already runs on your project.

## Before you start

* Diffra is set up with one of the [quickstarts](index.md#choose-your-quickstart), and at least one run has been approved, so there are baselines to compare with.
* Your agent supports the Model Context Protocol, or reads skill files.
* The page under test can be started locally, for example a Storybook or development server. Proof and verification load the page again.

## 1. Prepare the project

```bash
npx diffra agent init
```

This does two things, and never overwrites what you already have unless you pass `--force`:

* registers the Diffra server in `.mcp.json`, merged with any servers already there;
* installs the `diffra-visual-review` skill in `.claude/skills/`, which teaches the agent the loop.

Restart your agent so it picks both up. Use `--no-skill` to register the server only. Clients that keep MCP servers elsewhere can run `npx diffra mcp` as a command; see the [MCP reference](../agents/mcp-reference.md).

## 2. Ask for a change

Give the agent a visual task the way you would give it to a colleague:

> Make the primary buttons roomier. Check the visual changes in this branch, fix any you did not intend, and approve the ones you did.

You do not need to name tools. The skill and the server's own instructions tell the agent what to call.

## 3. What the agent does

| Step | Tool | Result |
| :--- | :--- | :--- |
| Declares what it will change | `diffra_declare_intent` | Later runs can tell intended changes from collateral ones. |
| Runs the checks for what it touched | `diffra_run` | A short list of snapshots that need a decision. |
| Finds out why each one changed | `diffra_explain` | Element, styles, stylesheet rule, and whether the file changed in this branch. |
| Looks at one changed area | `diffra_view` | Baseline and candidate crops of a single region. |
| Confirms a cause it did not intend | `diffra_prove` | The cause is proven, or the agent learns it is not enough. |
| Undoes it | `diffra_suggest_fix` | A patch, or the exact values and file to change. |
| Checks the edit | `diffra_verify` | What is resolved, still changed or newly changed. |
| Accepts what it meant to change | `diffra_approve` | Baselines updated for named snapshots, with a rationale. |

The full tool list is in the [MCP reference](../agents/mcp-reference.md).

## 4. Review what it did

* `git diff` shows the code changes.
* `.diffra/approvals.jsonl` records every approval: who, why, which snapshots, and the classification and proof at the time. See [approvals](../agents/approvals.md).
* The [review interface](../review-ui/overview.md) shows the run, with each change's cause in plain language. Run `npx diffra serve` to open it.

## 5. Decide how much to trust it

By default an agent may approve only changes that a declared intent covers. Tighten or loosen this with `agent.autoApprove`: `never`, `intended`, `proven` or `any`. To make CI fail only on changes nobody declared, set the gate to `collateral`. Both are in the [configuration reference](../reference/configuration.md#agent-context-agent).

## Next

* [Agent workflows](../agents/workflows.md): local fixing, intentional redesigns, failing pull requests.
* [Explained changes](../agents/explained-changes.md) and [proof](../agents/proof.md): what the evidence means and where it stops.
* [Troubleshooting](../troubleshooting.md#agent-problems).
