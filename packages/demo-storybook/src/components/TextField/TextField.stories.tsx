import type { Meta, StoryObj } from '@storybook/react';
import { userEvent } from 'storybook/test';
import { TextField } from './TextField';

const meta: Meta<typeof TextField> = {
  title: 'Forms/TextField',
  component: TextField,
  parameters: {
    snapshot: {
      viewports: [{ name: 'desktop', width: 1280, height: 800 }],
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextField>;

export const Empty: Story = {
  args: {
    label: 'Work email',
    placeholder: 'you@company.com',
    type: 'email',
  },
};

export const Filled: Story = {
  args: {
    label: 'Work email',
    value: 'maya.lindqvist@northwind.io',
    type: 'email',
    helperText: 'We will send the invoice receipts to this address.',
  },
};

/** Catches a lost or restyled keyboard focus ring. */
export const Focused: Story = {
  args: {
    label: 'Work email',
    placeholder: 'you@company.com',
    type: 'email',
  },
  parameters: { snapshot: { delay: 300 } },
  play: async () => {
    await userEvent.tab();
  },
};

export const InvalidEmail: Story = {
  args: {
    label: 'Work email',
    value: 'maya.lindqvist@northwind',
    type: 'email',
    error: 'Enter a complete email address, for example name@company.com.',
  },
};

export const InvalidAndFocused: Story = {
  args: {
    label: 'Password',
    type: 'password',
    value: 'short',
    error: 'Password must be at least 12 characters.',
  },
  parameters: { snapshot: { delay: 300 } },
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = {
  args: {
    label: 'Organisation ID',
    value: 'org_8f21c07a',
    disabled: true,
    helperText: 'Contact support to change your organisation ID.',
  },
};
