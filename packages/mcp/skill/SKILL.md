---
name: diffra-visual-review
description: Review and resolve visual regressions found by Diffra. Use when a UI change, a failing visual check, or a request to update screenshots involves Diffra snapshots.
---

# Reviewing visual changes with Diffra

Diffra compares screenshots of the interface with approved baselines. Use its tools to see what changed, decide whether each change is intended, and fix or approve it.

## Steps

0. Before you change anything, call `diffra_declare_intent` with a sentence on what you will change and the stylesheets (`sources`) or snapshots (`targets`) it may touch. Later runs then tell the change you meant from damage you did not.

1. Call `diffra_run` with `filter` set to the component or page you changed, so only it is captured. Skip this when you only need to read a run that already exists.
2. Read the result of `diffra_list_changes`. Work through changed, then added, then removed, then failed snapshots.
3. For each changed snapshot, call `diffra_explain`. It names the element and styles that changed, the stylesheet rule behind them, and whether that file changed in this branch. A cause is attributed, not proven, so treat it as where to look first. If you need to be sure of it before you act, call `diffra_prove`: it undoes the cause in the live page, and the cause is proven only if that restores the baseline. A region with no cause is not accounted for by the page.
4. Call `diffra_view` with `region: 0` (then 1, 2, and so on up to `regions - 1`). You get the baseline and candidate cropped to that area. Do not request whole screenshots unless the crops leave you unsure.
5. Compare what you see, and the cause you were given, with what you meant to change. If the change is not intended, call `diffra_prove` on it, then `diffra_suggest_fix` for a patch that undoes it. Apply a patch only if the change was not intended.
   After you edit, call `diffra_verify` (with `affected: true` while iterating) and check `resolved` and `newlyChanged`. If it lists unmatched files that are component code, run once without `affected`.
   * If it matches your intent, it is intended.
   * If it does not, the change is a regression. Use the `filePath` of the snapshot as the first place to look, fix the code, and run again.
6. Call `diffra_approve` with the ids of the intended snapshots only. Give a `rationale` that says why the change is intended. The project decides what you may approve: by default only changes that a declared intent covers. If a snapshot is refused, read why, then fix the code, or declare an intent only if the change really is part of your task. Do not declare an intent just to be allowed to approve. Never approve a snapshot you have not looked at, and never approve to make a check pass.

## Reading states

* changed: the snapshot differs from its baseline.
* added: new, with no baseline. Approve it only if it should exist.
* removed: it had a baseline but was not captured. Check that the removal was intended.
* failed: it could not be captured. This is not a visual change. Read the note, fix the cause, and run again.

## Limits

If `diffra_status` reports `canRunAndApprove: false`, the server is read-only. Report what you found and leave approval to a person.
