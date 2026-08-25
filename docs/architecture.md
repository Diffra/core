# Architecture and core engine

Diffra is a visual regression testing engine engineered for speed, self-hosted reliability, and zero cloud lock-in.

---

## Execution pipeline

```mermaid
flowchart TD
    A[Storybook CSF files] -->|OXC Rust AST parser| B[Story and parameter matrix]
    B -->|Parallel Playwright pool| C[Candidate screenshots]
    D[Target branch e.g. origin/main] -->|Git merge-base resolver| E[Baseline commit discovery]
    E -->|Storage adapter| F[Baseline screenshots]
    C & F -->|@diffra/diff Rust SIMD| G[Pixel comparison engine]
    G -->|Zero-dependency web components| H[Single-file HTML report]
    G -->|Notifier plugins| I[GitHub check, PR comment, Slack webhook]
```

The pipeline executes through sequential phases:

1. **Discovery and AST extraction**: Scans for story files and extracts CSF metadata using the native OXC parser in less than 3 milliseconds without loading component runtime dependencies.
2. **Task matrix generation**: Generates a matrix of test tasks by combining each story with its configured viewports (global defaults overridden by per-story viewports).
3. **Parallel browser capture**: Launches headless Playwright workers across the configured concurrency pool. Automatically injects CSS overrides to freeze CSS animations, transitions, and blinking carets, awaits font loading via `document.fonts.ready`, and captures PNG screenshots.
4. **Baseline retrieval and merge-base resolution**: Discovers the common ancestor Git commit between the current `HEAD` and the target branch (`git merge-base HEAD origin/main`) and retrieves the baseline screenshots from the configured storage driver.
5. **SIMD pixel diffing**: Executes pixel comparison on native worker threads using AVX2 and ARM NEON hardware acceleration. Calculates perceptual delta-E in the YIQ color space, ignores anti-aliased edge transitions, and clusters changed pixel regions into spatial bounding boxes.
6. **Report bundling**: Inlines the JSON manifest, Web Components bundle, and base64-encoded PNG screenshots into a self-contained HTML file.
7. **Notifications**: Emits commit status checks and sticky markdown summaries to GitHub pull requests and Slack webhooks.

---

## Package structure and subpath architecture

The monorepo is structured around modular zero-side-effect packages with explicit subpath exports:

### 1. @diffra/core
Core test runner orchestrator, Playwright browser pool, Git merge-base resolver, OXC AST parser, and report generator. Exposes isolated subpath surfaces via `package.json` `exports`:
* `@diffra/core`: Root visual regression test runner (`runVisualRegression`, `approveBaselines`).
* `@diffra/core/config`: Configuration helper (`defineConfig`, `loadConfig`) and schema validators.
* `@diffra/core/plugins`: Pluggable storage and notifier drivers (`createLocalStorage`, `createS3Storage`, `createGitHubNotifier`, `createSlackNotifier`).
* `@diffra/core/drivers`: Built-in target drivers (`createStorybookDriver`, `createUrlDriver`, `createImageDriver`).
* `@diffra/core/types`: Pure TypeScript interfaces (`DiffraConfig`, `DiffraPlugin`, `VisualDriver`, `StorageAdapter`).

### 2. @diffra/diff
High-performance pixel comparison engine using native Rust SIMD acceleration (`packages/diff/src/lib.rs`) with Node-API (`@napi-rs`) bindings, spatial bounding box clustering, and pure TypeScript fallback.

### 3. @diffra/cli
Zero-dependency command-line binary (`diffra`) using Node.js built-in `node:util` `parseArgs` and standard ANSI terminal output.

### 4. @diffra/viewer
Scandinavian minimalist visual review interface and report viewer bundled as a standalone IIFE asset.

### 5. @diffra/action
GitHub Action runner for CI/CD workflows with automated PR sticky summaries and commit check annotations.

### 6. @diffra/storybook
Showcase design system built with Storybook 8 (`@storybook/react-vite`) and React 19, serving as a live testing ground and integration reference.
