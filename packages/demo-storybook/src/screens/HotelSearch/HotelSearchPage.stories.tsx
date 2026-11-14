import type { Meta, StoryObj } from '@storybook/react';
import { HotelSearchPage } from './HotelSearchPage';

const meta: Meta<typeof HotelSearchPage> = {
  title: 'Screens/Hotel search',
  component: HotelSearchPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof HotelSearchPage>;

/** The date picker open over the page. A clipped picker blocks every booking. */
export const DatePicker: Story = {};
