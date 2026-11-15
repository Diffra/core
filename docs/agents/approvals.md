# Approvals

Approving a change makes it the new baseline for the current commit. For a person that is a decision at a keyboard. For an agent it needs rules, because an agent that can approve anything can make any check pass.

## The policy

`agent.autoApprove` sets what an agent may approve through `diffra_approve` without a person:

| Value | An agent may approve |
| :--- | :--- |
| `never` | Nothing. A person runs `diffra approve`. |
| `intended` | Changes that a declared intent covers. This is the default. |
| `proven` | Changes that a declared intent covers and whose cause is [proven](proof.md). |
| `any` | Any change. Use it only when a person reviews what the agent approved afterwards. |

A refused snapshot says what is missing: no intent was declared, the change is not covered by the one that was, or the cause has not been proven yet. Nothing is approved unless every listed snapshot is allowed.

The policy governs agents. A person can always approve with `diffra approve`.

```ts
export default defineConfig({
  agent: { autoApprove: 'proven' },
});
```

## The approval record

Every approval appends one line to `approvals.jsonl` in the output directory:

| Field | Meaning |
| :--- | :--- |
| `at` | When it was approved. |
| `actor` | `agent` or `human`. |
| `rationale` | Why the changes are intended. An agent must give one. For a person, `diffra approve --rationale`. |
| `runId`, `commit` | The run the candidates came from, and the commit whose baseline they became. |
| `snapshots` | For each snapshot: its id, browser, viewport, status, and whether it was classified intended or collateral and whether its cause was proven. |

The record is kept so that a reviewer can later see what was accepted, by whom, and on what evidence. A failure to write it is reported and does not stop the approval.

## Limits

* The policy is a project setting. Whoever can change the configuration can change it.
* The record says what the approver stated. It is not proof that the rationale was true.
