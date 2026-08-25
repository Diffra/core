# Static images and canvas diffing

Diffra's Image driver (`@diffra/core/drivers/image.ts`) allows you to run high-performance visual regression tests directly against pre-rendered image files without launching headless Playwright browser instances.

---

## Common use cases

* **Canvas & WebGL graphics**: Validating custom chart engines, 3D Canvas visualizers, or WebGL rendering pipelines.
* **Icon and asset directories**: Catching unintended color, padding, or stroke changes across SVG/PNG icon sets.
* **Document and PDF page exports**: Validating rendered PDF reports and invoice templates.
* **External screenshot pipelines**: Diffing screenshots produced by Cypress, Puppeteer, Selenium, or native mobile harnesses (iOS Simulator / Android Emulator).

---

## Configuration

Set `driver: 'image'` in `diffra.config.ts`:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  driver: 'image',

  // Directory containing candidate image files
  imagesDir: './screenshots/candidates',

  // Perceptual sensitivity threshold
  diffThreshold: 0.05,
});
```

---

## Directory structure

Diffra recursively scans `imagesDir` for `.png`, `.jpg`, `.jpeg`, and `.webp` files. Subdirectories are automatically mapped to component groups in the review interface:

```
screenshots/candidates/
├── Icons/
│   ├── chevron-down.png
│   ├── search.png
│   └── user-profile.png
├── Charts/
│   ├── area-chart-monthly.png
│   └── bar-chart-breakdown.png
└── PDF/
    └── invoice-page-1.png
```

---

## CLI execution

Run the image comparison pipeline directly:

```bash
pnpm diffra test --driver image
```

Approve new baselines:

```bash
pnpm diffra approve
```

Baseline images are persisted into `.diffra/baselines/` and compared against candidate images using the native SIMD Rust engine.
