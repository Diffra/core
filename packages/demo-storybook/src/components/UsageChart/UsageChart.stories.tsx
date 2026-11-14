import type { Meta, StoryObj } from '@storybook/react';
import { UsageChart } from './UsageChart';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const series = (values: number[]) =>
  WEEKDAYS.map((label, index) => ({ label, value: values[index] ?? 0 }));

const meta: Meta<typeof UsageChart> = {
  title: 'Data/UsageChart',
  component: UsageChart,
  args: { title: 'API requests this week' },
  parameters: {
    snapshot: {
      viewports: [
        { name: 'tablet', width: 768, height: 900 },
        { name: 'desktop', width: 1280, height: 800 },
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof UsageChart>;

export const WeeklyRequests: Story = {
  args: { data: series([12400, 18900, 21300, 19800, 24600, 6200, 4100]) },
};

/** Catches axis scaling that flattens the other bars once one value spikes. */
export const SingleOutlierDay: Story = {
  args: { data: series([1200, 1400, 1100, 98000, 1300, 900, 1000]) },
};

/** Catches the axis jumping to a different step when values are tiny. */
export const SmallCounts: Story = {
  args: { data: series([2, 0, 5, 3, 7, 1, 4]) },
};

export const NoActivity: Story = {
  args: { data: series([0, 0, 0, 0, 0, 0, 0]) },
};
