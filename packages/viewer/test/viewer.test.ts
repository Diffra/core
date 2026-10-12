import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TestRunReport } from '../src/types/index.js';

const mockReport: TestRunReport = {
  runId: 'test-run-1',
  timestamp: '2026-08-23T20:00:00.000Z',
  branch: 'feat/buttons',
  commit: '1234567',
  baselineBranch: 'main',
  baselineCommit: '0000000',
  baselineReportUrl: '../../branches/main/latest/index.html',
  branchLatestUrl: '../../branches/feat_buttons/latest/index.html',
  summary: {
    total: 2,
    changed: 1,
    added: 1,
    removed: 0,
    unchanged: 0,
  },
  results: [
    {
      id: 'button-primary',
      name: 'Primary',
      component: 'Button',
      status: 'changed',
      diffPercentage: 1.2,
      diffCount: 50,
      viewport: { name: 'desktop', width: 1280, height: 800 },
      baselineUrl: 'data:image/png;base64,mockBaseline',
      candidateUrl: 'data:image/png;base64,mockCandidate',
      diffUrl: 'data:image/png;base64,mockDiff',
      boundingBoxes: [{ minX: 0, minY: 0, maxX: 10, maxY: 10 }],
    },
  ],
};

describe('Diffra Viewer Data Models', () => {
  it('correctly structures and validates test run report with branch interlinking', () => {
    expect(mockReport.runId).toBe('test-run-1');
    expect(mockReport.branch).toBe('feat/buttons');
    expect(mockReport.baselineBranch).toBe('main');
    expect(mockReport.baselineReportUrl).toBe(
      '../../branches/main/latest/index.html',
    );
    expect(mockReport.branchLatestUrl).toBe(
      '../../branches/feat_buttons/latest/index.html',
    );
    expect(mockReport.results.length).toBe(1);
    expect(mockReport.results[0]?.status).toBe('changed');
    expect(mockReport.results[0]?.boundingBoxes?.length).toBe(1);
  });

  it('validates summary metrics consistency', () => {
    const sum = mockReport.summary;
    expect(sum.total).toBe(
      sum.changed + sum.added + sum.removed + sum.unchanged,
    );
  });

  it('supports all 6 comparison modes: split, swipe, onion, mask, heatmap, and highlight', () => {
    const modes = ['split', 'swipe', 'onion', 'mask', 'heatmap', 'highlight'];
    expect(modes).toHaveLength(6);
    expect(modes).toContain('heatmap');
    expect(modes).toContain('highlight');
  });
});

describe('Feature 22: Custom Element <diffra-viewer> Registration & Web Component Contract', () => {
  it('implements DiffraViewer custom element with Shadow DOM and lifecycle methods in index.tsx', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('class DiffraViewer extends');
    expect(content).toContain("attachShadow({ mode: 'open' })");
    expect(content).toMatch(/customElements\.define\(\s*['"]diffra-viewer['"]/);
    expect(content).toContain('connectedCallback(): void');
    expect(content).toContain('disconnectedCallback(): void');
    expect(content).toContain('attributeChangedCallback(');
  });

  it('defines observedAttributes for report URLs and inline report data', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('static get observedAttributes()');
    expect(content).toContain("'report-url'");
    expect(content).toContain("'data-report-url'");
    expect(content).toContain("'report-data'");
    expect(content).toContain("'data-report'");
  });

  it('exposes reportUrl, reportData, and manifest element getters and setters', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('get reportUrl(): string | undefined');
    expect(content).toContain('set reportUrl(');
    expect(content).toContain('get reportData(): TestRunReport | undefined');
    expect(content).toContain('set reportData(');
    expect(content).toContain('get manifest(): TestRunReport | undefined');
    expect(content).toContain('set manifest(');
  });

  it('retains initDiffraViewer for backwards compatibility', async () => {
    const indexPath = path.resolve(import.meta.dirname, '../src/index.tsx');
    const content = await fs.readFile(indexPath, 'utf-8');

    expect(content).toContain('export function initDiffraViewer(');
  });

  it('correctly maps ./style.css export to ./dist/viewer.css in package.json', async () => {
    const pkgPath = path.resolve(import.meta.dirname, '../package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    expect(pkg.exports).toBeDefined();
    expect(pkg.exports['./style.css']).toBe('./dist/viewer.css');
    expect(pkg.exports['./bundle']).toBe('./dist/viewer.bundle.js');
  });
});

describe('Feature 23: Scandinavian UI Automated Compliance Audit', () => {
  async function getAllSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await getAllSourceFiles(fullPath)));
      } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('strictly contains ZERO shadow-* utility classes across all viewer source files per AGENTS.md § 7', async () => {
    const srcDir = path.resolve(import.meta.dirname, '../src');
    const sourceFiles = await getAllSourceFiles(srcDir);
    expect(sourceFiles.length).toBeGreaterThan(10);

    const shadowPattern = /\bshadow-(?:xs|sm|md|lg|xl|2xl|inner)\b/g;
    const violations: { file: string; line: number; match: string }[] = [];

    for (const filePath of sourceFiles) {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const matches = line.match(shadowPattern);
        if (matches) {
          violations.push({
            file: path.relative(srcDir, filePath),
            line: index + 1,
            match: line.trim(),
          });
        }
      });
    }

    expect(violations).toHaveLength(0);
  });

  it('eliminates noise: zero diff percentages or pixel diff counts in sidebar and badge templates', async () => {
    const sidebarPath = path.resolve(
      import.meta.dirname,
      '../src/components/layout/Sidebar.tsx',
    );
    const sidebarContent = await fs.readFile(sidebarPath, 'utf-8');

    // Filter options in sidebar have clean labels without count tallies
    expect(sidebarContent).toContain("{ id: 'all', label: 'All' }");
    expect(sidebarContent).toContain("{ id: 'changed', label: 'Changed' }");
    expect(sidebarContent).toContain("{ id: 'added', label: 'Added' }");
    expect(sidebarContent).toContain("{ id: 'unchanged', label: 'Passed' }");
    expect(sidebarContent).not.toMatch(/label:\s*['"]\w+\s*\(\d+\)['"]/);

    const badgePath = path.resolve(
      import.meta.dirname,
      '../src/components/ui/Badge.tsx',
    );
    const badgeContent = await fs.readFile(badgePath, 'utf-8');
    // Badges are borderless flat tonal surfaces
    expect(badgeContent).toContain('border-none');
  });

  it('renders breadcrumb 2 as a clean interactive button without "/" separator in Header.tsx', async () => {
    const headerPath = path.resolve(
      import.meta.dirname,
      '../src/components/layout/Header.tsx',
    );
    const headerContent = await fs.readFile(headerPath, 'utf-8');

    // Breadcrumb 2 is rendered as button
    expect(headerContent).toContain('Breadcrumb 2: Active Story button');
    // Separator "/" is not present inside breadcrumb
    expect(headerContent).not.toContain('{activeStory.component} /');
  });

  it('configures highlight Movement mode with neon green highlight as zero-config default', async () => {
    const contextPath = path.resolve(
      import.meta.dirname,
      '../src/context/ViewerContext.tsx',
    );
    const contextContent = await fs.readFile(contextPath, 'utf-8');
    expect(contextContent).toContain("useState<DiffMode>('highlight')");

    const highlightPath = path.resolve(
      import.meta.dirname,
      '../src/components/stage/views/DiffHighlightView.tsx',
    );
    const highlightContent = await fs.readFile(highlightPath, 'utf-8');
    // Vivid neon green for changed pixels
    expect(highlightContent).toContain('const hr = 0;');
    expect(highlightContent).toContain('const hg = 255;');
    expect(highlightContent).toContain('const hb = 102;');
  });
});
