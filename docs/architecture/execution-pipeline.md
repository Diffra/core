# Execution pipeline

This document details the complete end-to-end execution lifecycle of Diffra's test runner (`runVisualRegression`).

---

## Execution flow diagram

```mermaid
flowchart TD
    A[Target Discovery: Storybook Index / URLs / Images / Figma] -->|Story Index / Route Scan| B[Task Matrix: Targets x Viewports x Projects]
    B -->|CI Shard Filter e.g. 1/4| C[Assigned Partition Tasks]
    C -->|Playwright Pool: Chromium / WebKit / Firefox| D[Parallel Browser Workers]
    D -->|CSS Animation Freezing & Dynamic Masking| E[Candidate PNG Screenshots]
    E -->|SHA-256 Digest| F[Content-Addressed Storage CAS]
    G[Target Baseline Branch e.g. origin/main] -->|Git Merge-Base Resolver| H[Baseline Commit SHA]
    H -->|Download Baseline PNGs| I[Baseline Screenshots]
    E & I -->|O1 Hash Match / Rust SIMD Delta-E| J[Pixel Comparison Engine]
    J -->|Clustering & Bounding Boxes| K[Visual Test Results]
    K -->|Compile Manifest| L[report.json Manifest]
    L -->|Notifiers & Plugins| M[GitHub PR Sticky Comment & Slack Alerts]
```

---

## Pipeline phases

1. **Target discovery**: Scans configured drivers (`storybook`, `url`, `image`, `figma`, or custom drivers) to discover testable UI targets without executing component code.
2. **Task matrix & sharding**: Multiplies discovered targets by configured viewports and Playwright projects (`chromium`, `firefox`, `webkit`). Slices tasks if `--shard` is specified.
3. **Headless browser capture**: Launches parallel workers in the `BrowserPool`. Injects deterministic CSS rules to pause animations, hides carets, applies locator masks, and captures PNG screenshots.
4. **Git merge-base & CAS matching**: Computes `git merge-base HEAD <baselineBranch>`. Checks if the candidate SHA-256 hash matches the baseline SHA-256 hash ($O(1)$ fast-path).
5. **Pixel diffing & clustering**: Runs hardware-accelerated SIMD YIQ comparison for differing images and computes bounding boxes.
6. **Manifest compilation**: Compiles a structured `report.json` with branch URLs and links to images.
7. **Notifications & review**: Emits GitHub commit checks, posts/updates sticky PR comments, and sends Slack webhook alerts.
