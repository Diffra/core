# Proof

An explanation says which change in the page lines up with the changed pixels. That is evidence, not demonstration: two changes in the same area can look alike, and a style set another way can hide the real cause. Proof closes the gap by testing the cause in the live page.

## How it works

1. Diffra loads the page again, in the same browser and at the same size as the snapshot.
2. It first checks that the page still differs from the baseline. A page that already matches proves nothing, because the change may have been fixed since, or may not appear reliably.
3. It undoes the changes that the explanation found, by putting the earlier styles back on the elements.
4. It takes a screenshot and compares it with the approved baseline.

If the pixels match the baseline, undoing those changes is enough to undo the difference, and the change is proven to come from them. If they do not, the explanation was incomplete, and the proof says so.

## What it tells you

The result sits on the explanation as `proof`:

| Status | Meaning |
| :--- | :--- |
| `proven` | Undoing the changes restored the baseline. |
| `unproven` | It did not, or some elements could not be found again. `remainingRegions` says how many changed areas were left. |
| `not-attempted` | None of the changes is a style change that Diffra can undo, such as a changed text or an added element. |

A cause is marked `proven` only when undoing that cause alone restored the baseline. When several causes were found, Diffra first undoes all of them together. If that restores the baseline, it undoes each one alone. Independent causes that only restore the baseline together are reported as proven together, and each stays `attributed`, because none of them is enough by itself.

## Running it

```bash
diffra prove <snapshot-id>
```

An agent calls `diffra_prove`. The result is written into the reports of the run, so the review page, `diffra_explain` and `report.json` all show it afterwards.

The page the snapshot came from has to be reachable again, such as a running Storybook or development server. A proof loads the page once without undoing anything, once for the causes together and once for each cause, at most seven times, so it takes a few seconds per snapshot.

## Limits

* Only style changes are undone. A changed text or an added or removed element makes a complete proof impossible, and the result says so.
* An element is found again by its position in the document. A page that changes its structure between loads cannot be proven.
* Proof shows that the changes found are enough to explain the difference. It does not show that no other change is involved when the baseline was restored by the same revert.
