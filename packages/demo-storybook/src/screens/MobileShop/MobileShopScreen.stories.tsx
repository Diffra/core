import type { Meta, StoryObj } from '@storybook/react';
import { MobileShopScreen } from './MobileShopScreen';

const meta: Meta<typeof MobileShopScreen> = {
  title: 'Screens/Mobile shop',
  component: MobileShopScreen,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof MobileShopScreen>;

/** A phone-sized app screen. Long product names must wrap, not push buttons off. */
export const BlackFriday: Story = {};
