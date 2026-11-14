import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within } from 'storybook/test';
import { DropdownMenu } from './DropdownMenu';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Overlays/DropdownMenu',
  component: DropdownMenu,
  args: {
    triggerLabel: 'Project actions',
    items: [
      { id: 'rename', label: 'Rename', shortcut: 'F2' },
      { id: 'duplicate', label: 'Duplicate', shortcut: '⌘D' },
      { id: 'share', label: 'Share…' },
      {
        id: 'archive',
        label: 'Archive',
        disabled: true,
        separatorBefore: true,
      },
      {
        id: 'delete',
        label: 'Delete project',
        destructive: true,
        shortcut: '⌫',
      },
    ],
  },
  parameters: {
    snapshot: {
      delay: 300,
      viewports: [{ name: 'desktop', width: 1280, height: 800 }],
    },
  },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Closed: Story = {};

/** Catches a menu clipped by its container, or one that stacks under siblings. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Project actions' }),
    );
  },
};

/** Catches a lost keyboard focus highlight when moving through the menu. */
export const KeyboardFocusOnThirdItem: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Project actions' }),
    );
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
  },
};

/** The destructive item keeps its red colour on keyboard focus. */
export const KeyboardFocusOnDestructiveItem: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Project actions' }),
    );
    await userEvent.keyboard('{ArrowUp}');
  },
};
