import type { Meta, StoryObj } from '@storybook/react';
import { CheckoutSummary } from './CheckoutSummary';

const meta: Meta<typeof CheckoutSummary> = {
  title: 'Commerce/CheckoutSummary',
  component: CheckoutSummary,
  args: {
    lines: [
      { name: 'Trail Runner 2 Waterproof Shoe', quantity: 1, unitCents: 12900 },
      { name: 'Merino Hiking Socks, 3 pack', quantity: 2, unitCents: 2400 },
    ],
    shippingCents: 0,
    taxCents: 1670,
  },
};

export default meta;
type Story = StoryObj<typeof CheckoutSummary>;

export const Default: Story = {};

export const PromoCodeApplied: Story = {
  args: { promo: { code: 'AUTUMN15', discountCents: 2655 } },
};

export const PaidShipping: Story = {
  args: { shippingCents: 1295 },
};

/** Catches long product names squeezing the price column or wrapping prices. */
export const LongProductNames: Story = {
  args: {
    lines: [
      {
        name: 'Ultralight Four-Season Expedition Down Parka with Removable Faux-Fur Hood, Women’s Tall',
        quantity: 1,
        unitCents: 49900,
      },
      {
        name: 'Insulated Stainless Steel Wide-Mouth Trail Bottle, 1.2 L, Glacier Blue',
        quantity: 3,
        unitCents: 3450,
      },
    ],
    taxCents: 9120,
  },
};

/** German strings run roughly a third longer, so the pay button must hold. */
export const GermanLocale: Story = {
  args: { locale: 'de-DE', promo: { code: 'HERBST15', discountCents: 2655 } },
};

/** Catches layout that is not mirrored, and numerals that lose their shaping. */
export const ArabicRightToLeft: Story = {
  args: { locale: 'ar-AE', promo: { code: 'AUTUMN15', discountCents: 2655 } },
};
