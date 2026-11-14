# Review interface overview

The `@diffra/viewer` package provides the review interface included in every run's [review bundle](../architecture/review-bundle.md) and served by `diffra serve`. It is static: it needs no server and works when opened from disk.

It is built for the person who arrives from a pull request and needs to decide whether the visual changes are intended. The layout follows that job: triage, inspect, share, move on. Approval happens in CI (merge to accept, or `diffra approve`), so the viewer is read-only.

---

## Two screens

There is no sidebar and no header bar. The interface has two screens, and the image gets as much room as possible.

### Home

Home is the triage page.

```
Diffra                                                                  [?]

5 snapshots
need review
1 failed, 2 changed, 1 new, 1 removed · 14 Nov 2026, 20:03
feature/x a1b2c3d compared with main 08922c2

( To review )  Failed  Changed  Removed  New  Unchanged      [ Search     / ]

Checkout
[ thumbnail ]
Pricing table              . Failed

Button
[ thumbnail ]  [ thumbnail ]  [ thumbnail ]
Primary button  Ghost button  Loading state
```

* **Headline**: the number of snapshots that need review, in plain words. When nothing changed it says so.
* **Run context**: the candidate branch and commit, and the baseline it is compared with. Branch and commit link to the repository when the report names one.
* **Filters**: `To review` is the default. The other filters appear only for statuses that exist in the run. Unchanged snapshots are one filter away.
* **Cards**: a thumbnail of the real interface, grouped by component, most urgent first. Hover a card to see what changed.

### Snapshot

A snapshot gets the whole screen.

```
(<-)  Button . Changed                                  3 / 5  <  >  Copy link  [?]
      Primary button v
+--------------------------------------------------------------------------------+
| Baseline                                                              Candidate |
|                                                                                |
|                            full-bleed checkerboard canvas                      |
|                                                                                |
|        ( 2 changed areas ^ v )  ( Diff  Side by side  Slide  Fade )  ( Fit ... ) |
+--------------------------------------------------------------------------------+
```

* **Top bar**: back to the overview, the snapshot title, position, previous and next, and a button that copies a link to this exact snapshot and mode.
* **Switcher**: the title is a button. Click it, or press `/`, to search and jump to any snapshot without going back.
* **Floating controls**: changed areas on the left, the [comparison modes](inspection-modes.md) in the middle, and zoom on the right. They float over the canvas so the image can use the whole screen.

Every state explains itself:

| Status | What the reviewer sees |
| :--- | :--- |
| Changed | The comparison modes. |
| New | The candidate, labeled "New snapshot, no baseline yet". |
| Removed | The baseline, labeled "Removed, no candidate". |
| Failed | "Capture failed" with the reason the capture reported. |
| Unchanged | "No visual changes". |

---

## Design principles

* **Paper and one accent**: a white page, warm grey ink in three strengths, and a single cobalt accent used for focus, the diff highlight, and the slide divider. There are no grey frames and no nested boxes.
* **Space and type, not containers**: structure comes from generous spacing and type contrast. The home headline is large, light, and two-toned. Section labels are quiet.
* **One selection style**: the chosen filter, mode, and zoom are an ink pill everywhere.
* **The image owns the attention**: the checkerboard canvas is the only large tinted surface, and the controls float over it.
* **Flat**: no drop shadows. A hairline ring stands in where an edge is needed. Controls are borderless pills and large surfaces have large radii.
* **Typography**: Inter only, with a `1rem` minimum. Section titles and buttons use natural case.
* **No numeric noise**: no diff percentages, pixel dimensions, or pixel counts. Counts of snapshots appear only in plain sentences.
* **Links are exact**: `#/story/<id>/<mode>` opens the same snapshot in the same mode.
