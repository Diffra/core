import type { Meta, StoryObj } from '@storybook/react';
import { SignInPage } from './SignInPage';

const meta: Meta<typeof SignInPage> = {
  title: 'Screens/Sign in',
  component: SignInPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof SignInPage>;

/** Dark theme. Text that ignores the theme becomes unreadable. */
export const DarkMode: Story = {};
