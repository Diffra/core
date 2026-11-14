import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'Feedback/Alert',
  component: Alert,
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const PaymentSucceeded: Story = {
  args: {
    tone: 'success',
    title: 'Payment received',
    children: 'Invoice INV-2041 was paid in full. A receipt is on its way.',
  },
};

export const TrialEnding: Story = {
  args: {
    tone: 'warning',
    title: 'Your trial ends in 3 days',
    children: 'Add a payment method to keep access to your projects.',
    actionLabel: 'Add payment method',
  },
};

export const DeploymentFailed: Story = {
  args: {
    tone: 'danger',
    title: 'Deployment failed',
    children: 'Build step "compile-assets" exited with code 1.',
    actionLabel: 'View build logs',
  },
};

/** Catches text that no longer wraps inside the alert, or an icon that shrinks. */
export const LongMessageWraps: Story = {
  args: {
    tone: 'info',
    title: 'Scheduled maintenance on Saturday, 22 November',
    children:
      'The EU region will be read-only between 01:00 and 03:30 UTC while we upgrade the primary database cluster. Background jobs queued during the window run once it finishes, so exports requested late on Friday may arrive a few hours later than usual.',
    actionLabel: 'Read the maintenance notes',
  },
};
