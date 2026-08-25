import { describe, expect, it } from 'vitest';
import { StorybookDriver } from '../src/drivers/storybook.js';

describe('Real-World Storybook Design System Index Parsing', () => {
  const driver = new StorybookDriver();

  const mockIndex = {
    v: 4,
    entries: {
      'components-button--responsive-matrix': {
        id: 'components-button--responsive-matrix',
        title: 'Components/Button',
        name: 'ResponsiveMatrix',
        importPath: './src/Button.stories.tsx',
        type: 'story',
        parameters: {
          snapshot: {
            viewports: [
              { name: 'mobile', width: 375, height: 667 },
              { name: 'tablet', width: 768, height: 1024 },
              { name: 'desktop', width: 1280, height: 800 },
            ],
          },
        },
      },
      'components-card--featured': {
        id: 'components-card--featured',
        title: 'Components/Card',
        name: 'Featured',
        importPath: './src/Card.stories.tsx',
        type: 'story',
        parameters: {
          snapshot: {
            threshold: 0.02,
          },
        },
      },
      'components-modal--default': {
        id: 'components-modal--default',
        title: 'Components/Modal',
        name: 'Default',
        importPath: './src/Modal.stories.tsx',
        type: 'story',
        parameters: {
          snapshot: {
            delay: 150,
            pauseAnimationAtEnd: true,
          },
        },
      },
      'components-badge--live-indicator': {
        id: 'components-badge--live-indicator',
        title: 'Components/Badge',
        name: 'LiveIndicator',
        importPath: './src/Badge.stories.tsx',
        type: 'story',
      },
      'components-badge--disabled': {
        id: 'components-badge--disabled',
        title: 'Components/Badge',
        name: 'Disabled',
        importPath: './src/Badge.stories.tsx',
        type: 'story',
        parameters: {
          snapshot: {
            disable: true,
          },
        },
      },
    },
  };

  it('parses Button stories with responsive modes parameter matrix', () => {
    const stories = (driver as any).parseStoryIndex(
      mockIndex,
      'http://localhost:6006',
    );
    const responsiveStory = stories.find(
      (s: any) => s.name === 'ResponsiveMatrix',
    );
    expect(responsiveStory).toBeDefined();
    expect(responsiveStory?.snapshot?.viewports).toEqual([
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
    ]);
  });

  it('parses Card stories with custom thresholds and named viewports', () => {
    const stories = (driver as any).parseStoryIndex(
      mockIndex,
      'http://localhost:6006',
    );
    const featuredStory = stories.find((s: any) => s.name === 'Featured');
    expect(featuredStory?.snapshot?.threshold ?? featuredStory?.snapshot?.diffThreshold).toBe(0.02);
  });

  it('parses Modal stories with animation and delay parameters', () => {
    const stories = (driver as any).parseStoryIndex(
      mockIndex,
      'http://localhost:6006',
    );
    const modalStory = stories.find((s: any) => s.group === 'Modal');
    expect(modalStory?.snapshot?.delay).toBe(150);
    expect(modalStory?.snapshot?.pauseAnimationAtEnd).toBe(true);
  });

  it('honors disable parameters in Badge stories', () => {
    const stories = (driver as any).parseStoryIndex(
      mockIndex,
      'http://localhost:6006',
    );
    const badgeStories = stories.filter((s: any) => s.group === 'Badge');
    expect(badgeStories).toHaveLength(1);
    expect(badgeStories[0].name).toBe('LiveIndicator');
  });
});
