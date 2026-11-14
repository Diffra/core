# @diffra/engine

Pixel comparison for visual regression. There are two implementations that give the same results: one in TypeScript, and an optional native build in Rust that is several times faster.

---

## Overview

`compareImages` decodes two PNG images, compares them pixel by pixel using a perceptual colour difference in the YIQ colour space, ignores anti-aliasing noise, and returns the number of changed pixels, the changed regions as bounding boxes, and an optional diff image.

The TypeScript implementation is always available. If a native binding has been built for the platform, the engine uses it automatically.

| Implementation | Availability | Speed |
| :--- | :--- | :--- |
| TypeScript | Always | Baseline |
| Native (Rust, single-threaded) | After `pnpm --filter @diffra/engine build:native` | About 3 to 16 times faster on 1280 by 800 screenshots, measured on an Apple silicon laptop |

The native code is a plain loop. It does not use SIMD instructions or multiple threads. A test suite compares both implementations on identical images, solid and sub-threshold changes, one-pixel shifts, transparency, stricter thresholds, anti-aliasing and differing dimensions, so they agree on every changed pixel and region.

---

## Usage

```typescript
import { compareImages, engineKind } from '@diffra/engine';

const result = await compareImages(baselinePng, candidatePng, {
  threshold: 0.063,
  generateDiffImage: true,
});

console.log(engineKind()); // 'native' or 'typescript'
console.log(result.hasDiff, result.diffCount, result.diffPercentage);

for (const box of result.boundingBoxes) {
  console.log(`Changed region: x ${box.minX}-${box.maxX}, y ${box.minY}-${box.maxY}`);
}
```

Raw RGBA buffers of the same size can be compared directly with `compareRawRGBA(baseline, candidate, width, height, options)`.

---

## Building the native binding

Requires a Rust toolchain.

```bash
pnpm --filter @diffra/engine build:native
```

This writes `native/diffra-diff.<platform>-<arch>.node` inside the package. Set `DIFFRA_NATIVE_BINDING` to the path of a binding file to use one from elsewhere.

---

## Package exports

* `@diffra/engine`: `compareImages`, `compareRawRGBA`, `engineKind`, `typescriptEngine`, and everything below.
* `@diffra/engine/clustering`: `clusterBoundingBoxes`, which groups changed pixels into regions.
* `@diffra/engine/png`: `decodePng` and `encodePng`, dependency-free PNG handling.
* `@diffra/engine/types`: option and result types.

---

## License

MIT
