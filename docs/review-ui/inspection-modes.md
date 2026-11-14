# Comparison inspection modes

Four modes answer four different questions. All of them share one viewport: a checkerboard surface with one zoom (`Fit`, `100%`, `200%`, `400%`), scrolling for content larger than the surface, and labels inside the canvas. Zoom above `100%` renders pixels without smoothing.

---

## Diff

* **Icon**: `Diff`
* **Shortcut**: `1`
* **Question**: what changed?

Changed pixels are drawn in the accent color over a faded, desaturated copy of the candidate. This makes shifted, resized, or repositioned elements stand out without color noise. It is the default mode.

When the browser cannot read pixels, for example when a report is opened from disk, the diff image made by the engine at test time is shown instead.

---

## Side by side

* **Icon**: `Columns2`
* **Shortcut**: `2`
* **Question**: how do the two differ?

The baseline and the candidate next to each other. Zoom and scroll are shared, so scrolling one pane scrolls the other.

---

## Slide

* **Icon**: `MoveHorizontal`
* **Shortcut**: `3`
* **Question**: is this edge, spacing, or radius in the same place?

A divider you drag across the image. The baseline is on the left and the candidate on the right. Use the left and right arrow keys, or `[` and `]`, to move it in steps.

---

## Fade

* **Icon**: `Blend`
* **Shortcut**: `4`
* **Question**: did a color, opacity, or shadow change?

The candidate laid over the baseline. The slider blends between them. `Blink` (`b`) flips between the two twice a second, which is the quickest way to see a small shift.

---

## Changed areas

When a snapshot has more than one changed area, the toolbar shows "3 changed areas" with previous and next buttons (`p` and `n`). Stepping outlines the area and scrolls it into view in every mode, which matters for tall full-page screenshots.
