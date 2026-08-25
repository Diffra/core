# Testing Storybook components

Diffra integrates natively with Storybook 7, 8, and 9 using Component Story Format (CSF 3). It extracts snapshot configurations directly from Storybook's canonical Story Index (`index.json` / `stories.json`), eliminating the overhead of loading heavyweight component runtime dependencies during discovery.

---

## Standard parameters namespace

All visual regression configuration in Storybook is defined under the standard namespace **`parameters.snapshot`**.

### Snapshot parameters reference

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `delay` | `number` | `0` | Settle wait time (ms) after component render before taking screenshot. |
| `diffThreshold` | `number` | `0.063` | Perceptual sensitivity threshold (`0.0` strict to `1.0` permissive). |
| `pauseAnimationAtEnd` | `boolean` | `true` | Pauses CSS animations and transitions at their final frame. |
| `modes` | `Record<string, SnapshotModeConfig>` | `undefined` | Record of multi-mode configurations (e.g. viewports or themes). |
| `viewports` | `(number \| Viewport)[]` | `undefined` | Specific viewport dimensions to capture for this story. |
| `disableSnapshot` | `boolean` | `false` | Completely skips taking visual snapshots for this story. |
| `selector` | `string` | `undefined` | CSS selector to isolate for snapshot capture. |
| `mask` | `string[]` | `undefined` | CSS selectors of elements to mask before taking screenshot. |

---

## Component-level configuration

Define default snapshot parameters across all stories in a component file by setting `parameters.snapshot` in the default export:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    snapshot: {
      diffThreshold: 0.05,       // Strict 5% threshold for all stories in this file
      pauseAnimationAtEnd: true, // Freeze entrance transitions
      viewports: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'desktop', width: 1280, height: 800 },
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: { title: 'Project Overview', count: 42 },
};
```

---

## Story-level configuration

Individual stories can override component-level defaults or specify unique requirements:

### 1. Settle delays for asynchronous data
For components with async rendering, network data fetching, or entrance transitions:

```typescript
export const AsyncDataGrid: Story = {
  parameters: {
    snapshot: {
      delay: 350, // Wait 350ms for data and icons to stabilize
    },
  },
};
```

### 2. Multi-mode testing (modes)
Define responsive viewport matrices or color scheme modes using `modes`:

```typescript
export const ResponsiveNavigation: Story = {
  parameters: {
    snapshot: {
      modes: {
        mobile: { viewport: { width: 375, height: 667 } },
        tablet: { viewport: { width: 768, height: 1024 } },
        desktop: { viewport: { width: 1280, height: 800 } },
        ultrawide: { viewport: { width: 1920, height: 1080 } },
      },
    },
  },
};
```

### 3. Component interactions via the Storybook play function
To test hover, focus, click, open dropdowns, or filled forms, use Storybook's standard `play` function with `@storybook/test` (Testing Library and user-event). Diffra executes the `play` function before capturing the screenshot:

```typescript
import { userEvent, within } from '@storybook/test';

export const HoverState: Story = {
  args: { label: 'Interactive Button' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await userEvent.hover(button);
  },
};

export const OpenMenuDropdown: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /actions/i });
    await userEvent.click(trigger);
  },
};

export const FormValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);
  },
};
```

### 4. Element masking
Mask dynamic elements like current time, random numbers, or fluctuating IDs:

```typescript
export const LiveActivityFeed: Story = {
  parameters: {
    snapshot: {
      mask: ['.timestamp', '.relative-time-badge'],
    },
  },
};
```

### 5. Disabling snapshots for dynamic stories
Exclude continuous animations, live tickers, or third-party iframe stories:

```typescript
export const ContinuousStockTicker: Story = {
  parameters: {
    snapshot: {
      disableSnapshot: true,
    },
  },
};
```

---

## Storybook version pinning in monorepos

When integrating Storybook in a pnpm or Yarn monorepo, ensure all Storybook packages share the exact same major and minor version to prevent Vite export mismatch errors:

```json
{
  "devDependencies": {
    "storybook": "8.6.4",
    "@storybook/react": "8.6.4",
    "@storybook/react-vite": "8.6.4",
    "@storybook/addon-essentials": "8.6.4",
    "@storybook/test": "8.6.4"
  }
}
```
