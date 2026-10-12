import type {
  DriverCaptureResult,
  DriverCaptureTask,
  DriverContext,
  FigmaDriverConfig,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export class BoundedLruCache<K, V> {
  private map = new Map<K, V>();
  constructor(private readonly maxSize: number = 100) {}

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

async function fetchFigmaWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
      attempt++;
      const retryAfterHeader = res.headers.get('retry-after');
      let delayMs = 1000 * 2 ** attempt + Math.random() * 500;
      if (retryAfterHeader) {
        const parsed = Number(retryAfterHeader);
        if (!Number.isNaN(parsed) && parsed > 0) {
          delayMs = parsed * 1000;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    return res;
  }
}

function logFigmaDiagnostic(
  res: Response,
  fileKey: string,
  maxRetries: number,
): void {
  if (res.status === 401 || res.status === 403) {
    console.warn(
      `[diffra] Figma API authentication failed (${res.status}): Verify your personal access token and file permissions.`,
    );
  } else if (res.status === 404) {
    console.warn(
      `[diffra] Figma file not found (404): Verify file key "${fileKey}".`,
    );
  } else if (res.status === 429) {
    console.warn(
      `[diffra] Figma API rate limit exceeded (429) after ${maxRetries} retries.`,
    );
  } else {
    console.warn(
      `[diffra] Figma API request failed (${res.status} ${res.statusText}).`,
    );
  }
}

export class FigmaDriver implements VisualDriver {
  name = 'figma';
  private options?: FigmaDriverConfig;
  private imageCache: BoundedLruCache<string, Buffer>;

  constructor(options?: FigmaDriverConfig) {
    this.options = options;
    this.imageCache = new BoundedLruCache<string, Buffer>(
      options?.maxCacheEntries ?? 100,
    );
  }

  public getCache(): BoundedLruCache<string, Buffer> {
    return this.imageCache;
  }

  private getBaseUrl(): string {
    const custom =
      this.options?.endpoint ||
      this.options?.baseUrl ||
      process.env.FIGMA_ENDPOINT ||
      process.env.FIGMA_BASE_URL ||
      'https://api.figma.com';
    return custom.replace(/\/+$/, '');
  }

  teardown(_context?: DriverContext): void {
    this.imageCache.clear();
  }

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const figmaConfig = this.options;
    if (!figmaConfig?.fileKey) {
      return [];
    }

    const token =
      figmaConfig.personalAccessToken ||
      process.env.FIGMA_ACCESS_TOKEN ||
      process.env.FIGMA_TOKEN;

    const targets: VisualTarget[] = [];
    const diffThreshold =
      figmaConfig.snapshot?.diffThreshold ??
      context.config.snapshot?.diffThreshold ??
      0.063;
    const maxRetries = figmaConfig.maxRetries ?? 3;

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
        const baseUrl = this.getBaseUrl();
        const fileUrl = `${baseUrl}/v1/files/${figmaConfig.fileKey}${
          figmaConfig.version ? `?version=${figmaConfig.version}` : ''
        }`;
        const res = await fetchFigmaWithRetry(
          fileUrl,
          {
            headers: {
              'X-Figma-Token': token,
            },
          },
          maxRetries,
        );

        if (!res.ok) {
          logFigmaDiagnostic(res, figmaConfig.fileKey, maxRetries);
          return [];
        }

        const rawData: unknown = await res.json();
        const data: {
          document?: {
            children?: Array<{
              name?: string;
              children?: Array<{ id: string; name: string; type: string }>;
            }>;
          };
        } =
          typeof rawData === 'object' && rawData !== null
            ? (rawData as {
                document?: {
                  children?: Array<{
                    name?: string;
                    children?: Array<{
                      id: string;
                      name: string;
                      type: string;
                    }>;
                  }>;
                };
              })
            : {};

        for (const page of data.document?.children || []) {
          const pageName = page.name || 'Figma';
          for (const frame of page.children || []) {
            if (['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(frame.type)) {
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
    if (!figmaConfig?.fileKey) {
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
    const maxRetries = figmaConfig.maxRetries ?? 3;
    const baseUrl = this.getBaseUrl();

    // Batch node IDs in chunks of 50 to respect Figma API rate limits
    const BATCH_SIZE = 50;
    const nodeTasks: Array<{ task: DriverCaptureTask; nodeId: string }> = [];

    for (const task of tasks) {
      const nodeId =
        typeof task.target.metadata?.figmaNodeId === 'string'
          ? task.target.metadata.figmaNodeId
          : undefined;
      if (nodeId) {
        nodeTasks.push({ task, nodeId });
      }
    }

    for (let i = 0; i < nodeTasks.length; i += BATCH_SIZE) {
      const batch = nodeTasks.slice(i, i + BATCH_SIZE);
      const nodeIdsParam = batch.map((b) => b.nodeId).join(',');

      try {
        let apiUrl = `${baseUrl}/v1/images/${figmaConfig.fileKey}?ids=${encodeURIComponent(
          nodeIdsParam,
        )}&scale=${scale}&format=png`;
        if (figmaConfig.version) {
          apiUrl += `&version=${encodeURIComponent(figmaConfig.version)}`;
        }

        const res = await fetchFigmaWithRetry(
          apiUrl,
          {
            headers: {
              'X-Figma-Token': token,
            },
          },
          maxRetries,
        );

        if (!res.ok) {
          logFigmaDiagnostic(res, figmaConfig.fileKey, maxRetries);
          continue;
        }

        const rawData: unknown = await res.json();
        const data: { images?: Record<string, string | null> } =
          typeof rawData === 'object' && rawData !== null
            ? (rawData as { images?: Record<string, string | null> })
            : {};
        const imageUrls = data.images || {};

        // Concurrently download images for the batch
        await Promise.all(
          batch.map(async (item) => {
            const imageUrl = imageUrls[item.nodeId];
            if (!imageUrl) {
              console.warn(
                `[diffra] Warning: Figma frame ${item.nodeId} was not found in file "${figmaConfig.fileKey}".`,
              );
              return;
            }

            try {
              let imgBuffer = this.imageCache.get(imageUrl);
              if (!imgBuffer) {
                const imgRes = await fetchFigmaWithRetry(
                  imageUrl,
                  {},
                  maxRetries,
                );
                if (imgRes.ok) {
                  const arrayBuf = await imgRes.arrayBuffer();
                  imgBuffer = Buffer.from(arrayBuf);
                  this.imageCache.set(imageUrl, imgBuffer);
                } else {
                  console.warn(
                    `[diffra] Could not download Figma frame ${item.nodeId}: HTTP ${imgRes.status}`,
                  );
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
          }),
        );
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
