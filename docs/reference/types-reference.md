# TypeScript API types reference

Core interfaces and types exported by `@diffra/core`, `@diffra/core/types`, and `@diffra/engine`.

---

## Core configuration types

```typescript
export interface DiffraConfig {
  /** Driver name or custom VisualDriver implementation */
  driver?: 'storybook' | 'url' | 'image' | 'figma' | VisualDriver;
  /** Multiple drivers to run in a single test pass */
  drivers?: (VisualDriver | string)[];

  /** Explicit in-memory target list or target provider function */
  targets?: VisualTarget[] | (() => Promise<VisualTarget[]> | VisualTarget[]);

  /** URL list for the URL driver */
  urls?: Array<string | UrlTargetConfig>;

  /** Directory for direct image comparison */
  imagesDir?: string;

  /** Figma driver configuration options */
  figma?: FigmaDriverOptions;

  /** Storybook server URL */
  storybookUrl?: string;
  storybookPort?: number;
  storybookBuildDir?: string;
  stories?: string[];

  /** Playwright multi-engine projects and device configuration */
  projects?: Project[];

  /** CI Sharding configuration (e.g. "1/4") */
  shard?: string;

  /** Global testing options */
  viewports?: ViewportInput[];
  diffThreshold?: number;
  threshold?: number;
  delay?: number;
  pauseAnimationAtEnd?: boolean;
  concurrency?: number;
  outputDir?: string;
  baselineBranch?: string;
  storage?: StorageAdapter | StorageConfig;
  notifiers?: NotifierAdapter[];
  diffEngine?: DiffEngineAdapter;
  plugins?: DiffraPlugin[];
  viewerUrl?: string;
}
```

---

## Visual target and test result types

```typescript
export interface VisualTarget {
  id: string;
  name: string;
  group?: string;
  component?: string;
  title?: string;
  url?: string;
  filePath?: string;
  selector?: string;
  mask?: (string | Locator)[];
  parameters?: {
    snapshot?: TargetParameters;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}

export interface VisualTestResult {
  id: string;
  name: string;
  group?: string;
  component: string;
  viewport: Viewport;
  browser?: string;
  colorScheme?: string;
  blobHash?: string;
  baselineBlobHash?: string;
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
```

---

## Engine diff result types

```typescript
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiffResult {
  diffCount: number;
  diffPercentage: number;
  isSameDimensions: boolean;
  width: number;
  height: number;
  boundingBoxes: BoundingBox[];
  diffImage?: Buffer;
  hasDiff: boolean;
}
```
