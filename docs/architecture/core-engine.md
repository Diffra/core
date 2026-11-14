# Core comparison engine

Diffra's pixel comparison engine (`@diffra/engine`) compares images perceptually. It is written in Rust (`packages/engine/src/lib.rs`) and loaded into Node.js through Node-API.

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

## Implementation

* `compareImages` decodes both images and compares them on the libuv thread pool, so it does not block the event loop and several comparisons run at once. Each comparison is a single-threaded loop; it does not use SIMD instructions.
* `pnpm build` compiles the engine for the current platform with napi-rs. The release workflow builds it for Linux (x64 and arm64), macOS (x64 and arm64) and Windows (x64) and ships every binary with the GitHub Action.
* There is no fallback implementation. On a platform without a binary, importing the engine throws "Cannot find native binding", with the paths it tried as the cause.
* An image that cannot be decoded rejects with an error naming the baseline or candidate; the run records that snapshot as failed and continues.

---

## Anti-aliasing detection

Subpixel font rendering creates intermediate color shades along curved edges. Diffra analyzes local $3 \times 3$ pixel neighborhoods around differing pixels to identify whether a color variation is an anti-aliasing gradient rather than a genuine layout shift.

---

## Spatial bounding box clustering

When visual differences are detected, the clustering engine groups adjacent changed pixels using spatial proximity analysis, generating minimal bounding boxes (`BoundingBox[]`) displayed as wireframes in the review UI.
