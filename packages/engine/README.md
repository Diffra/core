# @diffra/engine

Perceptual pixel comparison for visual regression, written in Rust and loaded into Node.js through Node-API.

---

## Overview

`compareImages` decodes two PNG images, compares them pixel by pixel using a perceptual colour difference in the YIQ colour space, ignores anti-aliasing noise, and returns the number of changed pixels, the changed regions as bounding boxes, and an optional diff image.

Decoding and comparison run on the libuv thread pool, so a comparison does not block the event loop and several can run at once. Each comparison is a single-threaded loop without SIMD instructions.

---

## Usage

```typescript
import { compareImages, DEFAULT_THRESHOLD } from '@diffra/engine';

const result = await compareImages(baselinePng, candidatePng, {
  threshold: DEFAULT_THRESHOLD,
  generateDiffImage: true,
});

console.log(result.hasDiff, result.diffCount, result.diffPercentage);

for (const box of result.boundingBoxes) {
  console.log(`Changed region: x ${box.minX}-${box.maxX}, y ${box.minY}-${box.maxY}`);
}
```

An image that cannot be decoded rejects with an error that names the baseline or the candidate.

---

## Exports

* `compareImages(baseline, candidate, options)`: compares two encoded images and resolves to a `DiffResult`.
* `compareRawRGBA(baseline, candidate, width, height, options)`: compares two raw RGBA buffers of the same size, synchronously.
* `decodePng(png)` and `encodePng(rgba, width, height)`: PNG decoding and encoding.
* `DEFAULT_THRESHOLD`: the perceptual threshold used when none is given (`0.063`).
* Types: `DiffOptions`, `DiffResult`, `BoundingBox`, `DecodedPng`.

---

## Building

Requires a Rust toolchain.

```bash
pnpm --filter @diffra/engine build
```

This compiles the crate with napi-rs and writes the binary for the current platform (`diffra-diff.<platform>-<arch>.node`) along with the generated `index.js` loader and `index.d.ts` types. None of these are committed.

Supported targets are listed under `napi.targets` in `package.json`. The release workflow builds each of them and ships them with the GitHub Action. There is no fallback implementation: on a platform without a binary, importing the engine throws "Cannot find native binding", with the paths it tried as the cause.

---

## License

MIT
