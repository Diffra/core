import type {
  DriverCaptureResult,
  DriverCaptureTask,
  DriverContext,
  FigmaDriverConfig,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export class FigmaDriver implements VisualDriver {
  name = 'figma';
  private options?: FigmaDriverConfig;
  private imageCache = new Map<string, Buffer>();

  constructor(options?: FigmaDriverConfig) {
    this.options = options;
  }

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const figmaConfig = this.options;
    if (!figmaConfig || !figmaConfig.fileKey) {
      return [];
    }

    const token =
      figmaConfig.personalAccessToken ||
      process.env.FIGMA_ACCESS_TOKEN ||
      process.env.FIGMA_TOKEN;

    const targets: VisualTarget[] = [];
    const diffThreshold =
      figmaConfig.snapshot?.diffThreshold ?? context.config.snapshot?.diffThreshold ?? 0.063;

    // 1. Explicit components mapping { 'Components/Button/Primary': '123:45' }
    if (figmaConfig.components) {
      for (const [compName, nodeId] of Object.entries(figmaConfig.components)) {
        const cleanName = compName.split('/').pop() || compName;
        const groupName = compName.includes('/')
          ? compName.substring(0, compName.lastIndexOf('/'))
          : 'Components';

        targets.push({
          id: `figma--${nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          name: cleanName,
          group: groupName,
          snapshot: {
            diffThreshold,
          },
          metadata: {
            figmaNodeId: nodeId,
            figmaFileKey: figmaConfig.fileKey,
            figmaVersion: figmaConfig.version,
          },
        });
      }
      return targets;
    }

    // 2. Explicit list of nodeIds ['123:45', '123:46']
    if (figmaConfig.nodeIds && figmaConfig.nodeIds.length > 0) {
      for (const nodeId of figmaConfig.nodeIds) {
        targets.push({
          id: `figma--${nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          name: `Frame ${nodeId}`,
          group: 'Figma',
          snapshot: {
            diffThreshold,
          },
          metadata: {
            figmaNodeId: nodeId,
            figmaFileKey: figmaConfig.fileKey,
            figmaVersion: figmaConfig.version,
          },
        });
      }
      return targets;
    }

    // 3. Auto-discover top-level frames from Figma File REST API
    if (token) {
      try {
        const fileUrl = `https://api.figma.com/v1/files/${figmaConfig.fileKey}${
          figmaConfig.version ? `?version=${figmaConfig.version}` : ''
        }`;
        const res = await fetch(fileUrl, {
          headers: {
            'X-Figma-Token': token,
          },
        });

        if (res.ok) {
          const data = (await res.json()) as {
            document?: {
              children?: Array<{
                name?: string;
                children?: Array<{ id: string; name: string; type: string }>;
              }>;
            };
          };

          for (const page of data.document?.children || []) {
            const pageName = page.name || 'Figma';
            for (const frame of page.children || []) {
              if (
                ['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(frame.type)
              ) {
                targets.push({
                  id: `figma--${frame.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
                  name: frame.name,
                  group: pageName,
                  snapshot: {
                    diffThreshold,
                  },
                  metadata: {
                    figmaNodeId: frame.id,
                    figmaFileKey: figmaConfig.fileKey,
                    figmaVersion: figmaConfig.version,
                  },
                });
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[diffra] Warning discovering Figma frames: ${msg}`);
      }
    }

    return targets;
  }

  async captureAll(
    tasks: DriverCaptureTask[],
    _context: DriverContext,
  ): Promise<DriverCaptureResult[]> {
    const figmaConfig = this.options;
    if (!figmaConfig || !figmaConfig.fileKey) {
      return [];
    }

    const token =
      figmaConfig.personalAccessToken ||
      process.env.FIGMA_ACCESS_TOKEN ||
      process.env.FIGMA_TOKEN;

    if (!token) {
      console.warn(
        '[diffra] Warning: FIGMA_ACCESS_TOKEN is required to capture Figma frames.',
      );
      return [];
    }

    const results: DriverCaptureResult[] = [];
    const scale = figmaConfig.scale || 1;

    // Batch node IDs in chunks of 50 to respect Figma API rate limits
    const BATCH_SIZE = 50;
    const nodeTasks: Array<{ task: DriverCaptureTask; nodeId: string }> = [];

    for (const task of tasks) {
      const nodeId = task.target.metadata?.figmaNodeId as string | undefined;
      if (nodeId) {
        nodeTasks.push({ task, nodeId });
      }
    }

    for (let i = 0; i < nodeTasks.length; i += BATCH_SIZE) {
      const batch = nodeTasks.slice(i, i + BATCH_SIZE);
      const nodeIdsParam = batch.map((b) => b.nodeId).join(',');

      try {
        let apiUrl = `https://api.figma.com/v1/images/${figmaConfig.fileKey}?ids=${encodeURIComponent(
          nodeIdsParam,
        )}&scale=${scale}&format=png`;
        if (figmaConfig.version) {
          apiUrl += `&version=${encodeURIComponent(figmaConfig.version)}`;
        }

        const res = await fetch(apiUrl, {
          headers: {
            'X-Figma-Token': token,
          },
        });

        if (res.ok) {
          const data = (await res.json()) as {
            images?: Record<string, string | null>;
          };
          const imageUrls = data.images || {};

          for (const item of batch) {
            const imageUrl = imageUrls[item.nodeId];
            if (imageUrl) {
              try {
                let imgBuffer = this.imageCache.get(imageUrl);
                if (!imgBuffer) {
                  const imgRes = await fetch(imageUrl);
                  if (imgRes.ok) {
                    const arrayBuf = await imgRes.arrayBuffer();
                    imgBuffer = Buffer.from(arrayBuf);
                    this.imageCache.set(imageUrl, imgBuffer);
                  }
                }

                if (imgBuffer) {
                  results.push({
                    target: item.task.target,
                    viewport: item.task.viewport,
                    project: item.task.project,
                    buffer: imgBuffer,
                  });
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(
                  `[diffra] Could not download Figma frame ${item.nodeId}: ${msg}`,
                );
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[diffra] Figma batch API request failed: ${msg}`);
      }
    }

    return results;
  }

  async capture(
    task: DriverCaptureTask,
    context: DriverContext,
  ): Promise<Buffer | null> {
    const results = await this.captureAll([task], context);
    return results[0]?.buffer || null;
  }
}

export function createFigmaDriver(options?: FigmaDriverConfig): VisualDriver {
  return new FigmaDriver(options);
}
