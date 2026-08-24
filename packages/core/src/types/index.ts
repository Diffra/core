import type { BoundingBox, DiffOptions, DiffResult } from '@diffra/diff';

export type { BoundingBox, DiffOptions, DiffResult };

export type ViewportInput =
  | number
  | {
      name?: string;
      width: number;
      height: number;
    };

export interface Viewport {
  name?: string;
  width: number;
  height: number;
}

export interface SnapshotModeConfig {
  viewport?: number | { width: number; height?: number };
  theme?: string;
  [key: string]: unknown;
}

export interface TargetParameters {
  /** Skip taking visual snapshots for this target */
  disable?: boolean;
  /** Alias for disable */
  disableSnapshot?: boolean;
  /** Perceptual color threshold from 0.0 (strict) to 1.0 (permissive), default 0.063 */
  diffThreshold?: number;
  /** Alias for diffThreshold */
  threshold?: number;
  /** Milliseconds to wait after render/navigation before taking screenshot */
  delay?: number;
  /** Pause CSS animations and transitions at their final frame (default true) */
  pauseAnimationAtEnd?: boolean;
  /** Multi-mode configurations (e.g. viewports, themes) */
  modes?: Record<string, SnapshotModeConfig>;
  /** Specific viewport widths or objects to capture */
  viewports?: ViewportInput[];
  /** Optional CSS selector to isolate for screenshot */
  selector?: string;
}

/** Legacy alias for TargetParameters */
export type SnapshotStoryParameters = TargetParameters;

/**
 * Normalized visual target representing any testable UI unit (story, web route, modal state, static image).
 */
export interface VisualTarget {
  id: string;
  name: string;
  group?: string;
  component?: string;
  title?: string;
  url?: string;
  filePath?: string;
  selector?: string;
  parameters?: {
    snapshot?: TargetParameters;
    visual?: TargetParameters;
    diffra?: TargetParameters;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}

/** Legacy alias for StoryMetadata */
export type StoryMetadata = VisualTarget;

export interface VisualTestResult {
  id: string;
  name: string;
  group?: string;
  component: string;
  viewport: Viewport;
  status: 'changed' | 'added' | 'removed' | 'unchanged';
  diffResult?: DiffResult;
  baselinePath?: string;
  candidatePath?: string;
  diffPath?: string;
  baselineUrl?: string;
  candidateUrl?: string;
  diffUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Legacy alias for StoryTestResult */
export type StoryTestResult = VisualTestResult;

export interface TestRunReport {
  runId: string;
  timestamp: string;
  branch: string;
  commit: string;
  baselineCommit?: string;
  baselineBranch?: string;
  baselineReportUrl?: string;
  branchLatestUrl?: string;
  summary: {
    total: number;
    changed: number;
    added: number;
    removed: number;
    unchanged: number;
  };
  results: VisualTestResult[];
}

/**
 * Storage adapter interface for baseline and candidate screenshot persistence.
 */
export interface StorageAdapter {
  name: string;
  init?(): Promise<void>;
  uploadCandidate(
    runId: string,
    targetId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
  ): Promise<string>;
  uploadDiff(
    runId: string,
    targetId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
  ): Promise<string>;
  downloadBaseline(
    baselineCommit: string,
    targetId: string,
    viewport: Viewport,
  ): Promise<Buffer | null>;
  uploadBaseline(
    commitSha: string,
    targetId: string,
    viewport: Viewport,
    imageBuffer: Buffer,
  ): Promise<void>;
  saveReport(report: TestRunReport): Promise<string>;
}

/**
 * Notifier adapter interface for posting CI and status summaries.
 */
export interface NotifierAdapter {
  name: string;
  notify(report: TestRunReport): Promise<void>;
}

/**
 * Diff engine interface for perceptual comparison.
 */
export interface DiffEngineAdapter {
  name: string;
  compare(
    baseline: Buffer,
    candidate: Buffer,
    options?: DiffOptions,
  ): Promise<DiffResult>;
}

/**
 * Context provided to visual drivers during setup, discovery, and capture.
 */
export interface DriverContext {
  config: DiffraConfig;
  cwd: string;
}

export interface DriverCaptureTask {
  target: VisualTarget;
  viewport: Viewport;
}

export interface DriverCaptureResult {
  target: VisualTarget;
  viewport: Viewport;
  buffer: Buffer;
}

/**
 * Unified driver interface for pluggable target discovery and screenshot capture.
 */
export interface VisualDriver {
  name: string;
  setup?(context: DriverContext): Promise<void> | void;
  discover?(context: DriverContext): Promise<VisualTarget[]> | VisualTarget[];
  capture?(
    task: DriverCaptureTask,
    context: DriverContext,
  ): Promise<Buffer | null>;
  captureAll?(
    tasks: DriverCaptureTask[],
    context: DriverContext,
  ): Promise<DriverCaptureResult[]>;
  teardown?(context: DriverContext): Promise<void> | void;
}

/**
 * Unified plugin interface for extending visual testing lifecycle.
 */
export interface DiffraPlugin {
  name: string;
  setup?(config: DiffraConfig): Promise<void> | void;
  onDiscoverStories?(
    stories: VisualTarget[],
  ): Promise<VisualTarget[]> | VisualTarget[];
  onBeforeCapture?(
    target: VisualTarget,
    viewport: Viewport,
  ): Promise<void> | void;
  onAfterCapture?(
    target: VisualTarget,
    viewport: Viewport,
    buffer: Buffer,
  ): Promise<Buffer> | Buffer;
  onTestComplete?(report: TestRunReport): Promise<void> | void;
}

export interface UrlTargetConfig {
  id?: string;
  name?: string;
  group?: string;
  url: string;
  selector?: string;
  delay?: number;
  diffThreshold?: number;
  viewports?: ViewportInput[];
}

export interface DiffraConfig {
  /** Driver name ('storybook', 'url', 'image') or custom VisualDriver implementation */
  driver?: 'storybook' | 'url' | 'image' | VisualDriver;
  /** Multiple drivers to run in a single test pass */
  drivers?: (VisualDriver | string)[];

  /** Explicit in-memory target list or target provider function */
  targets?: VisualTarget[] | (() => Promise<VisualTarget[]> | VisualTarget[]);

  /** URL list for the generic URL driver */
  urls?: Array<string | UrlTargetConfig>;

  /** Directory for direct image/screenshot comparison (ImageDriver) */
  imagesDir?: string;

  /** Storybook configuration */
  storybookUrl?: string;
  storybookPort?: number;
  storybookBuildDir?: string;
  stories?: string[];

  /** Global testing options */
  viewports?: ViewportInput[];
  diffThreshold?: number;
  threshold?: number;
  delay?: number;
  pauseAnimationAtEnd?: boolean;
  concurrency?: number;
  outputDir?: string;
  baselineBranch?: string;
  storage?:
    | StorageAdapter
    | {
        type: 'local' | 's3' | 'gcs' | 'azure';
        local?: {
          baselineDir?: string;
        };
        s3?: {
          bucket: string;
          region?: string;
          prefix?: string;
          endpoint?: string;
        };
        gcs?: {
          bucket: string;
          prefix?: string;
        };
        azure?: {
          container: string;
          connectionString?: string;
          prefix?: string;
        };
      };
  notifiers?: NotifierAdapter[];
  diffEngine?: DiffEngineAdapter;
  plugins?: DiffraPlugin[];
  notifier?: {
    github?: {
      token?: string;
      repo?: string;
      prNumber?: number;
    };
  };
}

export function defineConfig(config: DiffraConfig): DiffraConfig {
  return config;
}
