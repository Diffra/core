import { describe, expect, it } from 'vitest';
import { parseCSF, toStoryId } from '../src/parser/csf-parser.js';

describe('CSF Parser', () => {
  it('converts title and name to canonical Storybook story ID', () => {
    expect(toStoryId('Components/Button', 'Primary')).toBe(
      'components-button--primary',
    );
    expect(toStoryId('Design System/Forms/Input Field', 'Disabled State')).toBe(
      'design-system-forms-input-field--disabled-state',
    );
  });

  it('parses CSF 3.0 stories with title and custom diffra parameters', () => {
    const csfCode = `
      import type { Meta, StoryObj } from '@storybook/react';
      import { Button } from './Button';

      const meta: Meta<typeof Button> = {
        title: 'Components/Button',
        component: Button,
        parameters: {
          diffra: {
            delay: 300,
            threshold: 0.05,
          },
        },
      };
      export default meta;

      export const Primary: StoryObj<typeof Button> = {
        args: { label: 'Click Me', primary: true },
      };

      export const Secondary: StoryObj<typeof Button> = {
        args: { label: 'Cancel' },
        parameters: {
          diffra: {
            delay: 500,
          },
        },
      };

      export const IgnoredStory: StoryObj<typeof Button> = {
        parameters: {
          diffra: {
            disable: true,
          },
        },
      };
    `;

    const stories = parseCSF(csfCode, 'src/components/Button.stories.tsx');
    expect(stories).toHaveLength(2); // IgnoredStory is disabled

    const [primary, secondary] = stories;
    expect(primary.id).toBe('components-button--primary');
    expect(primary.name).toBe('Primary');
    expect(primary.component).toBe('Button');
    expect(primary.parameters?.diffra?.delay).toBe(300);
    expect(primary.parameters?.diffra?.threshold).toBe(0.05);

    expect(secondary.id).toBe('components-button--secondary');
    expect(secondary.parameters?.diffra?.delay).toBe(500);
  });
});
