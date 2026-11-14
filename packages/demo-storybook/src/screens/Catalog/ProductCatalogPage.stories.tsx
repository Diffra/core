import type { Meta, StoryObj } from '@storybook/react';
import { ProductCatalogPage } from './ProductCatalogPage';

const meta: Meta<typeof ProductCatalogPage> = {
  title: 'Screens/Product catalog',
  component: ProductCatalogPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ProductCatalogPage>;

/** A browsing grid. Breaking the layout hides products and hurts sales. */
export const AutumnCollection: Story = {};
