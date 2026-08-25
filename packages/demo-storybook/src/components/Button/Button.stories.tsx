import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    snapshot: {
      diffThreshold: 0.063,
      pauseAnimationAtEnd: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    label: 'Primary Action Button',
    variant: 'primary',
    size: 'large',
  },
};

export const Secondary: Story = {
  args: {
    label: 'Secondary Action',
    variant: 'secondary',
    size: 'medium',
  },
};

export const DangerHoverState: Story = {
  args: {
    label: 'Delete Resource',
    variant: 'danger',
    size: 'medium',
  },
  parameters: {
    snapshot: {
      delay: 100,
    },
  },
};

export const ResponsiveMatrix: Story = {
  args: {
    label: 'Responsive Button',
    variant: 'primary',
  },
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
