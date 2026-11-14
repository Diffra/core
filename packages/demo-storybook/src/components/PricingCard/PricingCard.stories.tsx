import type { Meta, StoryObj } from '@storybook/react';
import { PricingCard, type PricingCardProps } from './PricingCard';

const starter: PricingCardProps = {
  name: 'Starter',
  price: 9,
  description: 'For individuals and small side projects.',
  features: ['3 projects', '5 GB storage', 'Community support'],
  ctaLabel: 'Start free trial',
};

const team: PricingCardProps = {
  name: 'Team',
  price: 24,
  description: 'For growing teams that ship every week.',
  features: [
    'Unlimited projects',
    '100 GB storage',
    'Role-based access control',
    'Priority email support',
    'Audit log, 90 day retention',
  ],
  ctaLabel: 'Choose Team',
  ribbon: 'Most popular',
  highlighted: true,
};

const enterprise: PricingCardProps = {
  name: 'Enterprise Unlimited Plus',
  price: 79,
  description:
    'For organisations with security reviews, procurement and compliance requirements.',
  features: [
    'Everything in Team',
    'Single sign-on with SAML and SCIM provisioning',
    'Dedicated success manager and 99.99% uptime SLA',
    'Custom data residency',
  ],
  ctaLabel: 'Talk to sales',
};

const meta: Meta<typeof PricingCard> = {
  title: 'Commerce/PricingCard',
  component: PricingCard,
};

export default meta;
type Story = StoryObj<typeof PricingCard>;

export const Starter: Story = { args: starter };

export const MostPopular: Story = { args: team };

/** Catches a long plan name or wrapped features pushing the layout around. */
export const EnterpriseLongName: Story = { args: enterprise };

export const AnnualDiscount: Story = {
  args: {
    ...team,
    price: 19,
    originalPrice: 24,
    ribbon: 'Save 20% billed yearly',
  },
};

/**
 * Cards with different feature counts must keep their call to action aligned
 * on one baseline, and wrap onto separate rows on narrow screens.
 */
export const PlanComparison: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: '16px 0',
      }}
    >
      <PricingCard {...starter} />
      <PricingCard {...team} />
      <PricingCard {...enterprise} />
    </div>
  ),
  parameters: {
    layout: 'padded',
    snapshot: {
      viewports: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'desktop', width: 1280, height: 800 },
      ],
    },
  },
};
