# TypeScript API types reference

Core interfaces and types exported by `@diffra/core`, `@diffra/core/types`, and `@diffra/engine`.

---

## Core configuration types

```typescript
export interface DiffraConfig {
  /** Domain 1: Target discovery, preview server hosting, and URL/Figma drivers */
  drivers?: DriverInput | DriverInput[];

  /** Domain 2: Universal visual capture and pixel comparison rules */
  snapshot?: SnapshotConfig;

  /** Domain 3: Browser worker pools, Playwright projects, sharding, and CI baseline branch */
  runner?: RunnerConfig;

  /** Domain 4: Baseline image and report manifest persistence */
  storage?: StorageConfig | StorageAdapter;

  /** Domain 5: PR sticky comments, status checks, and messaging notifications */
  reporters?: ReporterInput[];

  /** Lifecycle plugins and extensions */
  plugins?: DiffraPlugin[];

  /** Custom diff engine adapter */
  diffEngine?: DiffEngineAdapter;

  /** In-memory custom target provider */
  targets?: VisualTarget[] | (() => Promise<VisualTarget[]> | VisualTarget[]);
}

export interface SnapshotConfig {
  diffThreshold?: number;
  delay?: number;
  pauseAnimationAtEnd?: boolean;
  viewports?: ViewportInput[];
  selector?: string;
  mask?: (string | Locator)[];
  fullPage?: boolean;
  disable?: boolean;
  clip?: PageScreenshotOptions['clip'];
  omitBackground?: boolean;
  modes?: Record<string, SnapshotConfig>;
  screenshotOptions?: PageScreenshotOptions;
}

export interface RunnerConfig {
  concurrency?: number;
  baselineBranch?: string;
  shard?: string;
  projects?: Project[];
  launchOptions?: LaunchOptions;
}
```

---

## Visual target and test result types

```typescript
export interface VisualTarget {
  id: string;
  name: string;
  group?: string;
  url?: string;
  filePath?: string;
  snapshot?: SnapshotConfig;
  metadata?: Record<string, unknown>;
}

export interface VisualTestResult {
  id: string;
  name: string;
  group?: string;
  viewport: Viewport;
  browser?: string;
  status: 'added' | 'changed' | 'removed' | 'unchanged';
  diff?: DiffResult;
  baseline?: ImageArtifact;
  candidate: ImageArtifact;
  diffImage?: ImageArtifact;
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
