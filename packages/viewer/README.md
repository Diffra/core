# @diffra/viewer

Minimalist Scandinavian visual regression review interface and report viewer.

---

## Overview

`@diffra/viewer` is the static review web application designed with Scandinavian minimalism principles. It presents visual differences through tonal contrast, clear visual hierarchy, and instant zero-config rendering modes.

---

## Key features

* **Four inspection modes**:
  * **Pixel movement (`ScanEye`)**: High-contrast neon green highlighting over a desaturated candidate backdrop.
  * **Side-by-side (`Columns2`)**: Simultaneous view of baseline and candidate side-by-side.
  * **Split curtain slider (`SlidersHorizontal`)**: Interactive drag slider to reveal baseline versus candidate with sub-pixel precision.
  * **Layer onion-skin (`Layers`)**: Continuous alpha opacity crossfade to inspect structural alignments.
* **Component-first sidebar**: Structured navigation categorized by component and story, complete with live search and popover filters.
* **Keyboard navigation**: Instant traversal and mode switching (`1`–`4` for modes, `J`/`K` for story navigation, `Space` for A/B toggling).
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
