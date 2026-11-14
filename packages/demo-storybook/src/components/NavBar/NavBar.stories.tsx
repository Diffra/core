import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import { NavBar } from './NavBar';

const PRIMARY_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects' },
  { id: 'billing', label: 'Billing' },
  { id: 'team', label: 'Team' },
];

const MOBILE_VIEWPORT = { name: 'mobile', width: 375, height: 667 };

const meta: Meta<typeof NavBar> = {
  title: 'Navigation/NavBar',
  component: NavBar,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    brand: 'Northwind',
    items: PRIMARY_ITEMS,
    activeId: 'projects',
  },
};

export default meta;
type Story = StoryObj<typeof NavBar>;

/** Captured at mobile and desktop widths, so a broken breakpoint shows up. */
export const SignedIn: Story = {
  args: { userName: 'Maya Lindqvist', notificationCount: 3 },
};

export const SignedOut: Story = {};

/** Catches the badge overflowing or clipping once the count passes two digits. */
export const ManyNotifications: Story = {
  args: { userName: 'Maya Lindqvist', notificationCount: 128 },
};

export const MobileMenuOpen: Story = {
  args: { userName: 'Maya Lindqvist', notificationCount: 3 },
  parameters: {
    snapshot: { viewports: [MOBILE_VIEWPORT], delay: 300 },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Open menu' }),
    );
  },
};
