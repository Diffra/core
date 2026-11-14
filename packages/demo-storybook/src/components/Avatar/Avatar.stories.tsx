import type { Meta, StoryObj } from '@storybook/react';
import { MISSING_PHOTO_PATH, placeholderPhoto } from '../../fixtures';
import { palette, radius } from '../../theme';
import { Avatar, AvatarGroup } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Identity/Avatar',
  component: Avatar,
  decorators: [
    (Story) => (
      <div
        style={{
          background: palette.surface,
          padding: '24px',
          borderRadius: radius.medium,
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    snapshot: {
      viewports: [{ name: 'desktop', width: 1280, height: 800 }],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Initials: Story = {
  args: { name: 'Maya Lindqvist', size: 56 },
};

export const WithPhoto: Story = {
  args: {
    name: 'Daniel Okafor',
    size: 56,
    src: placeholderPhoto('#238636', '#1f6feb'),
  },
};

/** Catches a broken image icon appearing instead of the initials fallback. */
export const PhotoFailedToLoad: Story = {
  args: { name: 'Priya Raman', size: 56, src: MISSING_PHOTO_PATH },
  parameters: { snapshot: { delay: 400 } },
};

/** Catches the presence dot drifting off the avatar edge or losing its ring. */
export const PresenceStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '20px' }}>
      <Avatar name="Maya Lindqvist" size={48} presence="online" />
      <Avatar name="Daniel Okafor" size={48} presence="away" />
      <Avatar name="Priya Raman" size={48} presence="offline" />
    </div>
  ),
};

export const TeamOverflow: Story = {
  render: () => (
    <AvatarGroup
      max={4}
      people={[
        { name: 'Maya Lindqvist' },
        { name: 'Daniel Okafor', src: placeholderPhoto('#238636', '#1f6feb') },
        { name: 'Priya Raman' },
        { name: 'Tomás Herrera' },
        { name: 'Aiko Tanaka' },
        { name: 'Lars Eriksen' },
        { name: 'Zainab Yusuf' },
      ]}
    />
  ),
};
