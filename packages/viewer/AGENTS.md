# Viewer package guidelines for AI agents

This document records conventions, design rules, and operational learnings specific to `@diffra/viewer`.

---

## Design and typography rules

1. **Root and minimum font size**:
   - `html { font-size: 1rem; }`
   - Never use font sizes below `1rem` (no `text-xs`, `text-sm`, `text-[10px]`, `text-[11px]`).
   - Use designated `.text-ui-*` utility classes for typography hierarchy and balanced rhythm:
     - `.text-ui-base`: `1rem`, line-height 1.5, letter-spacing `-0.015em`, weight 400
     - `.text-ui-medium`: `1rem`, line-height 1.5, letter-spacing `-0.015em`, weight 450
     - `.text-ui-semibold`: `1rem`, line-height 1.4, letter-spacing `-0.02em`, weight 500
     - `.text-ui-heading`: `1.125rem`, line-height 1.35, letter-spacing `-0.025em`, weight 500
     - `.text-ui-title`: `1.25rem`, line-height 1.3, letter-spacing `-0.03em`, weight 550
     - `.text-ui-label`: `1rem`, line-height 1.35, letter-spacing `-0.015em`, weight 500
   - Always use `rem` units for paddings, margins, button dimensions, and font sizes. Never use `px` for typography.

2. **Headline and label typography**:
   - Never use uppercase on section headlines, category titles, or buttons.
   - Use natural case with larger typographic variants (`text-ui-heading`) for section headlines to clearly distinguish them from interactive items.

3. **Flat UI surfaces & zero drop-shadows**:
   - Never use `shadow-*`, `drop-shadow-*`, or `box-shadow` on core interface layout.
   - Minimize borders across the UI. Rely on flat, calm tonal surface shifts (`bg-zinc-50`, `bg-zinc-100`, `bg-zinc-200/50`, `bg-white`) rather than borders on every element.
   - Badges and buttons are flat and borderless.

4. **Sidebar Search & Popover Filtering**:
   - The search input is clean flat white (`bg-white`).
   - Filter selection uses the native HTML Popover API (`popover="auto"`).

5. **Layout & Header architecture**:
   - Navigation consists of exactly two breadcrumb buttons without separators (`[ LayoutGrid Overview ]` and `[ Component / StoryName ]`).
   - Do not render branch comparison context in the top header.
   - DRY shared stage header bar sits permanently above comparison views, linking branches and commits to GitHub when `repositoryUrl` is present.
   - Split view renders side-by-side canvas frames without redundant pane headers.

6. **Iconography**:
   - Always import icons directly from `lucide-react` (`LayoutGrid`, `ScanEye`, `Columns2`, `SlidersHorizontal`, `Layers`, `SquareDashed`, `ListFilter`, `Search`, `X`, `Check`, `ChevronLeft`, `ChevronRight`).
   - Do not create custom icon wrapper files (`Icons.tsx`).

7. **Inspection modes**:
   - 5 modes: `Movement` (`highlight`), `Split` (`split`), `Swipe` (`swipe`), `Onion` (`onion`), `Mask` (`mask`).
   - `Movement` (pixel shift detector in neon green with `ScanEye` icon) is the default comparison mode.
