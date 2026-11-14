import type { Meta, StoryObj } from '@storybook/react';
import { ArticlePage } from './ArticlePage';

const meta: Meta<typeof ArticlePage> = {
  title: 'Screens/Blog',
  component: ArticlePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ArticlePage>;

/** Long-form reading. Broken typography makes the content unreadable. */
export const Article: Story = {};
