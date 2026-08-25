# Getting started with Diffra

Diffra is a self-hosted, general-purpose visual regression testing platform that captures and compares screenshots across your web applications, design systems, and component libraries.

---

## How visual regression testing works

Visual regression testing protects your UI from unintended visual breakage, broken styling, and layout shifts during active development:

1. **Target discovery**: Diffra scans your codebase for visual targets — whether Storybook stories, live web application routes, static image files, or Figma frames.
2. **Headless capture**: Playwright browser workers render each target in parallel, freezing CSS animations and waiting for web fonts to stabilize.
3. **Deterministic comparison**: Candidate screenshots are compared against the target Git branch baseline (`origin/main`) using Content-Addressed Storage (CAS) fast-path matching and native SIMD pixel diffing.
4. **Review & approval**: Diffra generates a standalone interactive review report with 6 inspection modes and posts sticky summaries to your pull requests. Approved changes become the new baseline when PRs merge.

---

## Installation

Install `@diffra/cli`, `@diffra/core`, and `@diffra/engine` as development dependencies in your project:

```bash
# Using pnpm
pnpm add -D @diffra/cli @diffra/core @diffra/engine

# Using npm
npm install --save-dev @diffra/cli @diffra/core @diffra/engine

# Using yarn
yarn add -D @diffra/cli @diffra/core @diffra/engine
```

---

## Choose your integration path

Select the quickstart guide that fits your application architecture:

* **[Storybook quickstart](storybook-quickstart.md)**: Set up visual regression for Storybook 7/8/9 with React, Vue, Svelte, or Web Components.
* **[Web applications quickstart](web-apps-quickstart.md)**: Test live web routes on Next.js, Remix, Vite, Astro, Nuxt, or any running local server.
* **[Playwright test runner quickstart](playwright-quickstart.md)**: Integrate visual baseline assertions directly into your existing Playwright test suites using `toMatchVisualBaseline`.

---

## Core workflow

Once installed and configured, your day-to-day visual testing loop consists of four simple commands:

```bash
# 1. Run visual tests against local dev server or Storybook
diffra test

# 2. Automatically open review UI in browser
diffra test --open

# 3. Serve the latest test report locally on port 9000
diffra serve

# 4. Approve candidate screenshots as the new baseline
diffra approve
```
