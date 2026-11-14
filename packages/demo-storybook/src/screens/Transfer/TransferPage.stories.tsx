import type { Meta, StoryObj } from '@storybook/react';
import { TransferPage } from './TransferPage';

const meta: Meta<typeof TransferPage> = {
  title: 'Screens/Bank transfer',
  component: TransferPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof TransferPage>;

/** Review before sending. A stuck loading overlay would lock customers out. */
export const ConfirmTransfer: Story = {};
