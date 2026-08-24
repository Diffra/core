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

## Package structure

The monorepo contains four packages:

### 1. @diffra/core
Contains the CLI binary, test runner orchestrator, Playwright browser pool, Git merge-base resolver, OXC AST parser, report generator, and pluggable storage and notifier drivers.

### 2. @diffra/diff
Contains the native Rust SIMD pixel comparison engine (`packages/diff/src/lib.rs`) compiled via Node-API (`@napi-rs`), along with spatial bounding box clustering algorithms. Falls back to a pure TypeScript implementation if prebuilt native binaries are unavailable.

### 3. @diffra/viewer
Contains the static Web Components visual review interface (`packages/viewer/src/components/`), design tokens (`theme.css`), and an IIFE bundle compiler that packages the UI into a single self-contained distribution (`dist/viewer.bundle.js`).

### 4. @diffra/storybook
A showcase design system built with Storybook 8 (`@storybook/react-vite`) and React 19, serving as a live testing ground and integration reference.
