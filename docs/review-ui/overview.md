# Review interface overview

The `@diffra/viewer` package provides a standalone Scandinavian minimalist review user interface embedded in generated HTML reports and served by `diffra serve`.

---

## Scandinavian design principles

Diffra's review interface is built around functional clarity, calm surface shifts, and minimal cognitive noise:

* **Flat tonal surfaces**: Zero elevation drop-shadows (`box-shadow: none`). Spatial depth is established through tonal background layers (`bg-zinc-50` backdrop, `bg-white` canvas and search inputs, `bg-zinc-100` containers).
* **Typography**: Exclusively uses Inter with a strict `1rem` document base size. Monospace fonts and sub-1rem font sizes (`text-xs`, `text-sm`) are forbidden. Section titles and buttons use natural case rather than all-caps.
* **Elimination of cognitive clutter**: No diff percentages (`0.5%`), pixel counts (`50 px diff`), or numerical tally chips on tabs and headers. Reviewers focus purely on visual changes.
* **Flat status badges**: Borderless rounded badges with calm tonal contrast:
  * **Changed**: `bg-amber-100/90 text-amber-900`
  * **Added**: `bg-emerald-100/90 text-emerald-900`
  * **Removed**: `bg-rose-100/90 text-rose-900`
  * **Passed / Unchanged**: `bg-zinc-200/60 text-zinc-700`

---

## Layout hierarchy

```
+-----------------------------------------------------------------------------------+
|  Diffra Brand   |  [ LayoutGrid Overview ]   [ Component / StoryName ]            |  (Top Header)
+-----------------+-----------------------------------------------------------------+
|  Search Input   |  Baseline: main (a1b2c3d) vs Candidate: feat (e4f5g6h)   [Modes]|  (Stage Context)
|  [Filter Popover|-----------------------------------------------------------------|
|                 |                                                                 |
|  Components:    |                                                                 |
|  - Button       |                       Visual Stage Canvas                       |
|    - Primary    |                    (Synchronized Pan & Zoom)                    |
|    - Secondary  |                                                                 |
|  - Card         |                                                                 |
|                 |                                                                 |
+-----------------+-----------------------------------------------------------------+
```

### 1. Unified top header
Spans the full screen width with exactly two clean breadcrumb buttons: `[ LayoutGrid Overview ]` and `[ Component / StoryName ]`.

### 2. DRY shared stage bar
Sits directly above the visual comparison canvas, displaying baseline commit, candidate branch/commit, and mode selectors.

### 3. Sidebar with Popover API filter
Search input with an embedded filter icon utilizing the native HTML Popover API (`popover="auto"`) for filtering by status (`All`, `Changed`, `Added`, `Passed`).
