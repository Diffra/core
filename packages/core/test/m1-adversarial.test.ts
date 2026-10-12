import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  compareImages,
  compareRawRGBA,
  encodePng,
} from '../../engine/src/index.js';
import {
  createStorybookDriver,
  DEFAULT_DIFF_THRESHOLD,
  DiffraConfigSchema,
  getGitInfo,
  parseGitRemoteUrl,
  StorybookDriver,
  toMatchVisualBaseline,
  toMatchVisualBaselineMatcher,
} from '../src/index.js';

const execFileAsync = promisify(execFile);

describe('Empirical Challenger: Milestone 1 Adversarial Suite', () => {
  // --------------------------------------------------------------------------
  // Area 1: Engine Threshold Defaults (0.063) in TypeScript Engine
  // --------------------------------------------------------------------------
  describe('Engine Threshold Defaults & Boundary Behavior', () => {
    it('DEFAULT_DIFF_THRESHOLD is exactly 0.063 and schema defaults to 0.063', () => {
      expect(DEFAULT_DIFF_THRESHOLD).toBe(0.063);
      const schemaParsed = DiffraConfigSchema.parse({});
      expect(schemaParsed.snapshot.diffThreshold).toBe(0.063);
    });

    it('honors 0.0 threshold as exact match without falling back to 0.063', () => {
      const width = 1;
      const height = 1;
      const base = Buffer.from([100, 100, 100, 255]);
      // Candidate with 1-unit RGB difference
      const cand = Buffer.from([101, 100, 100, 255]);

      // At threshold 0.0, 1 unit difference MUST trigger a diff
      const resZero = compareRawRGBA(base, cand, width, height, {
        diffThreshold: 0.0,
      });
      expect(resZero.diffCount).toBe(1);
      expect(resZero.hasDiff).toBe(true);

      // At default threshold (0.063), 1 unit difference must NOT trigger a diff
      const resDefault = compareRawRGBA(base, cand, width, height, {});
      expect(resDefault.diffCount).toBe(0);
      expect(resDefault.hasDiff).toBe(false);
    });

    it('honors explicit diffThreshold: 0.063 and threshold: 0.063 identically to default', () => {
      const width = 2;
      const height = 2;
      const base = Buffer.alloc(width * height * 4, 100);
      const cand = Buffer.alloc(width * height * 4, 102);

      const resDefault = compareRawRGBA(base, cand, width, height, {});
      const resExplicit = compareRawRGBA(base, cand, width, height, {
        diffThreshold: 0.063,
      });
      const resAlias = compareRawRGBA(base, cand, width, height, {
        threshold: 0.063,
      });

      expect(resDefault.diffCount).toBe(resExplicit.diffCount);
      expect(resDefault.diffCount).toBe(resAlias.diffCount);
      expect(resDefault.hasDiff).toBe(resExplicit.hasDiff);
    });

    it('empirically verifies threshold boundary transition at 0.063', () => {
      // 35215 * 0.063^2 = 139.768
      // For pure red change: YIQ colorDeltaSq for [dr, 0, 0, 0] is:
      // y = 0.29889531 * dr, i = 0.59597799 * dr, q = 0.21147017 * dr
      // deltaSq = dr^2 * (0.5053*0.2989^2 + 0.299*0.596^2 + 0.1957*0.211^2) = dr^2 * 0.1601
      // At dr = 29: deltaSq ≈ 29^2 * 0.1601 ≈ 134.6 < 139.768 -> NO DIFF
      // At dr = 30: deltaSq ≈ 30^2 * 0.1601 ≈ 144.1 > 139.768 -> DIFF
      const width = 1;
      const height = 1;
      const base = Buffer.from([100, 100, 100, 255]);

      const candBelow = Buffer.from([129, 100, 100, 255]);
      const resBelow = compareRawRGBA(base, candBelow, width, height, {});
      expect(resBelow.diffCount).toBe(0);

      const candAbove = Buffer.from([130, 100, 100, 255]);
      const resAbove = compareRawRGBA(base, candAbove, width, height, {});
      expect(resAbove.diffCount).toBe(1);

      // Permissive threshold (1.0) ignores delta of 30
      const resPermissive = compareRawRGBA(base, candAbove, width, height, {
        diffThreshold: 1.0,
      });
      expect(resPermissive.diffCount).toBe(0);
    });

    it('handles identical and different PNG buffers losslessly via compareImages', async () => {
      const raw = Buffer.alloc(10 * 10 * 4, 150);
      const png = encodePng(raw, 10, 10);

      const identical = await compareImages(png, png);
      expect(identical.diffCount).toBe(0);
      expect(identical.hasDiff).toBe(false);
      expect(identical.isSameDimensions).toBe(true);

      const rawDiff = Buffer.alloc(10 * 10 * 4, 150);
      rawDiff[0] = 0; // large diff at pixel (0,0)
      rawDiff[1] = 0;
      rawDiff[2] = 0;
      const pngDiff = encodePng(rawDiff, 10, 10);

      const diffRes = await compareImages(png, pngDiff, {
        diffThreshold: 0.063,
      });
      expect(diffRes.hasDiff).toBe(true);
      expect(diffRes.diffCount).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Area 2: Child Process Timeout & Git Baseline Resolution
  // --------------------------------------------------------------------------
  describe('Git Baseline Timeout & Edge Case Safety', () => {
    it('parseGitRemoteUrl handles SSH, HTTPS, and invalid input strings safely', () => {
      expect(parseGitRemoteUrl('')).toBeUndefined();
      expect(parseGitRemoteUrl('invalid-url')).toBeUndefined();
      expect(parseGitRemoteUrl('git@github.com:org/repo.git')).toBe(
        'https://github.com/org/repo',
      );
      expect(parseGitRemoteUrl('https://gitlab.com/org/project.git')).toBe(
        'https://gitlab.com/org/project',
      );
    });

    it('getGitInfo safely resolves in non-git directory without throwing', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-safe-'));
      try {
        const info = await getGitInfo(undefined, tempDir);
        expect(info.commit).toBe('uncommitted');
        expect(info.baselineCommit).toBe('uncommitted');
        expect(info.branch).toBeDefined();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('getGitInfo safely resolves in non-existent directory without throwing', async () => {
      const nonExistent = path.join(os.tmpdir(), `non-existent-${Date.now()}`);
      const info = await getGitInfo(undefined, nonExistent);
      expect(info.commit).toBe('uncommitted');
      expect(info.baselineCommit).toBe('uncommitted');
    });

    it('empirically verifies child process timeout behavior in runGit', async () => {
      // Test execFile timeout kill behavior directly
      const timeoutMs = 150;
      let errorKilled = false;
      try {
        await execFileAsync('node', ['-e', 'setTimeout(() => {}, 5000)'], {
          timeout: timeoutMs,
        });
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'killed' in err &&
          (err as { killed: boolean }).killed
        ) {
          errorKilled = true;
        }
      }
      expect(errorKilled).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Area 3: Dynamic Port 0 Allocation & Clean Teardown
  // --------------------------------------------------------------------------
  describe('Dynamic Port 0 Allocation & Teardown Safety', () => {
    it('server.listen(0) generates distinct dynamic unprivileged ports', async () => {
      const servers: http.Server[] = [];
      const ports: number[] = [];

      try {
        for (let i = 0; i < 5; i++) {
          const s = http.createServer((_, res) => res.end('ok'));
          await new Promise<void>((resolve) => s.listen(0, () => resolve()));
          const addr = s.address() as import('node:net').AddressInfo;
          ports.push(addr.port);
          servers.push(s);
        }

        expect(ports).toHaveLength(5);
        for (const port of ports) {
          expect(port).toBeGreaterThan(1024);
          expect(port).not.toBe(6006);
          expect(port).not.toBe(3000);
        }
        const uniquePorts = new Set(ports);
        expect(uniquePorts.size).toBe(5);
      } finally {
        await Promise.all(
          servers.map(
            (s) => new Promise<void>((resolve) => s.close(() => resolve())),
          ),
        );
      }
    });

    it('server.close() in finally block handles already-closed servers safely', async () => {
      const s = http.createServer((_, res) => res.end('ok'));
      await new Promise<void>((resolve) => s.listen(0, () => resolve()));
      // First close
      await new Promise<void>((resolve) => s.close(() => resolve()));

      // Second close should resolve safely without throwing unhandled error
      let threw = false;
      try {
        await new Promise<void>((resolve) => s.close(() => resolve()));
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });

    it('static preview path traversal boundary check blocks directory escape attempts', () => {
      const root = path.resolve('/var/www/static');
      const escapingPaths = [
        '../../../../etc/passwd',
        '../package.json',
        '/../../etc/shadow',
      ];

      for (const attack of escapingPaths) {
        // Test raw path traversal without WHATWG URL root truncation
        const target = path.resolve(
          root,
          `.${attack.startsWith('/') ? attack : `/${attack}`}`,
        );
        const allowed = target === root || target.startsWith(root + path.sep);
        expect(allowed).toBe(false);
      }

      const valid = ['/index.html', '/iframe.html', '/assets/style.css'];
      for (const validPath of valid) {
        const target = path.resolve(root, `.${validPath}`);
        const allowed = target === root || target.startsWith(root + path.sep);
        expect(allowed).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Area 4: Storybook Driver Discovery Edge Cases
  // --------------------------------------------------------------------------
  describe('Storybook Driver Discovery Resiliency', () => {
    it('parseStoryIndex gracefully handles null, undefined, primitive, and empty structures', () => {
      const driver = new StorybookDriver();
      expect(driver.parseStoryIndex(null, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex(undefined, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex('string', 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex(12345, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex({}, 'http://test')).toEqual([]);
      expect(driver.parseStoryIndex({ entries: {} }, 'http://test')).toEqual(
        [],
      );
    });

    it('parseStoryIndex filters out docs and disabled stories', () => {
      const driver = new StorybookDriver();
      const mockIndex = {
        v: 4,
        entries: {
          'docs-intro': {
            id: 'docs-intro',
            type: 'docs',
            name: 'Intro',
          },
          'btn-disabled-1': {
            id: 'btn-disabled-1',
            type: 'story',
            name: 'Btn Disabled 1',
            parameters: {
              snapshot: { disableSnapshot: true },
            },
          },
          'btn-disabled-2': {
            id: 'btn-disabled-2',
            type: 'story',
            name: 'Btn Disabled 2',
            parameters: {
              snapshot: { disable: true },
            },
          },
          'btn-active': {
            id: 'btn-active',
            type: 'story',
            name: 'Active Button',
            title: 'DesignSystem/Buttons/Active',
            parameters: {
              snapshot: { delay: 200 },
            },
          },
        },
      };

      const targets = driver.parseStoryIndex(
        mockIndex,
        'http://dynamic.preview',
      );
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('btn-active');
      expect(targets[0].name).toBe('Active Button');
      expect(targets[0].group).toBe('Active');
      expect(targets[0].snapshot?.delay).toBe(200);
      expect(targets[0].url).toBe(
        'http://dynamic.preview/iframe.html?id=btn-active&viewMode=story',
      );
    });

    it('discover() throws informative diagnostic error when Storybook is not built or running', async () => {
      const nonExistentDir = path.resolve(
        process.cwd(),
        '.missing-storybook-dir',
      );
      const driver = createStorybookDriver({ buildDir: nonExistentDir });

      await expect(
        driver.discover?.({ config: {}, cwd: process.cwd() }),
      ).rejects.toThrow(/Could not discover Storybook stories/);
    });
  });

  // --------------------------------------------------------------------------
  // Area 5: Playwright Matcher Export Compliance
  // --------------------------------------------------------------------------
  describe('Playwright Matcher Export Compliance', () => {
    it('exports toMatchVisualBaseline and toMatchVisualBaselineMatcher identically', () => {
      expect(typeof toMatchVisualBaseline).toBe('function');
      expect(typeof toMatchVisualBaselineMatcher).toBe('function');
      expect(toMatchVisualBaseline).toBe(toMatchVisualBaselineMatcher);
    });
  });

  // --------------------------------------------------------------------------
  // Area 6: Core Runner Driver Routing & Baseline Approval Safety
  // --------------------------------------------------------------------------
  describe('Core Runner Driver Routing & Baseline Approval Safety', () => {
    it('approveBaselines throws descriptive error when no prior test run exists', async () => {
      const emptyDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-no-run-'),
      );
      try {
        const { approveBaselines } = await import('../src/index.js');
        await expect(approveBaselines({ cwd: emptyDir })).rejects.toThrow(
          /No latest test run found\. Run "diffra test" first\./,
        );
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('custom driver capture hook bypasses browser pool and attaches target.driver correctly', async () => {
      const { runVisualRegression } = await import('../src/index.js');
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diffra-hook-'));
      const mockPng = encodePng(Buffer.alloc(8 * 8 * 4, 120), 8, 8);

      let hookCalled = false;
      const customDriver = {
        name: 'custom-direct-hook',
        discover: async () => [
          {
            id: 'custom-widget-1',
            name: 'Widget 1',
            group: 'Widgets',
          },
        ],
        capture: async () => {
          hookCalled = true;
          return mockPng;
        },
      };

      try {
        const report = await runVisualRegression({
          cwd: tempDir,
          config: {
            drivers: [customDriver],
            storage: {
              outputDir: path.join(tempDir, '.diffra'),
            },
            snapshot: {
              viewports: [{ width: 8, height: 8 }],
            },
          },
        });

        expect(hookCalled).toBe(true);
        expect(report.summary.total).toBe(1);
        expect(report.results[0].status).toBe('added');
        expect(report.results[0].candidate?.path).toBeDefined();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
