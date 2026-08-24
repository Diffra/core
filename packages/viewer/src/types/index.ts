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

export interface TestResult {
  id: string;
  name: string;
  component: string;
  status: 'added' | 'changed' | 'removed' | 'unchanged';
  diffPercentage: number;
  diffCount: number;
  viewport: Viewport;
  baselineUrl?: string;
  candidateUrl?: string;
  diffUrl?: string;
  boundingBoxes?: BoundingBox[];
}

export interface ReportSummary {
  total: number;
  changed: number;
  added: number;
  removed: number;
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

export type ViewMode = 'overview' | 'detail';
export type DiffMode =
  | 'highlight'
  | 'split'
  | 'swipe'
  | 'onion'
  | 'mask';
export type FilterStatus =
  | 'all'
  | 'changed'
  | 'added'
  | 'removed'
  | 'unchanged';
export type ZoomLevel = '50%' | '75%' | '100%' | '150%' | '200%' | 'fit';
