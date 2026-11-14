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

The second group is a set of full-page screens under `src/screens`, each modelling a failure that visual testing is used to catch. They are laid out for a 1280 by 800 browser window.

| Screen | What can go wrong |
| --- | --- |
| **Checkout** | A renamed design token leaves the pay button invisible |
| **Landing page** | A moved asset leaves the hero image missing |
| **Pricing** | A renamed data field shows every price as `$NaN` |
| **Dashboard** | A layout refactor slides content under the sidebar |
| **Sign in** | A hard-coded colour makes dark mode text unreadable |
| **Team invite** | A modal loses its positioning and drops below the page |
| **Mobile shop** | A no-wrap rule pushes buttons off the edge of the screen |
| **Product catalog** | A grid collapses to a single column |
| **Hotel search** | A clipped container hides the open date picker |
| **Bank transfer** | A loading overlay never goes away |
| **Analytics** | A data error replaces the report with a crash screen |
| **Blog** | A unit typo makes lines of text overlap |

Shared tokens, icons and artwork live in [`src/ui`](./src/ui). The artwork is inline, so the screens need no network access.

### Showcase run

Each screen breaks through a single-line change, defined in [`scripts/regressions.mjs`](./scripts/regressions.mjs). To see how Diffra reports them, approve a baseline, break the screens on a scratch branch, and run again:

```bash
pnpm test:visual && pnpm test:visual:approve
git switch -c showcase
pnpm showcase:break
pnpm build-storybook && pnpm test:visual
pnpm test:visual:serve
```

Run `pnpm showcase:restore` to undo the changes.

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
