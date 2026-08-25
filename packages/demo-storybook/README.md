# @diffra/demo-storybook

Demonstration design system and working Storybook 8 workspace with Diffra visual regression testing configured.

---

## Overview

This package serves as a real-world reference implementation of Storybook 8 with `@diffra/cli` and `@diffra/core`.

### Included components

* **Button**: Responsive parameter matrix with multiple viewport definitions.
* **Card**: Custom perceptual difference thresholds and layout tests.
* **Modal**: Animation settling and delay parameters (`pauseAnimationAtEnd: true`).
* **Badge**: Snapshot exclusion and parameter override demonstrations.

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
  driver: 'storybook',
  storybookUrl: 'http://localhost:6006',
  diffThreshold: 0.05,
  concurrency: 4,
});
```

---

## License

MIT
