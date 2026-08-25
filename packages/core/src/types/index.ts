import type { BoundingBox, DiffOptions, DiffResult } from '@diffra/engine';
import type {
  BrowserContextOptions,
  LaunchOptions,
  Locator,
  PageScreenshotOptions,
  ViewportSize,
} from 'playwright';

// Re-export standard dependency types directly
export type {
  BoundingBox,
  DiffOptions,
  DiffResult,
  BrowserContextOptions,
  LaunchOptions,
  Locator,
  PageScreenshotOptions,
  ViewportSize,
};

// ============================================================================
// Viewport & Mode Types (reusing Playwright ViewportSize)
// ============================================================================

export type Viewport = ViewportSize & {
  name?: string;
};

export type ViewportInput =
  | number
  | ViewportSize
  | (ViewportSize & {
      name?: string;
    });

export interface Project {
  name: string;
  browser?: 'chromium' | 'firefox' | 'webkit';
  use?: BrowserContextOptions & {
    viewport?: ViewportSize;
  };
  launchOptions?: LaunchOptions;
}

// ============================================================================
// 1. Snapshot & Diffing Domain
// ============================================================================

export interface SnapshotConfig {
  /** Perceptual color delta threshold from 0.0 (strict) to 1.0 (permissive), default 0.063 */
  diffThreshold?: number;

  /** Settle wait time (ms) after component render before capture (default: 100) */
  delay?: number;

  /** Freeze CSS animations and transitions at final frame (default: true) */
  pauseAnimationAtEnd?: boolean;

  /** Default viewports matrix to capture */
  viewports?: ViewportInput[];

  /** CSS selector to isolate for snapshot */
  selector?: string;

  /** Locators or CSS selectors to mask */
  mask?: (string | Locator)[];

  /** Capture full scrollable page */
  fullPage?: boolean;

  /** Skip visual snapshot generation */
  disable?: boolean;

  /** Clipping rectangle */
  clip?: PageScreenshotOptions['clip'];

  /** Transparent background option */
  omitBackground?: boolean;

  /** Multi-mode configurations (e.g. viewports, themes) */
  modes?: Record<string, Partial<SnapshotConfig>>;

  /** Passthrough raw Playwright screenshot options */
  screenshotOptions?: PageScreenshotOptions;
}

/** Canonical Storybook parameter type (parameters.snapshot) */
export type TargetParameters = SnapshotConfig;

// ============================================================================
// 2. Target Drivers Domain
// ============================================================================

export interface UrlTargetConfig {
  url: string;
  name?: string;
  group?: string;
  snapshot?: SnapshotConfig;
}

export interface StorybookDriverConfig {
  driver: 'storybook';
  url?: string;
  buildDir?: string;
}

export interface UrlDriverConfig {
  driver: 'url';
  baseUrl?: string;
  urls: Array<string | UrlTargetConfig>;
}

export interface ImageDriverConfig {
  driver: 'image';
  dir: string;
}

export interface FigmaDriverConfig {
  driver?: 'figma';
  fileKey: string;
  personalAccessToken?: string;
  nodeIds?: string[];
  components?: Record<string, string>;
  version?: string;
  scale?: number;
  snapshot?: SnapshotConfig;
}

export type BuiltinDriverConfig =
  | StorybookDriverConfig
  | UrlDriverConfig
  | ImageDriverConfig
  | FigmaDriverConfig;

export type DriverName = 'storybook' | 'url' | 'image' | 'figma';

export type DriverInput =
  | DriverName
  | BuiltinDriverConfig
  | VisualDriver
  | string;

export interface VisualTarget {
  id: string;
  name: string;
  group?: string;
  url?: string;
  filePath?: string;
  snapshot?: SnapshotConfig;
  metadata?: Record<string, unknown>;
}

export interface DriverContext {
  config: DiffraConfig;
  cwd: string;
}

export interface DriverCaptureTask {
  target: VisualTarget;
  viewport: Viewport;
  project?: Project;
}

export interface DriverCaptureResult {
  target: VisualTarget;
  viewport: Viewport;
  buffer: Buffer;
  project?: Project;
}

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

// ============================================================================
// 3. Runner & CI Domain
// ============================================================================

export interface RunnerConfig {
  /** Number of parallel browser workers (default: 4) */
  concurrency?: number;

  /** Target Git branch for merge-base baseline discovery (default: 'origin/main') */
  baselineBranch?: string;

  /** CI shard coordinate (e.g. "1/4") */
  shard?: string;

  /** Playwright browser projects (Chromium, Firefox, WebKit, Mobile devices) */
  projects?: Project[];

  /** Playwright browser launch options */
  launchOptions?: LaunchOptions;
}

export interface GitContext {
  branch: string;
  commit: string;
  baselineBranch?: string;
  baselineCommit?: string;
  repositoryUrl?: string;
}

// ============================================================================
// 4. Storage Domain
// ============================================================================

export interface SnapshotKey {
  targetId: string;
  viewport: Viewport;
  browser?: string;
}

export type StorageConfig =
  | {
      provider: 'local';
      dir?: string;
      outputDir?: string;
    }
  | {
      provider: 's3';
      bucket: string;
      region?: string;
      prefix?: string;
      endpoint?: string;
    }
  | {
      provider: 'gcs';
      bucket: string;
      prefix?: string;
    }
  | {
      provider: 'azure';
      container: string;
      connectionString?: string;
      prefix?: string;
    };

export interface StorageAdapter {
  name: string;
  init?(): Promise<void>;
  uploadCandidate(
    runId: string,
    key: SnapshotKey,
    buffer: Buffer,
  ): Promise<string>;
  uploadDiff(
    runId: string,
    key: SnapshotKey,
    buffer: Buffer,
  ): Promise<string>;
  downloadBaseline(
    commit: string,
    key: SnapshotKey,
  ): Promise<Buffer | null>;
  uploadBaseline(
    commit: string,
    key: SnapshotKey,
    buffer: Buffer,
  ): Promise<void>;
  uploadBlob?(hash: string, buffer: Buffer): Promise<string>;
  downloadBlob?(hash: string): Promise<Buffer | null>;
  hasBlob?(hash: string): Promise<boolean>;
  saveReport(report: TestRunReport): Promise<string>;
}

// ============================================================================
// 5. Reporters & Results Domain
// ============================================================================

export type SnapshotStatus = 'unchanged' | 'changed' | 'added' | 'removed';

export interface ImageArtifact {
  path?: string;
  url?: string;
  hash?: string;
}

export interface VisualTestResult {
  id: string;
  name: string;
  group?: string;
  viewport: Viewport;
  status: SnapshotStatus;
  browser?: string;
  diff?: DiffResult;
  baseline?: ImageArtifact;
  candidate: ImageArtifact;
  diffImage?: ImageArtifact;
  metadata?: Record<string, unknown>;
}

export interface TestRunSummary {
  total: number;
  passed: number;
  changed: number;
  added: number;
  removed: number;
  unchanged: number;
}

export interface ReportLinks {
  viewer?: string;
  baselineReport?: string;
  branchLatest?: string;
}

export interface TestRunReport {
  runId: string;
  timestamp: string;
  git: GitContext;
  summary: TestRunSummary;
  links?: ReportLinks;
  results: VisualTestResult[];
}

export interface NotifierAdapter {
  name: string;
  notify(report: TestRunReport): Promise<void>;
}

export type ReporterConfig =
  | {
      type: 'github';
      token?: string;
      repo?: string;
      prNumber?: number;
      viewerUrl?: string;
    }
  | {
      type: 'slack';
      webhookUrl: string;
      channel?: string;
    }
  | {
      type: 'json';
      outputFile?: string;
    };

export type ReporterInput =
  | 'github'
  | 'slack'
  | 'json'
  | ReporterConfig
  | NotifierAdapter;

// ============================================================================
// Diff Engine & Plugins
// ============================================================================

export interface DiffEngineAdapter {
  name: string;
  compare(
    baseline: Buffer,
    candidate: Buffer,
    options?: DiffOptions,
  ): Promise<DiffResult>;
}

export interface DiffraPlugin {
  name: string;
  setup?(config: DiffraConfig): Promise<void> | void;
  onDiscoverTargets?(
    targets: VisualTarget[],
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

// ============================================================================
// Top-Level Diffra Configuration (5-Domain Architecture)
// ============================================================================

export interface DiffraConfig {
  /** 1. Target drivers & discovery (Storybook, URLs, Figma, Images) */
  drivers?: DriverInput | DriverInput[];

  /** 2. Snapshot & comparison rules (viewports, diffThreshold, delay, pauseAnimationAtEnd) */
  snapshot?: SnapshotConfig;

  /** 3. Browser & CI execution (concurrency, projects, launchOptions, shard, baselineBranch) */
  runner?: RunnerConfig;

  /** 4. Baseline & artifact persistence (local, S3, R2, GCS, Azure) */
  storage?: StorageConfig | StorageAdapter;

  /** 5. Notifications & PR reporting (GitHub, Slack, JSON) */
  reporters?: ReporterInput[];

  /** Lifecycle plugins */
  plugins?: DiffraPlugin[];

  /** Custom diff engine */
  diffEngine?: DiffEngineAdapter;

  /** Explicit in-memory targets or target provider */
  targets?: VisualTarget[] | (() => Promise<VisualTarget[]> | VisualTarget[]);
}

export function defineConfig(config: DiffraConfig): DiffraConfig {
  return config;
}
