import type { Meta, StoryObj } from '@storybook/react';
import { CheckoutPage } from './CheckoutPage';

const meta: Meta<typeof CheckoutPage> = {
  title: 'Screens/Checkout',
  component: CheckoutPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof CheckoutPage>;

/** The last step before an order. If the pay button breaks, revenue stops. */
export const PaymentStep: Story = {};
