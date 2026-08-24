import type {
  DiffraConfig,
  DiffraPlugin,
  StoryMetadata,
  TestRunReport,
  Viewport,
} from '../types/index.js';

export class PluginRunner {
  private plugins: DiffraPlugin[];

  constructor(plugins: DiffraPlugin[] = []) {
    this.plugins = plugins;
  }

  async hookSetup(config: DiffraConfig): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.setup) {
        await plugin.setup(config);
      }
    }
  }

  async hookDiscoverStories(
    stories: StoryMetadata[],
  ): Promise<StoryMetadata[]> {
    let currentStories = [...stories];
    for (const plugin of this.plugins) {
      if (plugin.onDiscoverStories) {
        currentStories = await plugin.onDiscoverStories(currentStories);
      }
    }
    return currentStories;
  }

  async hookBeforeCapture(
    story: StoryMetadata,
    viewport: Viewport,
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onBeforeCapture) {
        await plugin.onBeforeCapture(story, viewport);
      }
    }
  }

  async hookAfterCapture(
    story: StoryMetadata,
    viewport: Viewport,
    buffer: Buffer,
  ): Promise<Buffer> {
    let currentBuffer = buffer;
    for (const plugin of this.plugins) {
      if (plugin.onAfterCapture) {
        currentBuffer = await plugin.onAfterCapture(
          story,
          viewport,
          currentBuffer,
        );
      }
    }
    return currentBuffer;
  }

  async hookTestComplete(report: TestRunReport): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onTestComplete) {
        await plugin.onTestComplete(report);
      }
    }
  }
}
