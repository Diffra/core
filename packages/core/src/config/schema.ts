import { z } from 'zod';

export const DEFAULT_DIFF_THRESHOLD = 0.063;
export const DEFAULT_DELAY_MS = 100;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_OUTPUT_DIR = '.diffra';
export const DEFAULT_BASELINE_DIR = '.diffra/baselines';
export const DEFAULT_VIEWPORTS = [
  { width: 1280, height: 800, name: 'desktop' },
];

export const ViewportSchema = z.union([
  z.number().int().positive(),
  z.object({
    name: z.string().optional(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
]);

export const SnapshotConfigSchema = z.object({
  diffThreshold: z.number().min(0).max(1).default(DEFAULT_DIFF_THRESHOLD),
  delay: z.number().nonnegative().default(DEFAULT_DELAY_MS),
  pauseAnimationAtEnd: z.boolean().default(true),
  viewports: z.array(ViewportSchema).default(DEFAULT_VIEWPORTS),
  selector: z.string().optional(),
  mask: z.array(z.any()).optional(),
  fullPage: z.boolean().optional(),
  disable: z.boolean().optional(),
  clip: z.any().optional(),
  omitBackground: z.boolean().optional(),
  modes: z.record(z.string(), z.any()).optional(),
  screenshotOptions: z.any().optional(),
});

export const RunnerConfigSchema = z.object({
  concurrency: z.number().int().positive().default(DEFAULT_CONCURRENCY),
  baselineBranch: z.string().optional(),
  shard: z.string().optional(),
  projects: z.array(z.any()).optional(),
  launchOptions: z.any().optional(),
});

export const StorageConfigSchema = z.any();

export const DiffraConfigSchema = z.object({
  drivers: z.union([z.any(), z.array(z.any())]).default('storybook'),
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
  reporters: z.array(z.any()).default([]),
  plugins: z.array(z.any()).default([]),
  diffEngine: z.any().optional(),
  targets: z.any().optional(),
});

export type DiffraConfigInput = z.input<typeof DiffraConfigSchema>;
export type DiffraConfigResolved = z.infer<typeof DiffraConfigSchema>;
