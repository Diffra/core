import type { Meta, StoryObj } from '@storybook/react';
import { AnalyticsPage } from './AnalyticsPage';

const meta: Meta<typeof AnalyticsPage> = {
  title: 'Screens/Analytics',
  component: AnalyticsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof AnalyticsPage>;

/** A report page. When data handling breaks, users see an error screen instead. */
export const RevenueReport: Story = {};
