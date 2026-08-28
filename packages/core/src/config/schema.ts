import { z } from 'zod';
import type {
  DiffEngineAdapter,
  DiffraPlugin,
  LaunchOptions,
  Locator,
  NotifierAdapter,
  PageScreenshotOptions,
  Project,
  StorageAdapter,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export const DEFAULT_DIFF_THRESHOLD = 0.063;
export const DEFAULT_DELAY_MS = 100;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_OUTPUT_DIR = '.diffra';
export const DEFAULT_BASELINE_DIR = '.diffra/baselines';
export const DEFAULT_VIEWPORTS = [
  { width: 1280, height: 800, name: 'desktop' },
];

export const ViewportObjectSchema = z.object({
  name: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const ViewportSchema = z.union([
  z.number().int().positive(),
  ViewportObjectSchema,
]);

export const ClipRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const SnapshotConfigSchema: z.ZodType<{
  diffThreshold?: number;
  delay?: number;
  pauseAnimationAtEnd?: boolean;
  viewports?: (
    | number
    | {
        name?: string;
        width: number;
        height: number;
      }
  )[];
  selector?: string;
  mask?: (string | Locator)[];
  fullPage?: boolean;
  disable?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  omitBackground?: boolean;
  modes?: Record<string, Record<string, unknown>>;
  screenshotOptions?: PageScreenshotOptions;
}> = z.lazy(() =>
  z.object({
    diffThreshold: z.number().min(0).max(1).default(DEFAULT_DIFF_THRESHOLD),
    delay: z.number().nonnegative().default(DEFAULT_DELAY_MS),
    pauseAnimationAtEnd: z.boolean().default(true),
    viewports: z.array(ViewportSchema).default(DEFAULT_VIEWPORTS),
    selector: z.string().optional(),
    mask: z
      .array(
        z.union([
          z.string(),
          z.custom<Locator>((val) => typeof val === 'object' && val !== null),
        ]),
      )
      .optional(),
    fullPage: z.boolean().optional(),
    disable: z.boolean().optional(),
    clip: ClipRectSchema.optional(),
    omitBackground: z.boolean().optional(),
    modes: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    screenshotOptions: z
      .custom<PageScreenshotOptions>(
        (val) => typeof val === 'object' && val !== null,
      )
      .optional(),
  }),
);

export const ProjectSchema: z.ZodType<Project> = z.object({
  name: z.string(),
  browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
  use: z
    .custom<Project['use']>((val) => typeof val === 'object' && val !== null)
    .optional(),
  launchOptions: z
    .custom<LaunchOptions>((val) => typeof val === 'object' && val !== null)
    .optional(),
});

export const RunnerConfigSchema = z.object({
  concurrency: z.number().int().positive().default(DEFAULT_CONCURRENCY),
  baselineBranch: z.string().optional(),
  shard: z.string().optional(),
  projects: z.array(ProjectSchema).optional(),
  launchOptions: z
    .custom<LaunchOptions>((val) => typeof val === 'object' && val !== null)
    .optional(),
});

export const LocalStorageConfigSchema = z.object({
  provider: z.literal('local').default('local'),
  dir: z.string().optional(),
  outputDir: z.string().optional(),
});

export const S3StorageConfigSchema = z.object({
  provider: z.literal('s3'),
  bucket: z.string(),
  region: z.string().optional(),
  prefix: z.string().optional(),
  endpoint: z.string().optional(),
});

export const GCSStorageConfigSchema = z.object({
  provider: z.literal('gcs'),
  bucket: z.string(),
  prefix: z.string().optional(),
});

export const AzureStorageConfigSchema = z.object({
  provider: z.literal('azure'),
  container: z.string(),
  connectionString: z.string().optional(),
  prefix: z.string().optional(),
});

export const StorageAdapterSchema = z.custom<StorageAdapter>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    'uploadCandidate' in val &&
    typeof (val as StorageAdapter).uploadCandidate === 'function',
);

export const StorageConfigSchema = z.union([
  LocalStorageConfigSchema,
  S3StorageConfigSchema,
  GCSStorageConfigSchema,
  AzureStorageConfigSchema,
  StorageAdapterSchema,
]);

export const StorybookDriverConfigSchema = z.object({
  driver: z.literal('storybook'),
  url: z.string().optional(),
  buildDir: z.string().optional(),
});

export const UrlTargetConfigSchema = z.object({
  url: z.string(),
  name: z.string().optional(),
  group: z.string().optional(),
  snapshot: SnapshotConfigSchema.optional(),
});

export const UrlDriverConfigSchema = z.object({
  driver: z.literal('url'),
  baseUrl: z.string().optional(),
  urls: z.array(z.union([z.string(), UrlTargetConfigSchema])),
});

export const ImageDriverConfigSchema = z.object({
  driver: z.literal('image'),
  dir: z.string(),
});

export const FigmaDriverConfigSchema = z.object({
  driver: z.literal('figma').optional(),
  fileKey: z.string(),
  personalAccessToken: z.string().optional(),
  nodeIds: z.array(z.string()).optional(),
  components: z.record(z.string(), z.string()).optional(),
  version: z.string().optional(),
  scale: z.number().optional(),
  snapshot: SnapshotConfigSchema.optional(),
});

export const VisualDriverSchema = z.custom<VisualDriver>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    'name' in val &&
    typeof (val as VisualDriver).name === 'string',
);

export const DriverInputSchema = z.union([
  z.enum(['storybook', 'url', 'image', 'figma']),
  StorybookDriverConfigSchema,
  UrlDriverConfigSchema,
  ImageDriverConfigSchema,
  FigmaDriverConfigSchema,
  VisualDriverSchema,
]);

export const ReporterConfigSchema = z.union([
  z.object({
    type: z.literal('github'),
    token: z.string().optional(),
    repo: z.string().optional(),
    prNumber: z.number().optional(),
    viewerUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal('slack'),
    webhookUrl: z.string(),
    channel: z.string().optional(),
  }),
  z.object({
    type: z.literal('json'),
    outputFile: z.string().optional(),
  }),
]);

export const NotifierAdapterSchema = z.custom<NotifierAdapter>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    'notify' in val &&
    typeof (val as NotifierAdapter).notify === 'function',
);

export const ReporterInputSchema = z.union([
  z.enum(['github', 'slack', 'json']),
  ReporterConfigSchema,
  NotifierAdapterSchema,
]);

export const DiffraPluginSchema = z.custom<DiffraPlugin>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    'name' in val &&
    typeof (val as DiffraPlugin).name === 'string',
);

export const DiffEngineAdapterSchema = z.custom<DiffEngineAdapter>(
  (val) =>
    typeof val === 'object' &&
    val !== null &&
    'compare' in val &&
    typeof (val as DiffEngineAdapter).compare === 'function',
);

export const TargetProviderSchema = z.custom<
  VisualTarget[] | (() => Promise<VisualTarget[]> | VisualTarget[])
>((val) => Array.isArray(val) || typeof val === 'function');

export const DiffraConfigSchema = z.object({
  drivers: z
    .union([DriverInputSchema, z.array(DriverInputSchema)])
    .default('storybook'),
  snapshot: SnapshotConfigSchema.default({
    diffThreshold: DEFAULT_DIFF_THRESHOLD,
    delay: DEFAULT_DELAY_MS,
    pauseAnimationAtEnd: true,
    viewports: DEFAULT_VIEWPORTS,
  }),
  runner: RunnerConfigSchema.default({
    concurrency: DEFAULT_CONCURRENCY,
  }),
  storage: StorageConfigSchema.default({
    provider: 'local',
    dir: DEFAULT_BASELINE_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
  }),
  reporters: z.array(ReporterInputSchema).default([]),
  plugins: z.array(DiffraPluginSchema).default([]),
  diffEngine: DiffEngineAdapterSchema.optional(),
  targets: TargetProviderSchema.optional(),
});

export type DiffraConfigInput = z.input<typeof DiffraConfigSchema>;
export type DiffraConfigResolved = z.infer<typeof DiffraConfigSchema>;
