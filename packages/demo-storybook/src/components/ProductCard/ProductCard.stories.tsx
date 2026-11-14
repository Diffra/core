import type { Meta, StoryObj } from '@storybook/react';
import { MISSING_PHOTO_PATH, placeholderPhoto } from '../../fixtures';
import { ProductCard } from './ProductCard';

const meta: Meta<typeof ProductCard> = {
  title: 'Commerce/ProductCard',
  component: ProductCard,
  args: {
    name: 'Trail Runner 2 Waterproof Shoe',
    price: 129,
    rating: 4,
    reviewCount: 218,
    imageSrc: placeholderPhoto('#1f6feb', '#8957e5'),
  },
  parameters: {
    snapshot: {
      viewports: [{ name: 'desktop', width: 1280, height: 800 }],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProductCard>;

export const InStock: Story = {};

export const OnSale: Story = {
  args: { salePrice: 89, imageSrc: placeholderPhoto('#bf3989', '#f85149') },
};

export const SoldOut: Story = {
  args: { soldOut: true, imageSrc: placeholderPhoto('#238636', '#1f6feb') },
};

/** Catches the broken image icon or a collapsed card replacing the fallback. */
export const PhotoFailedToLoad: Story = {
  args: { imageSrc: MISSING_PHOTO_PATH },
  parameters: { snapshot: { delay: 400 } },
};

/** Catches title wrapping that changes the card height in a product grid. */
export const LongProductName: Story = {
  args: {
    name: 'Ultralight Four-Season Expedition Down Parka with Removable Faux-Fur Hood, Women’s Tall',
    price: 499,
    rating: 5,
    reviewCount: 12,
    imageSrc: placeholderPhoto('#d29922', '#da3633'),
  },
};

export const NoReviewsYet: Story = {
  args: { rating: undefined, reviewCount: undefined },
};
