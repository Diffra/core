import type { Meta, StoryObj } from '@storybook/react';
import { placeholderPhoto } from '../../fixtures';
import { ProfileCard } from './ProfileCard';

const meta: Meta<typeof ProfileCard> = {
  title: 'Identity/ProfileCard',
  component: ProfileCard,
  args: {
    name: 'Maya Lindqvist',
    role: 'Staff Engineer',
    location: 'Stockholm',
    presence: 'online',
    stats: [
      { label: 'Projects', value: '24' },
      { label: 'Reviews', value: '312' },
      { label: 'Streak', value: '18d' },
    ],
  },
  parameters: {
    snapshot: {
      viewports: [{ name: 'desktop', width: 1280, height: 800 }],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProfileCard>;

export const Loaded: Story = {
  args: { photoSrc: placeholderPhoto('#238636', '#1f6feb') },
};

/** Skeleton placeholders must match the loaded layout so nothing jumps. */
export const Loading: Story = {
  args: { loading: true },
};

/** Catches long names pushing the stats row or overflowing the card. */
export const LongNameAndRole: Story = {
  args: {
    name: 'Alexandria Montgomery-Featherstonehaugh',
    role: 'Principal Site Reliability and Platform Engineering Lead',
    location: 'Christchurch',
    presence: 'away',
  },
};
