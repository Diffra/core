# @diffra/viewer

Minimalist Scandinavian visual regression review interface and report viewer.

---

## Overview

`@diffra/viewer` is the static review web application designed with Scandinavian minimalism principles. It presents visual differences through tonal contrast, clear visual hierarchy, and instant zero-config rendering modes.

---

## Key features

* **Built for review**: the home page is a visual triage of what needs a decision, most urgent first, with a thumbnail per snapshot. Hover a card to see what changed. Every snapshot state (changed, new, removed, failed, unchanged) explains itself.
* **Full-bleed inspection**: one snapshot gets the whole screen, with the controls floating over the image and a quick switcher on the title.
* **Four comparison modes**, one shared viewport and zoom:
  * **Diff (`Diff`)**: changed pixels in the accent color over a faded candidate.
  * **Side by side (`Columns2`)**: baseline and candidate with synchronized scrolling.
  * **Slide (`MoveHorizontal`)**: a draggable divider between baseline and candidate.
  * **Fade (`Blend`)**: a crossfade between the two, with blink.
* **Changed areas**: step through each changed area with `n` and `p`. The area is outlined and scrolled into view.
* **Exact links**: `#/story/<id>/<mode>` opens the same snapshot in the same mode, and `Copy link` copies it.
* **Keyboard first**: `j` and `k` for snapshots, `1` to `4` for modes, `b` to blink, `?` for the full list.
* **Self-contained distribution**: Bundled via Vite as a standalone IIFE bundle (`dist/viewer.bundle.js` and `dist/viewer.css`).

---

## Standalone bundle usage

The review UI can be embedded in any static HTML report or web application:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Diffra Visual Review</title>
    <link rel="stylesheet" href="./dist/viewer.css" />
  </head>
  <body>
    <diffra-viewer data-report-url="./report.json"></diffra-viewer>
    <script src="./dist/viewer.bundle.js"></script>
  </body>
</html>
```

---

## Development

```bash
# Start Vite development server
pnpm --filter @diffra/viewer dev

# Build standalone distribution bundles
pnpm --filter @diffra/viewer build
```

---

## License

MIT
