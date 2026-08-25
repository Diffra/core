import { describe, expect, it } from 'vitest';
import { StorybookDriver } from '../src/drivers/storybook.js';
import type { TargetParameters } from '../src/types/index.js';

describe('3-Tier Parameter Cascade & Snapshot Hierarchy', () => {
  it('merges story parameters and filters disabled stories', () => {
    const driver = new StorybookDriver();
    const mockIndex = {
      v: 4,
      entries: {
        'components-hero--default': {
          id: 'components-hero--default',
          title: 'Components/Hero',
          name: 'Default',
          type: 'story',
          parameters: {
            snapshot: {
              delay: 300,
              diffThreshold: 0.08,
              pauseAnimationAtEnd: true,
            },
          },
        },
        'components-hero--custom-delay': {
          id: 'components-hero--custom-delay',
          title: 'Components/Hero',
          name: 'CustomDelay',
          type: 'story',
          parameters: {
            snapshot: {
              delay: 800,
              diffThreshold: 0.02,
              mask: ['.live-clock'],
            },
          },
        },
        'components-hero--disabled': {
          id: 'components-hero--disabled',
          title: 'Components/Hero',
          name: 'Disabled',
          type: 'story',
          parameters: {
            snapshot: {
              disableSnapshot: true,
            },
          },
        },
      },
    };

    const stories = (driver as any).parseStoryIndex(
      mockIndex,
      'http://localhost:6006',
    );
    expect(stories).toHaveLength(2); // Disabled story skipped

    const defaultStory = stories.find((s: any) => s.name === 'Default')!;
    expect(defaultStory).toBeDefined();
    const defaultParams = defaultStory.snapshot as TargetParameters;
    expect(defaultParams.delay).toBe(300);
    expect(defaultParams.diffThreshold).toBe(0.08);

    const customStory = stories.find((s: any) => s.name === 'CustomDelay')!;
    expect(customStory).toBeDefined();
    const customParams = customStory.snapshot as TargetParameters;
    expect(customParams.delay).toBe(800);
    expect(customParams.diffThreshold).toBe(0.02);
    expect(customParams.mask).toEqual(['.live-clock']);
  });

  it('supports pauseAnimationAtEnd snapshot parameter', () => {
    const driver = new StorybookDriver();
    const mockIndex = {
      v: 4,
      entries: {
        'animations-spinner--running': {
          id: 'animations-spinner--running',
          title: 'Animations/Spinner',
          name: 'Running',
          type: 'story',
          parameters: {
            snapshot: {
              pauseAnimationAtEnd: false,
            },
          },
        },
      },
    };

    const stories = (driver as any).parseStoryIndex(
      mockIndex,
      'http://localhost:6006',
    );
    expect(stories).toHaveLength(1);
    const story = stories[0];
    const params = story.snapshot as TargetParameters;
    expect(params.pauseAnimationAtEnd).toBe(false);
  });
});
