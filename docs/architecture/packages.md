# Packages

Diffra is a pnpm monorepo. Boundaries between packages follow [AGENTS](../../AGENTS.md).

| Package | Directory | Role |
| :--- | :--- | :--- |
| `@diffra/cli` | [packages/cli](../../packages/cli) | The `diffra` command. No runtime dependencies. |
| `@diffra/core` | [packages/core](../../packages/core) | Runner, drivers, storage, explanation, proof, report generation. |
| `@diffra/mcp` | [packages/mcp](../../packages/mcp) | The agent server and skill. No runtime dependencies beyond core. |
| `@diffra/engine` | [packages/engine](../../packages/engine) | Rust comparison engine, loaded through Node-API. |
| `@diffra/viewer` | [packages/viewer](../../packages/viewer) | The review interface, bundled as one standalone file. |
| `@diffra/action` | [packages/action](../../packages/action) | The GitHub Action runner. |
| `@diffra/demo-storybook` | [packages/demo-storybook](../../packages/demo-storybook) | A working Storybook demo. |
| `@diffra/demo-app` | [packages/demo-app](../../packages/demo-app) | A working web app demo. |
