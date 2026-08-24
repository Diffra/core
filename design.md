# Diffra design principles

This document provides a concise reference for the visual design, typography, and UX standards implemented across the Diffra suite.

---

## Core tenets

* **Scandinavian minimalism & Flat UI**: Restrained, functional, flat, spacious, and calm. Minimize border complexity and use subtle tonal surfaces (`bg-zinc-50`, `bg-zinc-100`, `bg-zinc-200/50`, `bg-white`).
* **Zero shadows**: Pure flat styling without drop-shadows.
* **Natural case typography**: Never use uppercase for headlines or buttons. Section headlines use a larger, natural-case variant (`text-ui-heading`).
* **Zero statistical noise**: No diff percentages (`0.5%`), no pixel counts (`50 px diff`), no pixel dimensions (`1280×800`), no tally numbers on navigation tabs, and no branch context in the header.
* **Typography system**: Exclusively Inter with preconnect CDN / `@import` font loading. Root minimum is `1rem`. Standardized `.text-ui-*` variants with softened, light-to-medium font weights (weights `400` to `550`) and tuned letter spacing (`-0.015em` to `-0.03em`).
* **Header navigation**: Exactly two breadcrumb buttons without separators (`Overview` and `Component / StoryName`).
* **Sidebar filtering**: Clean white search input with native HTML Popover API status filter (`All`, `Changed`, `Added`, `Passed`).
* **DRY shared stage**: Single context header bar (`Baseline vs Candidate`) permanently above the comparison view, with GitHub repository links for branch and commit tags.
* **Iconography**: Direct `lucide-react` imports (`LayoutGrid`, `ScanEye`, `Columns2`, `SlidersHorizontal`, `Layers`, `SquareDashed`, `ListFilter`, `Search`, `Check`).
* **Inspection**: Movement (neon green pixel shift highlight with `ScanEye`) is the default inspection mode.

For full architectural and design system details, see [docs/design.md](docs/design.md).
