# Storybook integration guide

Diffra reads snapshot configuration directly from Storybook Component Story Format (CSF) files using `parameters.snapshot`.

---

## Standard parameters reference

All snapshot parameters are defined under `parameters.snapshot`:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `delay` | `number` | `0` | Milliseconds to wait before taking a screenshot after the story renders. Useful for data loading and entrance transitions. |
| `diffThreshold` | `number` | `0.063` | Perceptual sensitivity threshold (from `0.0` strict to `1.0` permissive). |
| `pauseAnimationAtEnd` | `boolean` | `true` | When `true`, CSS animations are paused at their final frame before capturing. |
| `modes` | `Record<string, ModeConfig>` | `undefined` | Defines multi-mode configurations (such as viewports or themes) to test against. |
| `viewports` | `(number \| Viewport)[]` | `undefined` | Specific viewport widths to capture for this story. |
| `disableSnapshot` | `boolean` | `false` | Completely skips taking visual snapshots for this story. |

---

## Component-level configuration

Set global defaults across all stories in a component file:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    snapshot: {
      diffThreshold: 0.05,        // Strict 5% sensitivity threshold
      pauseAnimationAtEnd: true,  // Pause animations at final frame
    },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { label: 'Get Started Now' },
};
```

---

## Story-level configuration

### 1. Settle delays
For components with asynchronous content or entrance transitions:

```typescript
export const AsyncContent: Story = {
  parameters: {
    snapshot: {
      delay: 300, // Wait 300ms for content to stabilize
    },
  },
};
```

### 2. Multi-mode testing (modes)
Define responsive viewport matrices using `modes`:

```typescript
export const ResponsiveNavigation: Story = {
  parameters: {
    snapshot: {
      modes: {
        mobile: { viewport: { width: 375, height: 667 } },
        tablet: { viewport: { width: 768, height: 1024 } },
        desktop: { viewport: { width: 1280, height: 800 } },
      },
    },
  },
};
```

### 3. Component interactions via the Storybook play function
To capture hover, focus, click, or form input states, use Storybook's standard `play` function with `@storybook/test`:

```typescript
import { userEvent, within } from '@storybook/test';

export const HoverState: Story = {
  args: { label: 'Hover Me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.hover(button);
  },
};

export const OpenDropdown: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /options/i });
    await userEvent.click(trigger);
  },
};
```

### 4. Disabling snapshots for dynamic stories
Exclude stories with dynamic timestamps, randomized data, or continuous tickers:

```typescript
export const LiveClock: Story = {
  parameters: {
    snapshot: {
      disableSnapshot: true,
    },
  },
};
```
