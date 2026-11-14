import type { Meta, StoryObj } from '@storybook/react';
import { TeamInvitePage } from './TeamInvitePage';

const meta: Meta<typeof TeamInvitePage> = {
  title: 'Screens/Team invite',
  component: TeamInvitePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof TeamInvitePage>;

/** A modal over the app. It must dim the page and sit centred above it. */
export const InviteModal: Story = {};
