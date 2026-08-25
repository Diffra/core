# @diffra/engine

Hardware-accelerated Rust SIMD pixel comparison engine with Node-API (`@napi-rs`) bindings and pure TypeScript fallback.

---

## Overview

`@diffra/engine` delivers ultra-fast pixel diffing with SIMD vectorization (AVX2, SSE4.1, ARM NEON). When native binaries are unavailable, it falls back to a pure TypeScript perceptual color delta comparison.

### Key capabilities

* **Rust SIMD acceleration**: Computes perceptual pixel delta and outputs diff mask buffers at multi-gigapixel/second speeds.
* **Perceptual Delta E thresholding**: Accurately differentiates antialiasing noise and subpixel font shifts from real UI regressions.
* **Bounding box clustering**: Groups adjacent changed pixels into distinct bounding boxes with union merging and spatial padding.
* **PNG decode and encode utilities**: Zero-dependency raw PNG RGBA buffer parsing and serialization.

---

## Installation

```bash
pnpm add @diffra/engine
```

---

## Usage

```typescript
import { compareImages, clusterDiffPixels } from '@diffra/engine';

// Compare two raw RGBA pixel buffers
const result = compareImages(baselineRgbaBuffer, candidateRgbaBuffer, {
  threshold: 0.05,
  alpha: 0.1,
  diffColor: [255, 0, 0], // Red diff highlight
});

console.log(`Diff pixel count: ${result.diffCount}`);
console.log(`Percentage changed: ${result.percentage}%`);

// Cluster changed pixels into bounding boxes
const clusters = clusterDiffPixels(
  result.diffMask,
  width,
  height,
  {
    minClusterSize: 4,
    padding: 8,
  }
);

for (const box of clusters) {
  console.log(`Changed region: x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}`);
}
```

---

## Package exports

* `@diffra/engine`: Main comparison engine functions (`compareImages`, `clusterDiffPixels`, `diffImagesWithClusters`).
* `@diffra/engine/clustering`: Spatial clustering algorithms and bounding box helpers.
* `@diffra/engine/png`: Raw PNG decode and encode utilities.
* `@diffra/engine/types`: Engine options and result types.

---

## License

MIT
