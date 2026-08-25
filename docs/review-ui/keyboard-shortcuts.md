# Keyboard shortcuts and navigation

Diffra's review interface is built for high-speed keyboard-driven triage.

---

## Keyboard shortcuts table

| Key | Action | Description |
| :--- | :--- | :--- |
| `1` | Mode: Movement | Switch to pixel movement neon green highlight mode. |
| `2` | Mode: Split view | Switch to side-by-side synchronized view. |
| `3` | Mode: Swipe slider | Switch to interactive horizontal swipe slider. |
| `4` | Mode: Onion skin | Switch to opacity crossfade blending mode. |
| `5` | Mode: Diff mask | Switch to perceptual delta-E diff mask. |
| `0` / `Escape` | Overview grid | Return to full gallery thumbnail overview. |
| `Left Arrow` / `k` | Previous target | Navigate to previous visual target in sidebar list. |
| `Right Arrow` / `j` | Next target | Navigate to next visual target in sidebar list. |
| `b` | Toggle Blink | Toggle 2Hz rapid alternating blink in Diff mask mode. |
| `/` | Focus search | Focus sidebar search filter input. |
| `[` / `]` | Slider step | Step swipe slider or onion skin opacity left/right. |

---

## Cross-branch navigation

When inspecting a pull request report, the stage bar displays links for both branches:
* Clicking the **Baseline commit** navigates directly to the target branch baseline report (`../../branches/<baselineBranch>/latest/report.json`).
* Clicking the **Candidate branch** navigates to the latest report for the current feature branch.
