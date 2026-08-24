import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const LiveIndicator: Story = {
  args: {
    text: 'Active System',
    color: 'green',
  },
};

export const DisabledSnapshotStory: Story = {
  args: {
    text: 'Skipped Animation',
  },
  parameters: {
    snapshot: {
      disableSnapshot: true,
    },
  },
};

export const SkippedStoryVisual: Story = {
  args: {
    text: 'Dynamic Timestamp',
  },
  parameters: {
    snapshot: {
      disable: true,
    },
  },
};
