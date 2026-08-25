# Contributing to Diffra

Thank you for your interest in contributing to Diffra. We welcome contributions, bug reports, and feature proposals from the community.

---

## Development environment setup

### Prerequisites

* **Node.js**: `^20.18.0` or `^22.0.0`
* **pnpm**: `^10.0.0` or `^11.0.0`
* **Rust toolchain** (optional, for compiling `@diffra/engine` native bindings): `cargo` and `rustc` `^1.80.0`

### Repository setup

```bash
# 1. Clone the repository
git clone https://github.com/Diffra/core.git
cd core

# 2. Install workspace dependencies
pnpm install

# 3. Build all workspace packages
pnpm build

# 4. Run full test suite
pnpm test
```

---

## Workspace commands

| Command | Action |
| :--- | :--- |
| `pnpm build` | Compiles all TypeScript packages, diff bindings, and viewer bundle |
| `pnpm test` | Runs all unit and integration test suites via Vitest |
| `pnpm typecheck` | Validates TypeScript types across all workspace packages |
| `pnpm storybook` | Starts the showcase Storybook 8 design system dev server |
| `pnpm test:visual` | Runs visual regression tests against the showcase design system |
| `pnpm test:visual:approve` | Promotes candidate screenshots to baselines |
| `pnpm clean` | Cleans build artifacts across all packages |

---

## Pull request workflow

1. Create a descriptive feature branch from `main`:
   ```bash
   git checkout -b feat/custom-storage-plugin
   ```
2. Make your changes adhering to existing architectural standards:
   * Prefer standard web APIs and zero external runtime dependencies.
   * Write automated tests for new functionality.
   * Use sentence case for all documentation headings.
3. Verify that all tests, typechecks, and builds pass cleanly:
   ```bash
   pnpm typecheck && pnpm test
   ```
4. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/):
   * `feat(core): add azure blob storage driver`
   * `fix(drivers): handle multiline parameter objects`
   * `docs(cli): add missing flag reference`
5. Submit your pull request to the `main` branch.
