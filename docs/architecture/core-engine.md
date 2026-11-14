# Core comparison engine

Diffra's pixel comparison engine (`@diffra/engine`) compares images perceptually. It has a TypeScript implementation that is always available and an optional native Rust build that gives the same results faster.

---

## Perceptual color comparison (YIQ color space)

Human vision is significantly more sensitive to luminance variations than chrominance variations. Diffra transforms raw RGBA pixel pairs into the NTSC YIQ color space:

$$\begin{aligned}
Y &= 0.29889531 \cdot R + 0.58662247 \cdot G + 0.11448223 \cdot B \\
I &= 0.59597799 \cdot R - 0.27417610 \cdot G - 0.32180189 \cdot B \\
Q &= 0.21147017 \cdot R - 0.52261711 \cdot G + 0.31114694 \cdot B
\end{aligned}$$

The perceptual delta-E color variance is computed as:

$$\Delta E = 0.5053 \cdot (\Delta Y)^2 + 0.299 \cdot (\Delta I)^2 + 0.1957 \cdot (\Delta Q)^2$$

A pixel difference is registered only when $\Delta E$ exceeds the configured perceptual threshold (default `0.063`).

---

## Native and TypeScript implementations

Both implementations follow the same algorithm and a parity test suite checks that they report the same changed pixels, regions and dimensions across identical images, solid and sub-threshold changes, shifts, transparency, thresholds, anti-aliasing and size differences.

* The TypeScript implementation is always available.
* The Rust implementation (`packages/engine/src/lib.rs`) is built with `pnpm --filter @diffra/engine build:native` and is used automatically when present. It is a single-threaded loop that does not use SIMD instructions. On 1280 by 800 screenshots, measured on an Apple silicon laptop, it was about 3 to 16 times faster than the TypeScript implementation, with the largest gains when many pixels differ.
* `engineKind()` reports which implementation is running.

---

## Anti-aliasing detection

Subpixel font rendering creates intermediate color shades along curved edges. Diffra analyzes local $3 \times 3$ pixel neighborhoods around differing pixels to identify whether a color variation is an anti-aliasing gradient rather than a genuine layout shift.

---

## Spatial bounding box clustering

When visual differences are detected, the clustering engine groups adjacent changed pixels using spatial proximity analysis, generating minimal bounding boxes (`BoundingBox[]`) displayed as wireframes in the review UI.
