import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCSF } from '../src/index.js';

describe('Real-World Storybook Design System Parsing', () => {
  const exampleStorybookDir = path.resolve(
    import.meta.dirname,
    '../../storybook/src/components',
  );

  it('parses Button stories with responsive modes parameter matrix', async () => {
    const buttonCode = await fs.readFile(
      path.join(exampleStorybookDir, 'Button/Button.stories.tsx'),
      'utf-8',
    );
    const stories = parseCSF(buttonCode, 'Button.stories.tsx');

    expect(stories.length).toBe(4);
    const responsiveStory = stories.find((s) => s.name === 'ResponsiveMatrix');
    expect(responsiveStory).toBeDefined();
    expect(responsiveStory?.parameters?.snapshot?.viewports).toEqual([
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
    ]);
  });

  it('parses Card stories with custom thresholds and named viewports', async () => {
    const cardCode = await fs.readFile(
      path.join(exampleStorybookDir, 'Card/Card.stories.tsx'),
      'utf-8',
    );
    const stories = parseCSF(cardCode, 'Card.stories.tsx');

    expect(stories.length).toBe(2);
    const featuredStory = stories.find((s) => s.name === 'Featured');
    expect(featuredStory?.parameters?.snapshot?.threshold).toBe(0.02);
  });

  it('parses Modal stories with animation and delay parameters', async () => {
    const modalCode = await fs.readFile(
      path.join(exampleStorybookDir, 'Modal/Modal.stories.tsx'),
      'utf-8',
    );
    const stories = parseCSF(modalCode, 'Modal.stories.tsx');

    expect(stories.length).toBe(1);
    expect(stories[0].parameters?.snapshot?.delay).toBe(150);
    expect(stories[0].parameters?.snapshot?.pauseAnimationAtEnd).toBe(true);
  });

  it('honors disable parameters in Badge stories', async () => {
    const badgeCode = await fs.readFile(
      path.join(exampleStorybookDir, 'Badge/Badge.stories.tsx'),
      'utf-8',
    );
    const stories = parseCSF(badgeCode, 'Badge.stories.tsx');

    expect(stories.length).toBe(1);
    expect(stories[0].name).toBe('LiveIndicator');
  });
});
