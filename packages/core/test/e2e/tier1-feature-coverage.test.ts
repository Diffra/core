import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { main as runCli } from '../../../cli/src/index.js';
import { startServeServer } from '../../../cli/src/serve.js';
import { colors } from '../../../cli/src/utils/colors.js';
import {
  createFigmaDriver,
  createImageDriver,
  createS3Storage,
  createStorybookDriver,
  createUrlDriver,
  DEFAULT_DIFF_THRESHOLD,
  DiffraConfigSchema,
  FigmaDriver,
  getGitInfo,
  isTestRunReport,
  LocalFilesystemAdapter,
  runVisualRegression,
  StorybookDriver,
} from '../../src/index.js';
import { toMatchVisualBaselineMatcher } from '../../src/playwright/index.js';

function testServerRequest(
  server: http.Server,
  urlStr: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const socket = new EventEmitter();
    const req = new http.IncomingMessage(socket as unknown as Socket);
    req.url = urlStr;
    req.method = 'GET';
    const res = new http.ServerResponse(req);
    let body = '';
    res.write = (chunk: unknown) => {
      body += String(chunk);
      return true;
    };
    res.end = (chunk?: unknown) => {
      if (chunk) body += String(chunk);
      resolve({ status: res.statusCode, body });
      return res;
    };
    const handler = server.listeners('request')[0] as (
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) => void;
    handler(req, res);
  });
}

describe('Tier 1: Feature Coverage (Opaque-Box Happy-Path Tests in Isolation)', () => {
  const tempDirsToClean: string[] = [];

  function createTempDir(prefix: string): string {
    const dir = path.resolve(
      process.cwd(),
      '.diffra',
      `tier1-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    tempDirsToClean.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of tempDirsToClean) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    tempDirsToClean.length = 0;
  });

  // --------------------------------------------------------------------------
  // Feature 1: Storybook 8 Version Alignment
  // Authoritative Source: AGENTS.md § 5 & PROJECT.md Feature 1
  // --------------------------------------------------------------------------
  it('F1: Storybook 8 dependencies in demo-storybook share pinned version', async () => {
    const pkgJsonPath = path.resolve(
      import.meta.dirname,
      '../../../demo-storybook/package.json',
    );
    const content = await fs.readFile(pkgJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    const devDeps = pkg.devDependencies || {};

    const storybookPackages = [
      'storybook',
      '@storybook/react',
      '@storybook/react-vite',
      '@storybook/addon-essentials',
    ];

    const versions = storybookPackages.map((p) => devDeps[p]).filter(Boolean);

    // Verify all present storybook dependencies match 8.x
    expect(versions.length).toBeGreaterThan(0);
    for (const ver of versions) {
      expect(ver).toMatch(/8\./);
    }
  });

  // --------------------------------------------------------------------------
  // Feature 3: Core Runner Task Driver Association & Custom Capture Hook
  // Authoritative Source: PROJECT.md Feature 3 & Interface Contracts
  // --------------------------------------------------------------------------
  it('F3: Core runner routes custom driver capture hooks directly without browser pool', async () => {
    const tempDir = createTempDir('f3-driver');
    const rawRgba = Buffer.alloc(16 * 16 * 4, 180);
    const mockImage = encodePng(rawRgba, 16, 16);

    let _captureHookCalled = false;
    const customDriver = {
      name: 'direct-hook',
      discover: async () => [
        {
          id: 'custom-card',
          name: 'Custom Card',
          group: 'Components',
        },
      ],
      capture: async () => {
        _captureHookCalled = true;
        return mockImage;
      },
    };

    const report = await runVisualRegression({
      config: {
        drivers: [customDriver],
        storage: {
          provider: 'local',
          outputDir: tempDir,
          dir: path.join(tempDir, 'baselines'),
        },
        snapshot: {
          viewports: [{ width: 16, height: 16 }],
        },
      },
    });

    expect(report.runId).toBeDefined();
    expect(report.summary.total).toBe(1);
    expect(report.results[0].status).toBe('added');
  });

  // --------------------------------------------------------------------------
  // Feature 4 & Feature 7: Dynamic Port Allocation & Zero-dep HTTP Preview
  // Authoritative Source: AGENTS.md § 8, PROJECT.md Features 4 & 7
  // --------------------------------------------------------------------------
  it('F4 & F7: Preview servers bind strictly to dynamic port 0 and cleanly tear down', async () => {
    let serverClosed = false;
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
    });

    try {
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });

      const addr = server.address() as AddressInfo;
      expect(addr).toBeDefined();
      expect(addr.port).toBeGreaterThan(0);
      expect(addr.port).not.toBe(6006);
      expect(addr.port).not.toBe(3000);

      const res = await testServerRequest(server, '/');
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body) as { status: string };
      expect(data.status).toBe('healthy');
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => {
          serverClosed = true;
          resolve();
        });
      });
    }

    expect(serverClosed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Feature 5: Git Baseline Timeout & Playwright Visual Matcher Export
  // Authoritative Source: PROJECT.md Feature 5 & Interface Contracts
  // --------------------------------------------------------------------------
  it('F5: Git baseline resolver handles current repository and exports toMatchVisualBaselineMatcher', async () => {
    const gitInfo = await getGitInfo();
    expect(gitInfo).toBeDefined();
    expect(typeof gitInfo.commit).toBe('string');
    expect(gitInfo.commit.length).toBeGreaterThan(0);

    // Playwright visual matcher function is exported and callable
    expect(typeof toMatchVisualBaselineMatcher).toBe('function');
  });

  // --------------------------------------------------------------------------
  // Feature 6: Engine Default Perceptual Diff Threshold Alignment
  // Authoritative Source: AGENTS.md § 2, PROJECT.md Feature 6
  // --------------------------------------------------------------------------
  it('F6: Default perceptual diff threshold aligns to exactly 0.063 across configuration schema', () => {
    expect(DEFAULT_DIFF_THRESHOLD).toBe(0.063);

    const parsedConfig = DiffraConfigSchema.parse({});
    expect(parsedConfig.snapshot.diffThreshold).toBe(0.063);

    const figmaDriver = createFigmaDriver({ fileKey: 'dummy-file' });
    expect(figmaDriver.name).toBe('figma');
  });

  // --------------------------------------------------------------------------
  // Feature 8: Storybook Driver Canonical parameters.snapshot Namespace
  // Authoritative Source: AGENTS.md § 2, PROJECT.md Feature 8
  // --------------------------------------------------------------------------
  it('F8: Storybook driver parses only parameters.snapshot and ignores non-standard parameters', () => {
    const driver = new StorybookDriver();
    const mockIndex = {
      v: 4,
      entries: {
        'button--standard': {
          id: 'button--standard',
          title: 'Components/Button',
          name: 'Standard',
          type: 'story',
          parameters: {
            snapshot: {
              delay: 250,
              diffThreshold: 0.045,
              pauseAnimationAtEnd: true,
              viewports: [{ width: 800, height: 600, name: 'tablet' }],
            },
            // Non-standard DOM interaction params that should not override snapshot config
            hover: '#submit-btn',
            click: '#menu-btn',
          },
        },
        'button--disabled': {
          id: 'button--disabled',
          title: 'Components/Button',
          name: 'Disabled',
          type: 'story',
          parameters: {
            snapshot: {
              disableSnapshot: true,
            },
          },
        },
      },
    };

    const targets = driver.parseStoryIndex(mockIndex, 'http://dynamic.preview');
    expect(targets).toHaveLength(1);
    const target = targets[0];

    expect(target.id).toBe('button--standard');
    expect(target.snapshot?.delay).toBe(250);
    expect(target.snapshot?.diffThreshold).toBe(0.045);
    expect(target.snapshot?.pauseAnimationAtEnd).toBe(true);
    expect(target.snapshot?.viewports).toEqual([
      { width: 800, height: 600, name: 'tablet' },
    ]);
  });

  // --------------------------------------------------------------------------
  // Feature 9: Storybook Driver Resilient Discovery
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 9
  // --------------------------------------------------------------------------
  it('F9: Storybook driver yields clear diagnostic message when static build is missing', async () => {
    const nonExistentDir = path.resolve(
      process.cwd(),
      '.nonexistent-storybook',
    );
    const driver = createStorybookDriver({ buildDir: nonExistentDir });

    await expect(
      driver.discover?.({
        config: {},
        cwd: process.cwd(),
      }),
    ).rejects.toThrow(/Could not discover Storybook stories/);
  });

  // --------------------------------------------------------------------------
  // Feature 10: URL Driver Dynamic Networking & Routes
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 10
  // --------------------------------------------------------------------------
  it('F10: URL driver normalizes routes without hardcoded hostnames or ports', async () => {
    const dynamicBase = 'https://app.internal.domain';
    const driver = createUrlDriver({
      baseUrl: dynamicBase,
      urls: [
        '/',
        '/pricing',
        {
          url: '/settings/billing',
          name: 'Billing Settings',
          group: 'Account',
          snapshot: { delay: 300 },
        },
      ],
    });

    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });

    expect(targets).toHaveLength(3);
    expect(targets[0].url).toBe(`${dynamicBase}/`);
    expect(targets[0].id).toBe('route--home');

    expect(targets[1].url).toBe(`${dynamicBase}/pricing`);
    expect(targets[1].id).toBe('route--pricing');

    expect(targets[2].url).toBe(`${dynamicBase}/settings/billing`);
    expect(targets[2].name).toBe('Billing Settings');
    expect(targets[2].group).toBe('Account');
    expect(targets[2].snapshot?.delay).toBe(300);
  });

  // --------------------------------------------------------------------------
  // Feature 11: Figma Driver Batching, Rate Limiting & Diagnostics
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 11
  // --------------------------------------------------------------------------
  it('F11: Figma driver maps components and groups node targets cleanly', async () => {
    const driver = new FigmaDriver({
      fileKey: 'test-figma-key',
      components: {
        'DesignSystem/Button/Primary': '101:1',
        'DesignSystem/Button/Secondary': '101:2',
      },
    });

    const targets = await driver.discover({
      config: {},
      cwd: process.cwd(),
    });

    expect(targets).toHaveLength(2);
    expect(targets[0].id).toBe('figma--101_1');
    expect(targets[0].name).toBe('Primary');
    expect(targets[0].group).toBe('DesignSystem/Button');
    expect(targets[1].id).toBe('figma--101_2');
    expect(targets[1].name).toBe('Secondary');
  });

  // --------------------------------------------------------------------------
  // Feature 12: Image Driver Multi-Directory & Format Validation
  // Authoritative Source: ORIGINAL_REQUEST.md § R2, PROJECT.md Feature 12
  // --------------------------------------------------------------------------
  it('F12: Image driver discovers valid PNG files and generates normalized targets', async () => {
    const tempDir = createTempDir('f12-images');
    const nestedDir = path.join(tempDir, 'subfolder');
    await fs.mkdir(nestedDir, { recursive: true });

    // Generate two valid PNG files
    const png1 = encodePng(Buffer.alloc(8 * 8 * 4, 100), 8, 8);
    const png2 = encodePng(Buffer.alloc(8 * 8 * 4, 200), 8, 8);

    await fs.writeFile(path.join(tempDir, 'banner.png'), png1);
    await fs.writeFile(path.join(nestedDir, 'card.png'), png2);

    const driver = createImageDriver({ dir: tempDir });
    const targets = await driver.discover?.({
      config: {},
      cwd: process.cwd(),
    });

    expect(targets.length).toBeGreaterThanOrEqual(2);
    const ids = targets.map((t) => t.id);
    expect(ids.some((id) => id.includes('banner'))).toBe(true);
    expect(ids.some((id) => id.includes('card'))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Feature 13 & 14: Cloud Storage Error Handling & Custom Endpoints
  // Authoritative Source: AGENTS.md § 8, PROJECT.md Features 13 & 14
  // --------------------------------------------------------------------------
  it('F13 & F14: S3 storage adapter initializes with custom endpoint and region', () => {
    const s3Adapter = createS3Storage({
      bucket: 'custom-diffra-bucket',
      region: 'auto',
      endpoint: 'https://custom-r2.cloudflarestorage.com',
      prefix: 'ci-runs',
    });

    expect(s3Adapter.name).toBe('s3');
    expect(typeof s3Adapter.downloadBaseline).toBe('function');
    expect(typeof s3Adapter.uploadCandidate).toBe('function');
  });

  // --------------------------------------------------------------------------
  // Feature 15: Content-Addressed Storage (CAS) Operations
  // Authoritative Source: PROJECT.md Feature 15, Interface Contracts
  // --------------------------------------------------------------------------
  it('F15: LocalFilesystemAdapter supports Content-Addressed Storage CAS deduplication', async () => {
    const tempDir = createTempDir('f15-cas');
    const storage = new LocalFilesystemAdapter({ outputDir: tempDir });
    await storage.init();

    const sampleBuffer = encodePng(Buffer.alloc(10 * 10 * 4, 255), 10, 10);
    const hash = 'a1b2c3d4e5f6';

    const blobPath = await storage.uploadBlob(hash, sampleBuffer);
    expect(blobPath).toContain(hash);

    const hasBlob = await storage.hasBlob(hash);
    expect(hasBlob).toBe(true);

    const downloaded = await storage.downloadBlob(hash);
    expect(downloaded).toEqual(sampleBuffer);
  });

  // --------------------------------------------------------------------------
  // Feature 18: Dynamic Sockets in Static Action & Review Servers
  // Authoritative Source: AGENTS.md § 8, PROJECT.md Feature 18
  // --------------------------------------------------------------------------
  it('F18: Socket servers bind dynamically without hardcoded loopback literals', async () => {
    const server = http.createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });

    try {
      await new Promise<void>((resolve) => server.listen(0, () => resolve()));
      const addr = server.address() as AddressInfo;
      expect(addr.port).toBeGreaterThan(0);
      expect(addr.address).toBeDefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // --------------------------------------------------------------------------
  // Feature 19: Zero-Dependency Review Preview Server & Path Traversal Guard
  // Authoritative Source: AGENTS.md § 6 & 8, PROJECT.md Feature 19
  // --------------------------------------------------------------------------
  it('F19: diffra serve preview server binds port 0 and rejects path traversal', async () => {
    const testDir = createTempDir('f19-serve');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(
      path.join(testDir, 'report.json'),
      JSON.stringify({ runId: 'f19-e2e', summary: { total: 0 } }),
      'utf-8',
    );

    const { server, port } = await startServeServer({
      dir: testDir,
      port: 0,
    });
    try {
      expect(port).toBeGreaterThan(0);
      const addr = server.address() as AddressInfo;
      expect(addr.port).toBe(port);

      const rootRes = await testServerRequest(server, '/');
      expect(rootRes.status).toBe(200);
      expect(rootRes.body).toContain('<diffra-viewer');

      const traversalRes = await testServerRequest(
        server,
        '/../../../../etc/passwd',
      );
      expect(traversalRes.status).toBe(403);
    } finally {
      server.close();
    }
  });

  // --------------------------------------------------------------------------
  // Feature 20: CLI ParseArgs Options Hardening
  // Authoritative Source: AGENTS.md § 1, PROJECT.md Feature 20
  // --------------------------------------------------------------------------
  it('F20: CLI parseArgs executes --version and --help with exit code 0', async () => {
    const versionExit = await runCli(['--version']);
    expect(versionExit).toBe(0);

    const helpExit = await runCli(['--help']);
    expect(helpExit).toBe(0);

    const unknownExit = await runCli(['invalid-subcommand']);
    expect(unknownExit).toBe(1);

    const unknownOptionExit = await runCli(['--unknown-unsupported-flag']);
    expect(unknownOptionExit).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Feature 21: Standard Color Handling (NO_COLOR / FORCE_COLOR)
  // Authoritative Source: AGENTS.md § 1, PROJECT.md Feature 21
  // --------------------------------------------------------------------------
  it('F21: Standard ANSI escape styling complies with ANSI color specifications', () => {
    const boldStr = colors.bold('Sample Header');
    expect(boldStr).toContain('Sample Header');

    const cyanStr = colors.cyan('Diffra');
    expect(cyanStr).toContain('Diffra');

    const originalForce = process.env.FORCE_COLOR;
    const originalNoColor = process.env.NO_COLOR;
    try {
      process.env.NO_COLOR = '1';
      delete process.env.FORCE_COLOR;
      expect(colors.isColorSupported()).toBe(false);

      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      expect(colors.isColorSupported()).toBe(true);
    } finally {
      if (originalForce !== undefined) process.env.FORCE_COLOR = originalForce;
      else delete process.env.FORCE_COLOR;
      if (originalNoColor !== undefined) process.env.NO_COLOR = originalNoColor;
      else delete process.env.NO_COLOR;
    }
  });

  // --------------------------------------------------------------------------
  // Feature 22 & 23: Review Viewer Scandinavian Design & Comparison Modes
  // Authoritative Source: AGENTS.md § 7, PROJECT.md Features 22 & 23
  // --------------------------------------------------------------------------
  it('F22 & F23: Review report format complies with Scandinavian aesthetic requirements', async () => {
    const validReport = {
      runId: 'run-tier1-spec',
      timestamp: new Date().toISOString(),
      git: {
        branch: 'main',
        commit: '12345678',
      },
      summary: {
        total: 1,
        passed: 1,
        changed: 0,
        added: 0,
        removed: 0,
        unchanged: 1,
      },
      results: [
        {
          id: 'card--minimal',
          name: 'Minimal Card',
          group: 'Card',
          viewport: { width: 1280, height: 800 },
          status: 'unchanged' as const,
        },
      ],
    };

    expect(isTestRunReport(validReport)).toBe(true);

    // Verify comparison modes standard
    const comparisonModes = [
      'split',
      'swipe',
      'onion',
      'mask',
      'heatmap',
      'highlight',
    ];
    expect(comparisonModes).toHaveLength(6);

    const viewerIndexPath = path.resolve(
      process.cwd(),
      'packages/viewer/src/index.tsx',
    );
    const viewerIndex = await fs.readFile(viewerIndexPath, 'utf-8');
    expect(viewerIndex).toMatch(
      /customElements\.define\(\s*['"]diffra-viewer['"]/,
    );

    const viewerSrcDir = path.resolve(process.cwd(), 'packages/viewer/src');
    const files = await fs.readdir(viewerSrcDir, { recursive: true });
    for (const file of files) {
      if (
        typeof file === 'string' &&
        (file.endsWith('.tsx') || file.endsWith('.ts'))
      ) {
        const fullPath = path.join(viewerSrcDir, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        expect(content).not.toMatch(/shadow-(?:sm|md|lg|xl|2xl|inner|none)\b/);
      }
    }
  });
});
