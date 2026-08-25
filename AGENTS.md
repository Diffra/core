# Guidelines and learnings for AI agents

This document records architectural principles, conventions, and operational learnings for AI agents contributing to the Diffra codebase.

---

## Architectural principles

### 1. Minimal dependencies and standard web APIs
* Avoid introducing third-party runtime dependencies when standard runtime or language capabilities exist.
* For CLI applications, use Node.js built-in `node:util` `parseArgs` instead of external CLI packages like `commander` or `yargs`.
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
* Maintain modern canonical parameter names without introducing or referencing non-standard aliases.

### 3. Documentation style
* **Tone**: Technical, clear, concise, and professional.
* **Headings**: Use sentence case (e.g. `# Architecture and core engine`, `## Available options`). Avoid title casing where every word is capitalized.
* **Formatting**: Avoid emojis, decorative symbols, or unnecessary formatting in documentation and comments.
* **Naming**: Do not reference external commercial brand names or competitors. Keep terminology vendor-neutral and component-centric.

### 4. Monorepo structure and package boundaries
* `packages/core`: Core test runner, Playwright coordinator, Git merge-base resolver, report inliner, pluggable drivers.
* `packages/engine`: Rust SIMD pixel comparison engine with Node-API (`@napi-rs`) bindings.
* `packages/cli`: Zero-dependency command-line binary (`diffra`).
* `packages/viewer`: Static Web Components review UI bundled via Vite as a standalone IIFE bundle (`dist/viewer.bundle.js`).
* `packages/action`: GitHub Action runner with path traversal protection and secret masking.
* `packages/demo-storybook`: Real working demo of Storybook 8 with Diffra visual regression.
* `packages/demo-app`: Real working demo of a Vite TypeScript web application with Diffra configured.

### 5. Storybook version pinning in monorepos
* When integrating Storybook in a pnpm monorepo, ensure all Storybook dependencies (`storybook`, `@storybook/react`, `@storybook/react-vite`, `@storybook/addon-essentials`, `@storybook/builder-vite`) share the exact same major and minor version to prevent runtime export mismatch errors in Vite builders.

### 6. Security standards
* **Path traversal**: Any internal preview or static server must validate that requested paths canonicalize within the designated root directory using `path.resolve` boundary verification.
* **Secret masking**: Always register tokens with `core.setSecret` in GitHub Actions.
* **Teardown**: Always ensure background HTTP servers, browser pools, and file descriptors are closed inside `finally` blocks to prevent hanging CI worker processes.

### 7. Review UI and Scandinavian design standards
* **Aesthetics**: Premium Scandinavian minimalism with flat tonal surfaces, zero drop-shadows, and minimal border complexity. Visual hierarchy is defined by calm surface shifts (`bg-zinc-50`, `bg-zinc-100`, `bg-zinc-200/50`, `bg-white`) rather than borders around every button and tag.
* **Typography system**: Exclusively use Inter with proper font loading preconnects and imports (`wght@300..600`). The root and minimum font size is `1rem` across all text (`html { font-size: 1rem; }`). Never use monospace, sub-1rem text sizes, or uppercase headlines/buttons. Section headlines use natural case and a larger variant (`.text-ui-heading`). Always use `rem` units for typography, spacing, and sizing. Standardize typography on designated light-to-medium UI variants:
  * `.text-ui-base`: `1rem`, regular (weight `400`), line-height `1.5`, letter-spacing `-0.015em`.
  * `.text-ui-medium`: `1rem`, medium-light (weight `450`), line-height `1.5`, letter-spacing `-0.015em`.
  * `.text-ui-semibold`: `1rem`, medium (weight `500`), line-height `1.4`, letter-spacing `-0.02em`.
  * `.text-ui-heading`: `1.125rem`, medium (weight `500`), line-height `1.35`, letter-spacing `-0.025em`.
  * `.text-ui-title`: `1.25rem`, semibold-light (weight `550`), line-height `1.3`, letter-spacing `-0.03em`.
  * `.text-ui-label`: `1rem`, medium (weight `500`), line-height `1.35`, letter-spacing `-0.015em`.
* **Noise elimination & balanced contrast**: Never display diff percentages (`0.5%`), pixel dimensions (`1280×800`), pixel diff counts (`50 px diff`), or tally numbers on navigation tabs. Maintain rich, legible contrast on flat, borderless status badges and primary labels.
* **Layout hierarchy**: A unified top header bar integrates the Diffra brand and exactly two clean breadcrumb buttons (`[ LayoutGrid Overview ]` and `[ Component / StoryName ]`) with no separator characters. A DRY shared stage bar sits above all comparison modes with baseline/candidate branch and commit tags linked to GitHub. The sidebar positions directly below the header starting with a clean white search input and native HTML Popover API filter, followed by natural-case component headlines and interactive snapshot buttons.
* **Iconography**: Exclusively import icons directly from `lucide-react` (e.g. `LayoutGrid`, `ScanEye`, `Columns2`, `SlidersHorizontal`, `Layers`, `SquareDashed`, `ListFilter`, `Search`, `X`, `Check`). Avoid custom intermediate icon wrapper files.
* **Comparison defaults**: Pixel movement (`ScanEye` icon, neon green highlight over desaturated candidate backdrop) is the default inspection mode with zero-config instant rendering.

### 8. Anti-hardcoding and hermetic design principles
* **Zero magic network literals**: Never hardcode loopback IP addresses (`127.0.0.1`), hostnames (`localhost`), or fixed port numbers in servers or client requests. Always bind and inspect dynamic sockets using `server.address()` (supporting port `0` for dynamic port allocation and IPv6/IPv4 normalization).
* **Zero magic literals and arbitrary thresholds**: Never hardcode magic numbers, custom tolerances, magic DOM selectors, or branch names (`origin/main`) inline without single-source-of-truth constants or configuration options.
* **Configurable endpoints**: All external service URLs (Figma, GitHub, storage endpoints, viewers) must be injectable via configuration and environment variables with sensible standard defaults, allowing self-hosted and offline mock environments.
* **Unopinionated domain isolation**: Do not inject domain-specific defaults (such as Storybook ports/URLs) into top-level generic configuration schemas.
* **Explicit configuration over presumptive conventions**: Discover or accept paths, branches, and layouts from the user or live environment rather than making rigid assumptions about repository structure.

### 9. Zero legacy terminology and modern API purity
* **No legacy mentions or baggage**: Never use the term "legacy" in code comments, type definitions, docstrings, or user documentation. 
* **First-principles API design**: Always design and reference clean, canonical modern interfaces directly without preserving obsolete conventions or backward-facing terminology.

### 10. CI/CD first product narrative
* **Automated workflow over manual CLI**: Diffra is engineered primarily as an automated visual regression engine embedded directly in GitHub Actions and CI/CD pipelines. All documentation, quickstarts, and promotional material must lead with the automated CI/CD lifecycle (GitHub Action, automated PR status checks, PR comments with review links, cloud storage baselines, auto-accept on merge).
* **CLI as supporting utility**: Position local CLI execution as a secondary, supporting utility for debugging or local approvals, never as the primary day-to-day workflow.
