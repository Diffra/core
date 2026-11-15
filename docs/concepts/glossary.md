# Glossary

| Term | Meaning |
| :--- | :--- |
| Added | A snapshot with no baseline. The first run of every snapshot is added. |
| Approval | Accepting snapshots so their candidates become baselines. Recorded in `approvals.jsonl` with who approved and why. See [approvals](../agents/approvals.md). |
| Attributed | A cause that lines up with the changed pixels but was not tested. Compare with proven. |
| Baseline | The accepted image of a snapshot, stored per commit. |
| Candidate | The image captured in the current run. |
| Changed | A snapshot whose candidate differs from its baseline beyond the threshold. |
| Classification | `intended` when a declared intent covers a change, `collateral` when none does. Only exists when intents are declared. See [intent contracts](../agents/intent-contracts.md). |
| Cause | An element whose style or text changed, that appeared or disappeared, or that moved or resized with no change of its own. See [explained changes](../agents/explained-changes.md). |
| Driver | The part that discovers targets and renders or loads them: `storybook`, `url`, `image`, `figma` or a custom one. |
| Failed | A snapshot that produced no usable image, for example a page that did not load. It is retried before it is reported. |
| Gate | The rule that decides what fails a run: every change (`any`) or only collateral ones (`collateral`). |
| Intent | A statement of what a change is meant to alter, with the targets, source files or selectors it covers. |
| Merge-base | The commit where your branch left the base branch. Baselines are read from it. See [baseline management](../guides/baseline-management.md). |
| Project | A browser configuration in a run: a browser engine plus device settings such as a color scheme. |
| Proven | A cause that was undone in the live page and made the pixels return to the baseline. See [proof](../agents/proof.md). |
| Removed | A snapshot with a baseline and no result in this run. The target was deleted or lost a viewport or browser. |
| Render ledger | The record of every visible element, its box, its computed visual styles and the rules that set them, stored with each browser snapshot. |
| Review bundle | The static review site and `report.json` written by a run. See [review bundle](../architecture/review-bundle.md). |
| Run | One execution of Diffra, identified by a run id. |
| Shard | A slice of a run, for parallel CI jobs. See [parallel sharding](../ci-cd/parallel-sharding.md). |
| Snapshot | A target at one viewport in one browser. |
| Target | One thing to capture, such as a story, route, image or frame. |
| Threshold | How different two pixels must be to count as changed. Default `0.063`. See [configuration](../reference/configuration.md). |
| Viewport | The browser window size a snapshot is captured at. |
