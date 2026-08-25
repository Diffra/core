# @diffra/demo-app

Demonstration Vite TypeScript web application with Diffra visual regression testing configured.

---

## Overview

This package demonstrates full-page visual regression testing on standalone web applications using `@diffra/core` and the `UrlDriver`.

---

## Running locally

```bash
# Start Vite development server
pnpm dev

# Build production assets and start preview server
pnpm build
pnpm preview

# Run visual regression tests against preview routes
pnpm test:visual

# Approve candidate screenshots as new baseline
pnpm test:visual:approve
```

---

## Configuration

See [`diffra.config.ts`](./diffra.config.ts) for sample configuration:

```typescript
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  driver: 'url',
  baseUrl: 'http://localhost:4173',
  urls: ['/', '/about', '/features', '/pricing'],
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 800 },
  ],
  diffThreshold: 0.05,
  concurrency: 4,
});
```

---

## License

MIT
