import type { Meta, StoryObj } from '@storybook/react';
import { DashboardPage } from './DashboardPage';

const meta: Meta<typeof DashboardPage> = {
  title: 'Screens/Dashboard',
  component: DashboardPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof DashboardPage>;

/** The main workspace: sidebar, headline numbers and the revenue chart. */
export const Overview: Story = {};
