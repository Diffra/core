# Intent contracts

A baseline can only say what was true before. It cannot say what a change was meant to do. An intent is that missing statement: a short declaration, made before the change, of what the change may touch. Diffra then judges each changed snapshot against it, so a run can tell the change you made from damage you did not mean to cause.

## Declaring an intent

An intent has a description and at least one scope:

| Scope | Meaning |
| :--- | :--- |
| `targets` | Snapshots expected to change: an id, or text in a name or group. |
| `sources` | Stylesheets the change is expected to come from, such as `src/button.css`. |
| `selectors` | Rule selectors the change is expected to come from, such as `.btn`. |

An intent with no scope is refused, because an intent that covers everything covers nothing.

From the command line:

```bash
diffra intent add "Roomier buttons" --source src/button.css
diffra intent list
diffra intent clear
```

From an agent, with `diffra_declare_intent` before it edits anything.

From a pull request, with lines in its description. The Action reads them:

```text
Visual-Intent: Roomier buttons
Visual-Intent-Sources: src/button.css, src/tokens.css
Visual-Intent-Targets: button
```

Declared intents are kept in `.diffra/intent.json`, or in the file named by `agent.intentFile`.

## How a change is judged

When at least one intent is declared, every changed, added and removed snapshot is classified:

* **Intended**: an intent names the snapshot in `targets`, or every cause of the change comes from one of its `sources` or `selectors`.
* **Collateral**: no intent covers it. The classification says what is left over, such as "the change to h2 does not come from a declared source".

The judgement is conservative. A change is not covered when any of its causes is outside the declared scope, when a cause has no known source (such as an inline style), when the change has no explanation, or when some changed pixels are not accounted for by any change in the page.

With no intent declared, nothing is classified, and a run behaves as it always has.

## Gating on collateral changes

By default a run fails on every changed snapshot. With `agent.gate: 'collateral'`, the CLI flag `--gate collateral`, or the Action input `gate: collateral`, it fails only on collateral changes. Intended changes are reported and shown in the pull request, but they do not fail the check.

If no intent was declared, the gate still fails on every change. A gate on collateral changes cannot pass a run just because nobody said what the run was for.

## What the pull request shows

The comment lists the declared intents, then each change with its cause, unintended changes first:

```text
### Declared intent
- Roomier buttons (human)

### What changed
- 🟠 Card / Default (collateral): h2.title: margin-top 0px to 24px (src/card.css .title).
- ✅ Button / Primary (intended): button#go: padding 8px to 16px (src/button.css .btn).
```

## Agents and approval

What an agent may approve is set by the project, with `agent.autoApprove`. See [Approvals](approvals.md). By default an agent can approve only changes that a declared intent covers, and `diffra_approve` refuses the rest and says what is missing: declare an intent that covers the change, or ask a person to run `diffra approve`.

## Limits

* An intent is the author's own statement. It makes a review faster and the check more meaningful, but it is not a security control: whoever can change the code can also declare an intent that covers it.
* Matching is by stylesheet and selector, not by line. An intent for `src/tokens.css` covers every change that comes from that file.
