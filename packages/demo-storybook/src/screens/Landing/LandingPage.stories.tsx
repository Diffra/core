import type { Meta, StoryObj } from '@storybook/react';
import { LandingPage } from './LandingPage';

const meta: Meta<typeof LandingPage> = {
  title: 'Screens/Landing page',
  component: LandingPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof LandingPage>;

/** The first screen every visitor sees, including the hero illustration. */
export const Home: Story = {};
