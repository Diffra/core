# Fixes and verification

Once a cause is proven, Diffra can say how to undo it. After a change, it can say which of the open changes are resolved. Together these close the loop an agent works in: find the cause, undo or keep it, check.

## Suggested fixes

```bash
diffra fix <snapshot-id> | git apply
```

An agent calls `diffra_suggest_fix`. A fix is suggested only for a snapshot whose cause is [proven](proof.md), so that it undoes a change that is known to produce the difference. Each suggestion says:

* which styles to put back, with their earlier values as the browser computed them,
* the stylesheet and rule that set them, and whether that file changed in this branch,
* a unified diff, when the earlier values can be written back exactly.

A patch is offered only when Diffra can find the rule in a stylesheet of the project and every changed value is written there as the browser computed it. A value written as `2rem` or `red` is not matched by `32px` or `rgb(255, 0, 0)`, and Diffra does not guess: the suggestion then says what to restore and where, without a patch. A built or bundled stylesheet that is not in the project gets the same.

With `diffra fix`, standard output is only the patch, so it can be piped to `git apply`. Explanations go to standard error. The exit code is `0` only when a patch was written.

Apply a patch only if the change was not intended. If the new styles were wanted, the patch is the change to avoid, and the change should be approved instead.

## Verifying

```bash
diffra verify
diffra verify --affected
```

An agent calls `diffra_verify`. It runs the tests again and compares with the run before it:

| Field | Meaning |
| :--- | :--- |
| `resolved` | Changed or failed before, unchanged now. |
| `stillChanged` | Changed or failed before, and not unchanged now: still changed, or now failed, removed or added. |
| `newlyChanged` | Not changed before, and changed, added, removed or failed now. |
| `notChecked` | Open before but not captured in this run, for example because of a filter. |

`diffra verify` exits `1` when anything is still changed or newly changed.

## Affected snapshots

With `affected`, only the snapshots that the changed files are known to reach are captured. What each snapshot depends on comes from the page context of the last run: the stylesheets that styled it, and the file that defines it. No bundler integration is needed.

Changed files are those that differ from the baseline commit, including uncommitted edits and files git does not track yet.

* A changed file that no snapshot is known to depend on is listed as unmatched. If it is component code, its snapshots are not in the affected set, so run without `affected`.
* When nothing is known, because there is no earlier run or it recorded no page context, or when no changed file reaches any snapshot, everything is captured, and the result says so.
* A run of only the affected snapshots is marked as partial in the report. It does not report the other snapshots as removed, and approving from it does not replace the list of snapshots that the baseline holds.
