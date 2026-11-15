export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type TestStatus =
  | 'added'
  | 'changed'
  | 'removed'
  | 'failed'
  | 'unchanged';

export interface TestResult {
  id: string;
  name: string;
  component: string;
  status: TestStatus;
  diffPercentage: number;
  diffCount: number;
  viewport: Viewport;
  baselineUrl?: string;
  candidateUrl?: string;
  diffUrl?: string;
  boundingBoxes?: BoundingBox[];
  /** Why the snapshot could not be produced. Set when status is failed. */
  error?: string;
  /** One sentence on what in the page caused the change, when it is known. */
  why?: string;
  /** Whether the change was declared beforehand, when intents were declared. */
  classification?: { kind: 'intended' | 'collateral'; reason: string };
}

export interface ReportSummary {
  total: number;
  changed: number;
  added: number;
  removed: number;
  failed: number;
  unchanged: number;
}

export interface TestRunReport {
  runId: string;
  timestamp: string;
  branch: string;
  commit: string;
  baselineCommit?: string;
  baselineBranch?: string;
  repositoryUrl?: string;
  baselineReportUrl?: string;
  branchLatestUrl?: string;
  summary: ReportSummary;
  results: TestResult[];
}

/** How the baseline and candidate are compared. */
export type DiffMode = 'diff' | 'split' | 'slide' | 'fade';

export type ZoomLevel = 'fit' | '100%' | '200%' | '400%';
