import { z } from 'zod';

export const ViewportSchema = z.object({
  name: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const StorageSchema = z.any();

export const DiffraConfigSchema = z.object({
  storybookUrl: z.string().default('http://localhost:6006'),
  storybookPort: z.number().int().optional(),
  stories: z.array(z.string()).default(['src/**/*.stories.@(js|jsx|ts|tsx)']),
  viewports: z
    .array(ViewportSchema)
    .default([{ width: 1280, height: 800, name: 'desktop' }]),
  diffThreshold: z.number().min(0).max(1).default(0.063),
  threshold: z.number().min(0).max(1).default(0.063),
  delay: z.number().nonnegative().default(100),
  pauseAnimationAtEnd: z.boolean().default(true),
  concurrency: z.number().int().positive().default(4),
  outputDir: z.string().default('.diffra'),
  baselineBranch: z.string().default('origin/main'),
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
