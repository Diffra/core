import { z } from 'zod';

export const DEFAULT_DIFF_THRESHOLD = 0.063;
export const DEFAULT_DELAY_MS = 100;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_OUTPUT_DIR = '.diffra';
export const DEFAULT_BASELINE_BRANCH = 'origin/main';
export const DEFAULT_VIEWPORTS = [{ width: 1280, height: 800, name: 'desktop' }];
export const DEFAULT_STORY_GLOBS = ['src/**/*.stories.@(js|jsx|ts|tsx)'];

export const ViewportSchema = z.object({
  name: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const StorageSchema = z.any();

export const DiffraConfigSchema = z.object({
  driver: z.any().optional(),
  drivers: z.array(z.any()).optional(),
  targets: z.any().optional(),
  urls: z.array(z.any()).optional(),
  imagesDir: z.string().optional(),
  figma: z.any().optional(),
  projects: z.array(z.any()).optional(),
  shard: z.string().optional(),
  viewerUrl: z.string().optional(),
  baseUrl: z.string().optional(),
  previewUrl: z.string().optional(),
  storybookUrl: z.string().optional(),
  storybookPort: z.number().int().optional(),
  stories: z.array(z.string()).default(DEFAULT_STORY_GLOBS),
  viewports: z.array(ViewportSchema).default(DEFAULT_VIEWPORTS),
  diffThreshold: z.number().min(0).max(1).default(DEFAULT_DIFF_THRESHOLD),
  threshold: z.number().min(0).max(1).default(DEFAULT_DIFF_THRESHOLD),
  delay: z.number().nonnegative().default(DEFAULT_DELAY_MS),
  pauseAnimationAtEnd: z.boolean().default(true),
  animations: z.enum(['disabled', 'allow']).default('disabled').optional(),
  launchOptions: z.any().optional(),
  concurrency: z.number().int().positive().default(DEFAULT_CONCURRENCY),
  outputDir: z.string().default(DEFAULT_OUTPUT_DIR),
  baselineBranch: z.string().default(DEFAULT_BASELINE_BRANCH),
  storage: StorageSchema.default({ type: 'local' }).optional(),
  notifiers: z.array(z.any()).optional(),
  diffEngine: z.any().optional(),
  plugins: z.array(z.any()).optional(),
  notifier: z
    .object({
      github: z
        .object({
          token: z.string().optional(),
          repo: z.string().optional(),
          prNumber: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type DiffraConfigInput = z.input<typeof DiffraConfigSchema>;
export type DiffraConfigResolved = z.infer<typeof DiffraConfigSchema>;
