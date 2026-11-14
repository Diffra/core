import type { Meta, StoryObj } from '@storybook/react';
import { PricingPage } from './PricingPage';

const meta: Meta<typeof PricingPage> = {
  title: 'Screens/Pricing',
  component: PricingPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PricingPage>;

/** Yearly plans. Wrong or missing prices here cost trust and conversions. */
export const Plans: Story = {};
