# Agent workflows

Four situations where an agent uses Diffra, in the order they come up. Each lists what the agent does and what stays with a person.

## Fix a regression you did not intend

An edit changed more than it should have. The agent finds out, undoes the unintended part and keeps the rest.

1. Declare the intent of the edit, then make it.
2. `diffra_run` with a `filter` for the component, then `diffra_list_changes`.
3. For each change that the intent does not cover, `diffra_explain`, then `diffra_view` on the region if the text is not enough.
4. `diffra_prove` on the cause, then `diffra_suggest_fix`. Apply the patch, or edit the code from the element, values and file it names.
5. `diffra_verify` with `affected`. Done when the change is `resolved` and nothing is `newlyChanged`.

A person reads the diff and the pull request. The agent approves only what a declared intent covers.

## Land an intentional redesign

A token, a theme or a layout changes on purpose, and many snapshots change with it.

1. Declare the intent with the stylesheets the change comes from. Many changes can share one intent.
2. Make the change and run.
3. Every change that traces to the declared sources is classified `intended`. Anything else is `collateral` and gets the loop above.
4. Approve the intended snapshots with a rationale that says why they are wanted.

With the gate set to `collateral`, CI passes on the intended changes and fails on the rest, so the pull request shows what the redesign touched without turning the check red. A person reviews the intended changes in the [review interface](../review-ui/overview.md) before merging.

## Triage a failing pull request

CI failed. An agent job starts from the published review bundle and ends with commits on the branch.

1. Read the bundle with `diffra mcp --report <address>`. This server is read-only: the agent can list, explain and view, and cannot run or approve.
2. Check out the branch. The explanation names the source file and whether it changed in this branch, so the agent starts at the right place.
3. Continue with the local loop: declare, edit, `diffra_prove`, `diffra_suggest_fix`, `diffra_verify`.
4. Push the fix. The next CI run replaces the failing check.

Approval stays out of the read-only server by design, so the agent cannot change what the team accepted from a CI job.

## Check the blast radius before you push

A shared component or token changed, and the question is what else moves.

1. Run `diffra verify --affected` or call `diffra_verify` with `affected`. Only the snapshots that the changed files are known to reach are captured, so this takes seconds instead of a full run.
2. Read what is `newlyChanged`. Unmatched files are listed: if one is component code, run once without `affected`.
3. Fix or declare, as above.

## What can be fixed how

| Situation | What Diffra gives the agent |
| :--- | :--- |
| A style change in a stylesheet of the project, with exact values | A proven cause and a patch that restores the old values. |
| A style change set another way, such as a computed unit or a built stylesheet | A proven cause, the values to restore and the rule that sets them, without a patch. |
| A changed text, or an added or removed element | The explanation and the element. Proof does not apply, so the agent edits the code itself, and `diffra_verify` checks it. |
| Pixels with no cause in the page, such as an image or a canvas | The changed region, marked as not accounted for by the page. |
| An environment difference, such as fonts | Nothing to fix in code. See [flakiness and determinism](../guides/flakiness-and-determinism.md). |

In every case the agent can check the result with verification. A patch is a suggestion: the agent decides whether the change was wanted before applying it.
