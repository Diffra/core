# Storybook snapshot parameters

This document provides the complete schema reference for `parameters.snapshot` in Storybook Component Story Format (CSF).

---

## Schema reference

```typescript
export interface TargetParameters {
  /** Skip taking visual snapshots for this story or component */
  disable?: boolean;
  disableSnapshot?: boolean;

  /** Perceptual color threshold from 0.0 (strict) to 1.0 (permissive), default 0.063 */
  diffThreshold?: number;
  threshold?: number;

  /** Milliseconds to wait after render before taking screenshot */
  delay?: number;

  /** Pause CSS animations and transitions at their final frame (default true) */
  pauseAnimationAtEnd?: boolean;

  /** Playwright animations handling: 'disabled' (default) stops CSS animations, 'allow' keeps them running */
  animations?: 'disabled' | 'allow';

  /** Multi-mode configurations (e.g. viewports, themes) */
  modes?: Record<string, SnapshotModeConfig>;

  /** Specific viewport widths or objects to capture */
  viewports?: ViewportInput[];

  /** Optional CSS selector to isolate for screenshot */
  selector?: string;

  /** CSS selectors to mask before taking screenshot */
  mask?: string[];

  /** Take full scrollable page screenshot */
  fullPage?: boolean;

  /** Optional clipping region */
  clip?: { x: number; y: number; width: number; height: number };

  /** Transparent background option */
  omitBackground?: boolean;

  /** Passthrough raw Playwright screenshot options */
  screenshotOptions?: PageScreenshotOptions;
}
```

---

## Supported parameters detail

### `delay`
* **Type**: `number`
* **Default**: `0`
* **Usage**: Extends the wait time (in milliseconds) before capturing a screenshot. Useful for data loading states, async font loading, or entrance transitions.

### `diffThreshold`
* **Type**: `number`
* **Default**: `0.063`
* **Usage**: Controls the perceptual sensitivity of the pixel comparison engine. A lower value (e.g. `0.02`) is stricter; a higher value (e.g. `0.10`) is more permissive.

### `pauseAnimationAtEnd`
* **Type**: `boolean`
* **Default**: `true`
* **Usage**: Injects a CSS stylesheet that pauses CSS animations and transitions at their final state and hides blinking input carets.

### `modes`
* **Type**: `Record<string, { viewport?: number | { width: number; height?: number }; theme?: string }>`
* **Usage**: Generates a matrix of snapshots for different viewports or theme states from a single story.

### `disableSnapshot`
* **Type**: `boolean`
* **Default**: `false`
* **Usage**: Completely excludes the story from visual regression testing.
