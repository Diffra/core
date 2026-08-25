# Comparison inspection modes

Diffra provides six synchronized comparison inspection modes to isolate every type of visual regression, from subtle subpixel font shifts to large layout changes.

---

## 1. Pixel movement diff highlight (`Movement`) [Default]

* **Icon**: `ScanEye`
* **Shortcut**: `1`
* **Best for**: Isolating shifted, resized, or repositioned UI elements.

Highlights changed or shifted pixels in high-visibility neon green (`#00FF66`) overlaid against a desaturated monochrome candidate backdrop. This instantly draws the eye to geometry and layout shifts without color noise.

---

## 2. Split view (`Split`)

* **Icon**: `Columns2`
* **Shortcut**: `2`
* **Best for**: Direct side-by-side comparison of baseline and candidate.

Renders baseline and candidate side-by-side with synchronized zoom and pan controls. When you pan or zoom in one pane, the second pane follows synchronously.

---

## 3. Swipe slider (`Swipe`)

* **Icon**: `SlidersHorizontal`
* **Shortcut**: `3`
* **Best for**: Inspecting padding, border radius, and alignment discrepancies.

Provides an interactive vertical divider line that you can drag left and right across the canvas, dynamically clipping between baseline and candidate images.

---

## 4. Onion skin (`Onion`)

* **Icon**: `Layers`
* **Shortcut**: `4`
* **Best for**: Detecting subtle color tone shifts, opacity changes, and drop shadows.

A continuous opacity crossfade slider from 0% (baseline) to 100% (candidate). Dragging the slider smoothly fades between the two screenshots.

---

## 5. Diff mask and blink mode (`Mask`)

* **Icon**: `SquareDashed`
* **Shortcut**: `5` (Blink toggle: `B`)
* **Best for**: Highlighting exact delta-E threshold violations and bounding boxes.

Displays a high-contrast diff mask highlighting pixels that exceeded the perceptual color delta threshold, with optional red wireframe bounding boxes surrounding clustered changed regions. Pressing `B` toggles a 2Hz alternating blink mode between baseline and candidate.

---

## 6. Gallery overview (`Overview`)

* **Icon**: `LayoutGrid`
* **Shortcut**: `0` or `Escape`
* **Best for**: High-level visual triage across all tested components and viewports.

Displays a responsive grid of component cards with status badges, instant search filtering, and quick navigation to individual target inspections.
