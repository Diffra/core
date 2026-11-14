# Viewer package guidelines for AI agents

This document records conventions, design rules, and operational learnings specific to `@diffra/viewer`.

---

## What the interface is for

The viewer answers one question for a reviewer who arrives from a pull request: are these visual changes intended? Everything is arranged around four steps.

1. **Triage**: see what needs a decision, most urgent first.
2. **Inspect**: see exactly what changed in one snapshot.
3. **Share**: link to a precise snapshot and view.
4. **Move on**: step to the next snapshot without leaving the keyboard.

Approval happens outside the viewer, in CI (merge to accept, or `diffra approve`). The viewer is read-only and static: it needs no server and works when opened from disk.

---

## Structure

* `src/lib`: pure logic with no React or DOM. Routes, the review list and its filters, status words, links, and index stepping live here and are covered by unit tests. Put new decisions here first.
* `src/context/ViewerContext.tsx`: state. The URL hash is the single source of truth for the selected snapshot and mode (`#/story/<id>/<mode>`).
* `src/components/home`: the triage page (headline, filters, search, grouped `SnapshotCard`s).
* `src/components/detail`: one snapshot. `TopBar`, `SnapshotSwitcher` (the title and quick switcher), `Docks` (floating controls), and `SnapshotView` (which picks what to draw, including empty cases).
* `src/components/stage`: the shared `Viewport` and the four comparison views.
* `src/components/ui`: small primitives (`Segmented`, `IconButton`, `SearchField`, `StatusLabel`, `Kbd`, `Message`, `Logo`, `RunContext`).

---

## Interface rules

1. **Two screens, no chrome**: Home for triage, Detail for inspection. Do not add a sidebar, a header bar, or a toolbar strip. Controls that belong to the image float over it.
2. **Triage is visual**: Home shows a thumbnail of the real interface for every snapshot, and hovering reveals the changes. Unchanged snapshots are hidden behind the `Unchanged` filter. Order is failed, changed, removed, new.
3. **Every state explains itself**: failed shows the reason, new says there is no baseline, removed says there is no candidate, unchanged says nothing changed. Use `Message` for empty states.
4. **One viewport**: every comparison draws on `Viewport`, which owns the checkerboard, scrolling, centering, and the shared zoom (`fit`, `100%`, `200%`, `400%`). Never create a second scroll surface for a mode.
5. **Modes**: `diff` (default), `split`, `slide`, `fade`. Blink belongs to `fade`. Do not reintroduce a mode that shows the same information as another.
6. **Labels in the canvas**: Baseline and Candidate are always labeled inside the canvas with `CanvasLabel`.
7. **One selection style**: the chosen filter, mode, zoom, and the current item in the switcher are all an ink pill. Do not invent another.
8. **Links are optional**: branch and commit links render only when the report names a repository. Never fall back to a default repository.
9. **Keyboard first**: every action has a key, and `lib/shortcuts.ts` documents them. Keep `useKeyboardShortcuts` and `SHORTCUT_GROUPS` in step. `/` focuses the search on Home and opens the switcher in Detail.

---

## Design and typography rules

1. **Root and minimum font size**:
   * `html { font-size: 1rem; }`
   * Never use font sizes below `1rem` (no `text-xs`, `text-sm`, `text-[10px]`).
   * Use the `.text-ui-*` classes for hierarchy: `base` (400), `medium` (450), `semibold` (500), `heading` (`1.125rem`, 500), `title` (`1.25rem`, 500), `label` (500), `display` (`2rem`, 300), `hero` (`3.5rem`, 300).
   * Hierarchy comes from weight, color, and one large light display size (`.text-ui-display`). Use `ink` for primary text, `ink-2` for secondary, and `ink-3` for tertiary. Never use a lighter color for text.
   * Always use `rem` units for paddings, margins, and font sizes.
   * Base element styles live in `@layer base` and `.text-ui-*` in `@layer components`, so Tailwind utilities such as `font-medium` can override them.

2. **Surfaces and color**:
   * Tokens are defined in `tokens/theme.css`: `paper`, `wash`, `hairline`, `ink`, `ink-2`, `ink-3`, `accent`, and the status colors. Use these token utilities (`text-ink`, `bg-wash`) and never raw palette classes such as `zinc-*`.
   * The page is `paper`. There is no grey frame and no card around the chrome. `wash` is for pill backgrounds and message panels, and the checkerboard canvas is the only large tinted surface.
   * `accent` is a signal, not decoration. Use it only for focus rings, the diff highlight, the slide divider and handle, and link hover.
   * Never use `shadow-*`, `drop-shadow-*`, or `box-shadow`. Use a 1px translucent `outline` where an edge is needed (`.image-edge`, `.canvas-backdrop`).
   * Controls are flat, borderless, and pill-shaped. Standard control height is `2.5rem`. The selected control is an ink pill.

3. **Spacing**: be generous. Pages are padded `2.5rem` at the sides, sections are separated by `2.5rem` to `4rem`, and rows and controls are `2.5rem` tall. The home content is centered in a `max-w-7xl` column.

4. **Icons**:
   * Import directly from `lucide-react`. Do not create icon wrapper files.
   * Size with `ICON_CLASS` and stroke with `ICON_STROKE` from `tokens/icon.ts`.

5. **Noise**: never render diff percentages, pixel dimensions, or pixel counts. Counts of snapshots in plain sentences (for example "2 changed, 1 new") are fine.

6. **Uppercase** is never used.

---

## Operational learnings

* The viewer ships as a custom element with Shadow DOM. Do not look elements up with `document.getElementById`. Use refs, or `useId` for popover targets.
* `getContext('2d').getImageData` throws on `file://` pages. `DiffHighlightView` falls back to the engine's diff image, and the review bundle must keep working from disk.
* CSS `zoom` is used for scaling so the layout size follows the scale and scroll areas stay correct. `--inv` is the inverse scale, for details that must keep a constant on-screen size.
* Screenshots in the browser pane can lag one action behind. Wait before concluding a click did nothing.
