# Monorepos and workspaces

Diffra is engineered to support large monorepos with multiple packages, web applications, and Storybook design systems using pnpm workspaces, Turborepo, or Nx.

---

## Monorepo directory structure

A typical monorepo setup organizes packages under `packages/` or `apps/`:

```
my-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── packages/
│   ├── ui/                   # Shared design system components
│   │   ├── package.json
│   │   ├── diffra.config.ts  # Package-level Diffra config
│   │   └── src/
│   └── icons/
└── apps/
    ├── web/                  # Next.js web application
    │   ├── package.json
    │   └── diffra.config.ts
    └── docs/                 # Documentation site
```

---

## Strategy A: Package-level configuration (Recommended)

Each package maintains its own `diffra.config.ts` and test script:

```typescript
// packages/ui/diffra.config.ts
import { defineConfig } from '@diffra/core/config';

export default defineConfig({
  storybookUrl: 'http://localhost:6006',
  stories: ['src/**/*.stories.@(js|jsx|ts|tsx)'],
  outputDir: '.diffra',
});
```

Add a script to `packages/ui/package.json`:

```json
{
  "name": "@my-org/ui",
  "scripts": {
    "test:visual": "diffra test",
    "test:visual:approve": "diffra approve"
  }
}
```

Run visual regression for a single package from the workspace root:

```bash
# Run for @my-org/ui only
pnpm --filter @my-org/ui test:visual
```

---

## Strategy B: Turborepo pipeline caching

Integrate Diffra into `turbo.json` so visual tests only execute when relevant package files change:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "test:visual": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "diffra.config.ts", ".storybook/**"],
      "outputs": [".diffra/**"]
    }
  }
}
```

Run across all affected packages:

```bash
pnpm turbo run test:visual
```

---

## GitHub Actions in monorepos

When running the official GitHub Action for a specific package, specify the `workingDir` input:

```yaml
- name: Run visual tests for UI design system
  uses: Diffra/core@v1
  with:
    workingDir: 'packages/ui'
    storybookBuildDir: 'storybook-static'
    token: ${{ secrets.GITHUB_TOKEN }}
    autoAcceptChanges: 'main'
```
