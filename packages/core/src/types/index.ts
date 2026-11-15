import type { BoundingBox, DiffOptions, DiffResult } from '@diffra/engine';
import type {
  BrowserContextOptions,
  LaunchOptions,
  Locator,
  PageScreenshotOptions,
  ViewportSize,
} from 'playwright';
import type { Classification, Intent } from '../intent/index.js';
import type { ApprovalPolicy } from '../intent/policy.js';
import type { Explanation } from '../pipeline/explain.js';
import type { Gate } from '../report/gate.js';

// Re-export standard dependency types directly
export type {
  BoundingBox,
  BrowserContextOptions,
  DiffOptions,
  DiffResult,
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
  disableSnapshot?: boolean;

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
  headers?: Record<string, string>;
  auth?: { username: string; password?: string };
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
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
  headers?: Record<string, string>;
  auth?: { username: string; password?: string };
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
}

export interface ImageDriverConfig {
  driver: 'image';
  dir?: string | string[];
  dirs?: string[];
  glob?: string | string[];
  patterns?: string | string[];
  validateFormat?: boolean;
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
  endpoint?: string;
  baseUrl?: string;
  maxRetries?: number;
  maxCacheEntries?: number;
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

/**
 * What a browser needs to load a target: headers, credentials and cookies.
 * Kept apart from `metadata` because it is secret: it is applied to the page
 * and never copied into a result or a report.
 */
export interface TargetRequest {
  headers?: Record<string, string>;
  auth?: { username: string; password?: string };
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
}

export interface VisualTarget {
  id: string;
  name: string;
  group?: string;
  url?: string;
  /** Source file that defines the target, such as a story file. */
  filePath?: string;
  snapshot?: SnapshotConfig;
  /** Never written to reports. */
  request?: TargetRequest;
  /** Public, descriptive data that is copied into the report. */
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

  /** Capture attempts per target before it is reported as failed (default: 2) */
  captureAttempts?: number;

  /** Download missing Playwright browsers before capturing (default: false) */
  installBrowsers?: boolean;

  /** Target Git branch for merge-base baseline discovery (default: 'origin/main') */
  baselineBranch?: string;

  /** How many first-parent commits to search for a stored baseline (default: 10) */
  baselineHistoryDepth?: number;

  /** CI shard coordinate (e.g. "1/4") */
  shard?: string;

  /** Case-insensitive text that a target id, name or group must contain to be captured */
  filter?: string;

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
  uploadDiff(runId: string, key: SnapshotKey, buffer: Buffer): Promise<string>;
  /** Reads back a candidate previously stored by uploadCandidate for a run. */
  downloadCandidate(runId: string, key: SnapshotKey): Promise<Buffer | null>;
  downloadBaseline(commit: string, key: SnapshotKey): Promise<Buffer | null>;
  uploadBaseline(
    commit: string,
    key: SnapshotKey,
    buffer: Buffer,
  ): Promise<void>;
  /**
   * Lists the snapshots promoted as the baseline of a commit. Optional: when
   * an adapter provides it, snapshots that disappear are reported as removed.
   */
  downloadBaselineKeys?(commit: string): Promise<SnapshotKey[] | null>;
  uploadBaselineKeys?(commit: string, keys: SnapshotKey[]): Promise<void>;
  uploadBlob?(hash: string, buffer: Buffer): Promise<string>;
  downloadBlob?(hash: string): Promise<Buffer | null>;
  hasBlob?(hash: string): Promise<boolean>;
  /**
   * Named JSON documents, such as the render ledger of an image. A name is a
   * single plain file name. Optional: a store without them keeps no ledgers.
   */
  uploadDocument?(name: string, content: Buffer): Promise<void>;
  downloadDocument?(name: string): Promise<Buffer | null>;
  hasDocument?(name: string): Promise<boolean>;
  saveReport(report: TestRunReport): Promise<string>;
}

// ============================================================================
// 5. Reporters & Results Domain
// ============================================================================

export type SnapshotStatus =
  | 'unchanged'
  | 'changed'
  | 'added'
  | 'removed'
  | 'failed';

export interface ImageArtifact {
  path?: string;
  url?: string;
  hash?: string;
}

/** Where a snapshot's render ledgers are in the review bundle, relative to it. */
export interface ResultLedgers {
  baseline?: string;
  candidate?: string;
}

export interface VisualTestResult {
  id: string;
  name: string;
  group?: string;
  viewport: Viewport;
  status: SnapshotStatus;
  browser?: string;
  /** Source file that defines the snapshot, such as a story file. */
  filePath?: string;
  diff?: DiffResult;
  baseline?: ImageArtifact;
  candidate: ImageArtifact;
  diffImage?: ImageArtifact;
  /** What was on the page for the baseline and the candidate, when it was recorded. */
  ledgers?: ResultLedgers;
  /** What in the page accounts for the change, when both ledgers were recorded. */
  explanation?: Explanation;
  /** Whether the change was declared beforehand. Set only when intents were declared. */
  classification?: Classification;
  /** Why the snapshot could not be produced, set when status is failed. */
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TestRunSummary {
  total: number;
  passed: number;
  changed: number;
  added: number;
  removed: number;
  failed: number;
  unchanged: number;
  /** Changes that a declared intent covers. Present only when intents were declared. */
  intended?: number;
  /** Changes that no declared intent covers. Present only when intents were declared. */
  collateral?: number;
}

export interface ReportLinks {
  /** Hosted address of the review bundle, when reportBaseUrl is configured */
  review?: string;
  baselineReport?: string;
  branchLatest?: string;
}

export interface TestRunReport {
  /** Version of this report's shape, see REPORT_SCHEMA_VERSION */
  schemaVersion?: number;
  runId: string;
  timestamp: string;
  /** Set when the run covered only one shard of the targets, for example "1/4" */
  shard?: string;
  /** Set when the run covered only the targets that matched this filter */
  filter?: string;
  /** What this run fails on, see AgentConfig.gate */
  gate?: Gate;
  /** The intents the changes were judged against */
  intents?: Intent[];
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

/** Settings for the context that lets agents and reviewers understand a change. */
export interface AgentConfig {
  /**
   * Record what was on the page, such as elements, styles and the stylesheet
   * rules behind them, with every browser snapshot (default: true).
   */
  context?: boolean;

  /** Where declared intents are kept, relative to the project (default: .diffra/intent.json). */
  intentFile?: string;

  /**
   * What fails a run: every changed snapshot (`any`, the default), or only
   * those that no declared intent covers (`collateral`).
   */
  gate?: Gate;

  /**
   * What an agent may approve without a person (default: `intended`).
   * `never`: nothing, a person must run `diffra approve`.
   * `intended`: changes that a declared intent covers.
   * `proven`: intended changes whose cause was proven by undoing it.
   * `any`: every change.
   */
  autoApprove?: ApprovalPolicy;
}

export interface DiffraConfig {
  /** 1. Target drivers & discovery (Storybook, URLs, Figma, Images) */
  drivers?: DriverInput | DriverInput[];

  /** 2. Snapshot & comparison rules (viewports, diffThreshold, delay, pauseAnimationAtEnd) */
  snapshot?: SnapshotConfig;

  /** 3. Browser & CI execution (concurrency, projects, launchOptions, shard, baselineBranch) */
  runner?: RunnerConfig;

  /** 4. Baseline & artifact persistence (local, S3, R2, GCS, Azure) */
  storage?: StorageConfig | StorageAdapter;

  /** Context recorded for agents and reviewers */
  agent?: AgentConfig;

  /** 5. Notifications & PR reporting (GitHub, Slack, JSON) */
  reporters?: ReporterInput[];

  /** Lifecycle plugins */
  plugins?: DiffraPlugin[];

  /** Custom diff engine */
  diffEngine?: DiffEngineAdapter;

  /** Explicit in-memory targets or target provider */
  targets?: VisualTarget[] | (() => Promise<VisualTarget[]> | VisualTarget[]);

  /** Public URL under which the output directory is published (see docs/architecture/review-bundle.md) */
  reportBaseUrl?: string;
}

export function defineConfig(config: DiffraConfig): DiffraConfig {
  return config;
}
