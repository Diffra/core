# Guidelines and learnings for AI agents

This document records architectural principles, conventions, and operational learnings for AI agents contributing to the Diffra codebase.

---

## Architectural principles

### 1. Minimal dependencies and standard web APIs
* Avoid introducing third-party runtime dependencies when standard runtime or language capabilities exist.
* For CLI applications, use Node.js built-in `node:util` `parseArgs` instead of legacy libraries like `commander` or `yargs`.
* For terminal styling, use standard ANSI escape sequences with compliance for `NO_COLOR` and `FORCE_COLOR` instead of external color packages.
* For review interfaces and reports, use standard Web Components (Custom Elements, Shadow DOM) bundled as zero-dependency self-contained distribution files.

### 2. Parameter ergonomics
* The standard namespace for Storybook snapshot parameters is **`parameters.snapshot`**.
* Standard parameters supported:
  * `delay`: Settle wait time (ms) after component render.
  * `diffThreshold`: Perceptual color delta threshold (default `0.063`).
  * `pauseAnimationAtEnd`: Freeze CSS animations/transitions at final frame (default `true`).
  * `modes`: Record of multi-mode configurations (e.g. viewports, themes).
  * `viewports`: Specific viewport dimensions to capture.
  * `disableSnapshot` / `disable`: Skip visual snapshot generation.
* Do not invent custom parameters for DOM interactions (such as `hover` or `click`). In Storybook, component interactions must be executed via the standard `play` function using `@storybook/test` (Testing Library / user-event).
* Maintain backward compatibility for legacy parameter aliases where appropriate without advertising them in documentation.

### 3. Documentation style
* **Tone**: Technical, clear, concise, and professional.
* **Headings**: Use sentence case (e.g. `# Architecture and core engine`, `## Available options`). Avoid title casing where every word is capitalized.
* **Formatting**: Avoid emojis, decorative symbols, or unnecessary formatting in documentation and comments.
* **Naming**: Do not reference external commercial brand names or competitors. Keep terminology vendor-neutral and component-centric.

### 4. Monorepo structure and package boundaries
* `packages/core`: Core test runner, AST parser, Playwright coordinator, Git merge-base resolver, report inliner, pluggable drivers.
* `packages/diff`: Rust SIMD pixel diffing engine with Node-API (`@napi-rs`) bindings.
* `packages/cli`: Zero-dependency command-line binary (`diffra`).
* `packages/viewer`: Static Web Components review UI bundled via Vite as a standalone IIFE bundle (`dist/viewer.bundle.js`).
* `packages/action`: GitHub Action runner with path traversal protection and secret masking.
* `packages/storybook`: Showcase design system built with Storybook 8 and React 19.

### 5. Storybook version pinning in monorepos
* When integrating Storybook in a pnpm monorepo, ensure all Storybook dependencies (`storybook`, `@storybook/react`, `@storybook/react-vite`, `@storybook/addon-essentials`, `@storybook/builder-vite`) share the exact same major and minor version to prevent runtime export mismatch errors in Vite builders.

### 6. Security standards
* **Path traversal**: Any internal preview or static server must validate that requested paths canonicalize within the designated root directory using `path.resolve` boundary verification.
* **Secret masking**: Always register tokens with `core.setSecret` in GitHub Actions.
* **Teardown**: Always ensure background HTTP servers, browser pools, and file descriptors are closed inside `finally` blocks to prevent hanging CI worker processes.
