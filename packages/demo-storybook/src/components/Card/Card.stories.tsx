import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Standard: Story = {
  args: {
    title: 'Standard Analytics Card',
    description:
      'Displays core KPI and performance metrics for the selected billing period.',
  },
};

export const Featured: Story = {
  args: {
    title: 'Featured Enterprise Plan',
    description:
      'Includes 24/7 dedicated support and custom model deployment workflows.',
    tag: 'Enterprise',
  },
  parameters: {
    snapshot: {
      diffThreshold: 0.02,
      viewports: [
        { name: 'tablet', width: 768, height: 900 },
        { name: 'desktop', width: 1280, height: 900 },
      ],
    },
  },
};
