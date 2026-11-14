# @diffra/demo-storybook

Demonstration design system and working Storybook 10 workspace with Diffra visual regression testing configured.

---

## Overview

This package serves as a real-world reference implementation of Storybook 10 with `@diffra/cli` and `@diffra/core`.

### Included components

The first group exercises individual snapshot parameters:

* **Button**: Responsive parameter matrix with multiple viewport definitions.
* **Card**: Custom perceptual difference thresholds and layout tests.
* **Modal**: Animation settling and delay parameters (`pauseAnimationAtEnd: true`).
* **Badge**: Snapshot exclusion and parameter override demonstrations.

The second group models the regressions that visual testing catches in real products. Each story is named for the state it shows, and its comment says what a regression would look like.

| Component | Stories cover |
| --- | --- |
| **TextField** | Empty, filled, keyboard focus ring, validation error, disabled |
| **Alert** | Success, warning, error with action, long text wrapping |
| **InvoiceTable** | Numeric column alignment, truncated names, empty and loading states |
| **NavBar** | Responsive breakpoint, open mobile menu, notification badge overflow |
| **PricingCard** | Call-to-action alignment across cards, long plan names, discounts |
| **ProductCard** | Failed image fallback, sale price, sold-out overlay, long titles |
| **Avatar** | Initials fallback, failed photo, presence dot, overflow counter |
| **ProfileCard** | Skeleton loading layout, long name and role truncation |
| **DropdownMenu** | Open overlay, keyboard focus, disabled and destructive items |
| **CheckoutSummary** | Currency formatting, German text length, Arabic right-to-left layout |
| **UsageChart** | Axis scaling with an outlier, small values, empty data |

Interactive states (focus, open menus) are produced with `play` functions from `storybook/test`. Design tokens shared by the new components live in [`src/theme.ts`](./src/theme.ts).

---

## Running locally

```bash
# Start Storybook dev server
pnpm storybook

# Execute visual regression tests
pnpm test:visual

# Approve candidate screenshots as new baseline
pnpm test:visual:approve

# Open the visual review viewer
pnpm test:visual:serve
```

---

## Configuration

See [`diffra.config.ts`](./diffra.config.ts) for sample configuration:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  drivers: 'storybook',
  snapshot: {
    diffThreshold: 0.05,
  },
  runner: {
    concurrency: 4,
  },
});
```

---

## License

MIT
