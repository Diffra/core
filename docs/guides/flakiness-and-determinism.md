# Flakiness and determinism

Visual regression testing requires 100% deterministic screenshots. Subtle timing issues, unfrozen CSS animations, unrendered web fonts, and subpixel anti-aliasing variations can cause false-positive visual differences.

Diffra implements automated stabilization techniques out-of-the-box and provides fine-grained controls for complex UIs.

---

## 1. Automatic CSS animation and transition freezing

Diffra automatically injects deterministic styles into every Playwright worker page before capture:

* Pauses all CSS animations (`animation-play-state: paused !important`).
* Sets animation and transition durations to `0.0001s !important`.
* Hides blinking text input carets (`caret-color: transparent !important`).

### Custom animation control
If you have a component that specifically requires live animations during capture, enable them in your configuration or story parameters:

```typescript
// diffra.config.ts
export default defineConfig({
  pauseAnimationAtEnd: true, // Default: freezes animations at final frame
});
```

Or per-story:

```typescript
export const LivePulseIndicator: Story = {
  parameters: {
    snapshot: {
      animations: 'allow', // Do not freeze animations
    },
  },
};
```

---

## 2. Web font stabilization

If custom web fonts (e.g. Google Fonts or Typekit) load asynchronously after the initial HTML render, components may initially render with fallback system fonts.

### Recommended fix: Settle delay
Add a `delay` parameter to allow `@font-face` definitions and icon font files to finish downloading and rendering:

```typescript
export default defineConfig({
  delay: 150, // Global wait time in ms before taking screenshots
});
```

---

## 3. Dynamic content masking

Timestamps, random user IDs, live clocks, and dynamic avatars should be masked using `mask`:

```typescript
// In Storybook CSF
export const ActivityFeed: Story = {
  parameters: {
    snapshot: {
      mask: ['.relative-time', '.random-id-badge'],
    },
  },
};

// In URL Driver config
{
  url: '/dashboard',
  mask: ['#live-ticker', '.timestamp'],
}
```

Diffra overlays a solid pink placeholder box over each masked element during capture, guaranteeing that changing text content within the masked area does not trigger visual diffs.

---

## 4. Cross-OS subpixel antialiasing differences

Font rendering engines differ across operating systems (macOS CoreText vs Linux FreeType vs Windows DirectWrite). Running Diffra locally on macOS and then comparing against a Linux CI runner can reveal subpixel font antialiasing discrepancies.

### Solutions:
1. **Containerized test execution**: Run local tests inside the same Docker container used in CI (e.g. `mcr.microsoft.com/playwright:v1.50.0-noble`).
2. **Tune perceptual diff threshold**: Adjust `diffThreshold` (default `0.063`) to `0.08` or `0.10` to accommodate minor subpixel font rendering differences while still catching real layout shifts:

```typescript
export default defineConfig({
  diffThreshold: 0.08,
});
```

3. **Install identical fonts in CI**: In Linux CI environments, install common web fonts (e.g. `fonts-inter`, `fonts-liberation`, or Microsoft Core Fonts) to prevent system fallback discrepancies.
