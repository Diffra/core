# Core comparison engine

Diffra's pixel comparison engine (`@diffra/engine`) is engineered for ultra-fast perceptual image diffing using native Rust SIMD acceleration with a pure TypeScript fallback.

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

## Hardware SIMD acceleration

The Rust engine (`packages/engine/src/lib.rs`) utilizes vector registers (256-bit AVX2 on x86-64 and 128-bit NEON on ARM64) to compare 4 to 8 pixels simultaneously per instruction:

* Native Node-API (`@napi-rs`) binary bindings.
* Zero memory allocations in the inner comparison loop.
* Automated memory recycling across Playwright workers.

---

## Anti-aliasing detection

Subpixel font rendering creates intermediate color shades along curved edges. Diffra analyzes local $3 \times 3$ pixel neighborhoods around differing pixels to identify whether a color variation is an anti-aliasing gradient rather than a genuine layout shift.

---

## Spatial bounding box clustering

When visual differences are detected, the clustering engine groups adjacent changed pixels using spatial proximity analysis, generating minimal bounding boxes (`BoundingBox[]`) displayed as wireframes in the review UI.
