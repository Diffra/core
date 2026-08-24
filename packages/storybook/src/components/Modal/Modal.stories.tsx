import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    snapshot: {
      delay: 150,
      pauseAnimationAtEnd: true,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const ConfirmationDialog: Story = {
  args: {
    isOpen: true,
    title: 'Confirm Project Deletion',
    children:
      'Are you sure you want to delete this repository? This action cannot be undone.',
  },
};
