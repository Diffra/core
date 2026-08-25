# Design system and aesthetic principles

This document outlines the core visual, typographic, and architectural principles governing Diffra's user interface, review interfaces, and visual regression reporting.

---

## Scandinavian minimalism and flat tonal design

Diffra adheres to a refined Scandinavian minimalist design philosophy characterized by calm simplicity, functional clarity, flat surfaces, and generous breathing room.

### 1. Zero elevation shadows and flat UI surfaces
* Drop-shadows (`box-shadow`, `drop-shadow-*`) are strictly prohibited across all interface components.
* Avoid gratuitous borders on every sub-element. Instead, structure depth and spatial hierarchy through flat tonal surface shifts (`bg-zinc-50` backdrop, `bg-white` search and canvas, `bg-zinc-100` and `bg-zinc-200/50` grouping containers) with minimal subtle partition lines.

### 2. Balanced contrast and flat status badges
* Badges are flat, borderless, rounded pills with natural capitalization and clear legibility:
  * **Changed**: Soft warm amber backdrop with rich amber text (`bg-amber-100/90 text-amber-900`)
  * **Added**: Crisp emerald backdrop with rich emerald text (`bg-emerald-100/90 text-emerald-900`)
  * **Removed**: Restrained rose backdrop with rich rose text (`bg-rose-100/90 text-rose-900`)
  * **Passed / Unchanged**: Balanced neutral zinc backdrop with high-contrast slate text (`bg-zinc-200/60 text-zinc-700`)
* Primary text uses `text-zinc-900`, secondary labels use `text-zinc-600` or `text-zinc-500`.

### 3. Elimination of cognitive noise
* Avoid tallying numbers, count chips, and statistical clutter on navigation items, category tabs, and component headers.
* Diff percentages (e.g. `0.5%`, `1.2%`) and raw pixel counts (e.g. `50 px diff`, `1280×800`) are omitted from snapshot cards and navigation headers to keep the reviewer's focus entirely on visual artifacts.

---

## Typography and scale

### 1. Font family and font loading
* **Inter**: Exclusively use Inter (`font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
* **Preconnect and font loading**: All standalone HTML reports and index templates include Google Fonts preconnect and Inter stylesheet links (`wght@300;400;500;600`) as well as CSS `@import` rules.
* **Monospace prohibition**: Never apply monospace typography (`font-mono`, `monospace`) to viewer interfaces, headers, branches, or snapshot labels.

### 2. Natural case headlines and reduced weight scale
* **Never use uppercase for headlines or buttons**: Section headlines use natural case and larger typographic variants (`text-ui-heading`, `1.125rem`, weight `500`) rather than small uppercase tags.
* The base document root font size is strictly `1rem` (`16px`). Never use font sizes below `1rem` (`text-xs` or `text-sm` are forbidden).
* Standardized UI typography variants tuned to a lighter, refined Scandinavian weight scale:
  * `.text-ui-base`: `1rem`, regular (weight `400`), line-height `1.5`, letter-spacing `-0.015em`
  * `.text-ui-medium`: `1rem`, medium-light (weight `450`), line-height `1.5`, letter-spacing `-0.015em`
  * `.text-ui-semibold`: `1rem`, medium (weight `500`), line-height `1.4`, letter-spacing `-0.02em`
  * `.text-ui-heading`: `1.125rem`, medium (weight `500`), line-height `1.35`, letter-spacing `-0.025em`
  * `.text-ui-title`: `1.25rem`, semibold-light (weight `550`), line-height `1.3`, letter-spacing `-0.03em`
  * `.text-ui-label`: `1rem`, medium (weight `500`), line-height `1.35`, letter-spacing `-0.015em`
* All paddings, margins, button dimensions, and layout gaps are expressed in proportional `rem` units for harmonious visual rhythm.

---

## Iconography

* Exclusively import standard icons directly from **Lucide** (`lucide-react`).
* Standard Lucide icon pairings:
  * **Overview**: `LayoutGrid`
  * **Movement**: `ScanEye`
  * **Split**: `Columns2`
  * **Swipe**: `SlidersHorizontal`
  * **Onion**: `Layers`
  * **Mask**: `SquareDashed`
  * **Filter**: `ListFilter`
  * **Search & Navigation**: `Search`, `X`, `Check`, `ChevronLeft`, `ChevronRight`
* Maintain consistent icon sizing across components (`1rem` / `w-4 h-4` for button and inline icons, `1.25rem` / `w-5 h-5` for primary nav icons).

---

## Layout architecture

### 1. Unified top dashboard bar with 2 clean breadcrumbs
* Diffra features a single unified top header bar spanning the full screen width (`h-16 px-6`).
* Navigation flows cleanly via two sleek breadcrumb buttons without separators:
  `[ LayoutGrid Overview ]` and `[ Component / StoryName ]`.
* No branch comparison context or statistical noise in the top header bar.

### 2. DRY shared stage bar with repository branch/commit links
* The stage features a single shared context bar above all comparison modes displaying `Baseline {branch} ({commit})` vs `Candidate {branch} ({commit})` (linked directly to GitHub when repository metadata is available) and mode controls.

### 3. Streamlined sidebar with Popover API filter
* The search input is clean, flat white (`bg-white`) containing an embedded filter icon button.
* Filter status (`All`, `Changed`, `Added`, `Passed`) is selected via the native HTML Popover API (`popover="auto"`).
* Clear visual distinction between static section headlines (`text-ui-heading`) and interactive snapshot items (`group hover:bg-zinc-100`).
