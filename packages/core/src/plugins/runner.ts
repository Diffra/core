import type {
  DiffraConfig,
  DiffraPlugin,
  TestRunReport,
  Viewport,
  VisualTarget,
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

  async hookDiscoverTargets(targets: VisualTarget[]): Promise<VisualTarget[]> {
    let currentTargets = [...targets];
    for (const plugin of this.plugins) {
      if (plugin.onDiscoverTargets) {
        currentTargets = await plugin.onDiscoverTargets(currentTargets);
      }
    }
    return currentTargets;
  }

  async hookBeforeCapture(
    target: VisualTarget,
    viewport: Viewport,
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onBeforeCapture) {
        await plugin.onBeforeCapture(target, viewport);
      }
    }
  }

  async hookAfterCapture(
    target: VisualTarget,
    viewport: Viewport,
    buffer: Buffer,
  ): Promise<Buffer> {
    let currentBuffer = buffer;
    for (const plugin of this.plugins) {
      if (plugin.onAfterCapture) {
        currentBuffer = await plugin.onAfterCapture(
          target,
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
