import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  compareImages,
  compareRawRGBA,
  decodePng,
  encodePng,
} from '@diffra/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPool } from '../src/capture/browser-pool.js';
import { captureTargets } from '../src/capture/screenshot-runner.js';
import { getGitInfo, parseGitRemoteUrl } from '../src/git/baseline.js';
import { DEFAULT_DIFF_THRESHOLD } from '../src/index.js';
import { normalizeViewport } from '../src/utils/viewport.js';

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

describe('Milestone 5 Challenger: Core Runner, Pluggable Drivers & Engine Adversarial Stress', () => {
  // ==========================================================================
  // Section 1: Playwright Browser Task Runner Stress
  // ==========================================================================
  describe('Playwright Browser Task Runner', () => {
    let server: http.Server;
    let serverUrl: string;

    beforeEach(async () => {
      // Dynamic port 0 server serving minimal deterministic test HTML
      server = http.createServer((req, res) => {
        if (req.url === '/slow') {
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(
              '<html><body><div id="target">Slow Content</div></body></html>',
            );
          }, 100);
          return;
        }

        if (req.url === '/error-500') {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { margin: 0; background-color: #f4f4f5; }
                .box { width: 100px; height: 100px; background-color: #2563eb; }
              </style>
            </head>
            <body>
              <div id="target" class="box">Active Target</div>
            </body>
          </html>
        `);
      });

      await new Promise<void>((resolve) => {
        server.listen(0, () => resolve());
      });

      const addr = server.address() as AddressInfo;
      const host = addr.family === 'IPv6' ? `[${addr.address}]` : addr.address;
      serverUrl = `http://${host}:${addr.port}`;
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    });

    it('handles concurrency scaling (1 vs 4 vs 8) and drains queue completely', async () => {
      const taskCount = 8;
      const tasks = Array.from({ length: taskCount }, (_, i) => ({
        target: {
          id: `concurrency-task-${i}`,
          name: `Task ${i}`,
          group: 'ConcurrencyGroup',
          url: `${serverUrl}/?item=${i}`,
        },
        viewport: { width: 400, height: 300 },
      }));

      // Test with concurrency = 1 (serial)
      const serialResults = await captureTargets(tasks.slice(0, 2), undefined, {
        concurrency: 1,
      });
      expect(serialResults).toHaveLength(2);
      for (const res of serialResults) {
        expect(res.buffer).toBeInstanceOf(Buffer);
        expect(res.buffer.length).toBeGreaterThan(0);
        const decoded = decodePng(res.buffer);
        expect(decoded.width).toBe(400);
        expect(decoded.height).toBe(300);
      }

      // Test with concurrency = 4
      const parallelResults = await captureTargets(
        tasks.slice(0, 4),
        undefined,
        {
          concurrency: 4,
        },
      );
      expect(parallelResults).toHaveLength(4);

      // Test with concurrency > tasks length (concurrency 16 on 3 tasks)
      const overAllocatedResults = await captureTargets(
        tasks.slice(0, 3),
        undefined,
        { concurrency: 16 },
      );
      expect(overAllocatedResults).toHaveLength(3);

      // Test with zero or negative concurrency option (must safely default to >= 1)
      const zeroConcurrencyResults = await captureTargets(
        tasks.slice(0, 2),
        undefined,
        { concurrency: 0 },
      );
      expect(zeroConcurrencyResults).toHaveLength(2);
    });

    it('recovers from browser navigation failures and malformed URLs gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const failingTasks = [
        {
          target: {
            id: 'invalid-url-target',
            name: 'InvalidUrl',
            group: 'Failures',
            url: 'not-a-valid-url-format',
          },
          viewport: { width: 320, height: 240 },
        },
        {
          target: {
            id: 'missing-url-target',
            name: 'MissingUrl',
            group: 'Failures',
            // No url, and no baseUrl provided -> throws error caught by runner
          },
          viewport: { width: 320, height: 240 },
        },
        {
          target: {
            id: 'healthy-endpoint',
            name: 'Healthy',
            group: 'Failures',
            url: `${serverUrl}/healthy`,
          },
          viewport: { width: 320, height: 240 },
        },
      ];

      const results = await captureTargets(failingTasks, undefined, {
        concurrency: 2,
      });

      // The healthy target should succeed despite errors in adjacent tasks
      expect(results).toHaveLength(1);
      const healthyResult = results.find(
        (r) => r.target.id === 'healthy-endpoint',
      );
      expect(healthyResult).toBeDefined();

      // Warning logs should capture the failures without unhandled process rejection
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[diffra] Warning capturing invalid-url-target',
        ),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[diffra] Warning capturing missing-url-target',
        ),
      );

      warnSpy.mockRestore();
    });

    it('safely handles BrowserPool releasePage and close when already closed or crashed', async () => {
      const pool = new BrowserPool(2, true);

      // Acquire page
      const workerPage = await pool.acquirePage({ width: 640, height: 480 });
      expect(workerPage.page).toBeDefined();
      expect(workerPage.context).toBeDefined();

      // Manually close page and context before releasePage
      await workerPage.page.close();
      await workerPage.context.close();

      // releasePage should not throw when called on closed page/context
      await expect(pool.releasePage(workerPage)).resolves.not.toThrow();

      // Close pool
      await expect(pool.close()).resolves.not.toThrow();

      // Re-closing an already closed pool must be idempotent and safe
      await expect(pool.close()).resolves.not.toThrow();
    });

    it('handles extreme viewport boundaries and numeric inputs', async () => {
      // 1. Extreme 1x1 minimal viewport
      const minimalVp = normalizeViewport({ width: 1, height: 1 });
      expect(minimalVp.width).toBe(1);
      expect(minimalVp.height).toBe(1);

      // 2. High-res 4K viewport
      const largeVp = normalizeViewport({
        width: 3840,
        height: 2160,
        name: '4k',
      });
      expect(largeVp.width).toBe(3840);
      expect(largeVp.height).toBe(2160);
      expect(largeVp.name).toBe('4k');

      // 3. Numeric shorthand input (e.g. 1440) -> defaults height to 800
      const numericVp = normalizeViewport(1440);
      expect(numericVp.width).toBe(1440);
      expect(numericVp.height).toBe(800);
      expect(numericVp.name).toBe('1440px');

      // 4. Viewport with missing height -> defaults height to 800
      const missingHeightVp = normalizeViewport({ width: 768 } as unknown as {
        width: number;
        height: number;
      });
      expect(missingHeightVp.width).toBe(768);
      expect(missingHeightVp.height).toBe(800);

      // 5. Capture targets across minimal and high-res viewports
      const extremeTasks = [
        {
          target: {
            id: 'viewport-minimal',
            name: 'Minimal',
            group: 'Viewports',
            url: `${serverUrl}/`,
          },
          viewport: { width: 10, height: 10 },
        },
        {
          target: {
            id: 'viewport-large',
            name: 'Large',
            group: 'Viewports',
            url: `${serverUrl}/`,
          },
          viewport: { width: 1600, height: 900 },
        },
      ];

      const results = await captureTargets(extremeTasks, undefined, {
        concurrency: 2,
      });

      expect(results).toHaveLength(2);
      const minCap = results.find((r) => r.target.id === 'viewport-minimal');
      const maxCap = results.find((r) => r.target.id === 'viewport-large');

      expect(minCap).toBeDefined();
      expect(maxCap).toBeDefined();

      if (minCap && maxCap) {
        const decodedMin = decodePng(minCap.buffer);
        const decodedMax = decodePng(maxCap.buffer);
        expect(decodedMin.width).toBe(10);
        expect(decodedMin.height).toBe(10);
        expect(decodedMax.width).toBe(1600);
        expect(decodedMax.height).toBe(900);
      }
    });

    it('handles non-existent target selector with timeout fallback without hanging', async () => {
      const taskWithBadSelector = [
        {
          target: {
            id: 'target-bad-selector',
            name: 'BadSelector',
            group: 'Selectors',
            url: `${serverUrl}/`,
            snapshot: {
              selector: '#non-existent-selector-999',
            },
          },
          viewport: { width: 300, height: 200 },
        },
      ];

      // Runner should gracefully fall back to full page screenshot when selector is not found
      const results = await captureTargets(taskWithBadSelector, undefined, {
        concurrency: 1,
      });

      expect(results).toHaveLength(1);
      const decoded = decodePng(results[0].buffer);
      expect(decoded.width).toBe(300);
      expect(decoded.height).toBe(200);
    }, 15000);
  });

  // ==========================================================================
  // Section 2: Diffra Engine Pixel Comparison Adversarial Stress
  // ==========================================================================
  describe('Diffra Engine Pixel Comparison', () => {
    it('verifies 100% fast-path match for identical PNG buffers and raw RGBA buffers', async () => {
      const width = 64;
      const height = 64;
      const rawData = Buffer.alloc(width * height * 4);
      for (let i = 0; i < rawData.length; i += 4) {
        rawData[i] = 45; // R
        rawData[i + 1] = 90; // G
        rawData[i + 2] = 180; // B
        rawData[i + 3] = 255; // A
      }

      // Raw RGBA compare
      const rawResult = compareRawRGBA(rawData, rawData, width, height);
      expect(rawResult.diffCount).toBe(0);
      expect(rawResult.diffPercentage).toBe(0);
      expect(rawResult.hasDiff).toBe(false);
      expect(rawResult.isSameDimensions).toBe(true);
      expect(rawResult.boundingBoxes).toHaveLength(0);

      // PNG buffer compare (exercises identical buffer reference/byte equality fast-path)
      const pngBuffer = encodePng(rawData, width, height);
      const pngResult = await compareImages(pngBuffer, pngBuffer);
      expect(pngResult.diffCount).toBe(0);
      expect(pngResult.diffPercentage).toBe(0);
      expect(pngResult.hasDiff).toBe(false);
      expect(pngResult.isSameDimensions).toBe(true);
      expect(pngResult.boundingBoxes).toHaveLength(0);

      // Fully transparent identical image
      const transparentRaw = Buffer.alloc(32 * 32 * 4, 0);
      const transResult = compareRawRGBA(
        transparentRaw,
        transparentRaw,
        32,
        32,
      );
      expect(transResult.diffCount).toBe(0);
      expect(transResult.hasDiff).toBe(false);
    });

    it('handles asymmetric dimension mismatches and verifies diff bounding boxes', async () => {
      // Baseline 40x20 vs Candidate 20x60
      const bw = 40;
      const bh = 20;
      const cw = 20;
      const ch = 60;

      const baseRgba = Buffer.alloc(bw * bh * 4, 200);
      const candRgba = Buffer.alloc(cw * ch * 4, 200);

      const basePng = encodePng(baseRgba, bw, bh);
      const candPng = encodePng(candRgba, cw, ch);

      const diff = await compareImages(basePng, candPng, {
        generateDiffImage: true,
      });

      expect(diff.isSameDimensions).toBe(false);
      expect(diff.width).toBe(Math.max(bw, cw)); // 40
      expect(diff.height).toBe(Math.max(bh, ch)); // 60
      expect(diff.hasDiff).toBe(true);
      expect(diff.diffCount).toBeGreaterThan(0);
      expect(diff.boundingBoxes.length).toBeGreaterThanOrEqual(1);

      // Diff image must be sized to max dimensions (40 x 60)
      expect(diff.diffImage).toBeDefined();
      if (diff.diffImage) {
        const decodedDiff = decodePng(diff.diffImage);
        expect(decodedDiff.width).toBe(40);
        expect(decodedDiff.height).toBe(60);
      }
    });

    it('discriminates subtle sub-pixel anti-aliasing from genuine color regressions', () => {
      // Create a 20x20 image with a vertical edge and an anti-aliased transition pixel
      const width = 20;
      const height = 20;
      const base = Buffer.alloc(width * height * 4, 255); // White background
      const cand = Buffer.alloc(width * height * 4, 255);

      // Draw dark bar on both
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < 5; x++) {
          const idx = (y * width + x) * 4;
          base[idx] = 10;
          base[idx + 1] = 10;
          base[idx + 2] = 10;
          cand[idx] = 10;
          cand[idx + 1] = 10;
          cand[idx + 2] = 10;
        }
      }

      // Add anti-aliasing gradient pixel at x = 5 (intermediate gray) in candidate only
      const aaIdx = (10 * width + 5) * 4;
      cand[aaIdx] = 140;
      cand[aaIdx + 1] = 140;
      cand[aaIdx + 2] = 140;

      // With anti-aliasing detection enabled (includeAntiAliasing: false, default)
      // The intermediate font-smoothing pixel adjacent to the dark line should be recognized as AA
      const resultIgnoreAA = compareRawRGBA(base, cand, width, height, {
        includeAntiAliasing: false,
      });

      // With anti-aliasing detection disabled (includeAntiAliasing: true)
      // Every difference is counted
      const resultIncludeAA = compareRawRGBA(base, cand, width, height, {
        includeAntiAliasing: true,
      });

      expect(resultIncludeAA.diffCount).toBeGreaterThan(0);
      expect(resultIgnoreAA.diffCount).toBeLessThanOrEqual(
        resultIncludeAA.diffCount,
      );

      // High-contrast non-anti-aliased change (pure neon green in an isolated pixel)
      const isolatedIdx = (5 * width + 15) * 4;
      cand[isolatedIdx] = 0;
      cand[isolatedIdx + 1] = 255;
      cand[isolatedIdx + 2] = 0;

      const resultHighContrast = compareRawRGBA(base, cand, width, height, {
        includeAntiAliasing: false,
      });
      // The isolated neon pixel MUST be flagged as a diff
      expect(resultHighContrast.hasDiff).toBe(true);
      expect(resultHighContrast.diffCount).toBeGreaterThanOrEqual(1);
    });

    it('stress-tests color threshold boundaries (0.0, 0.063, 0.5, 1.0) and option aliases', () => {
      const width = 2;
      const height = 2;
      const base = Buffer.from([
        100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100,
        100, 255,
      ]);

      // 1. Subtle 1-unit delta in candidate
      const candSubtle = Buffer.from([
        101, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100,
        100, 255,
      ]);

      // At diffThreshold: 0.0 -> zero tolerance, must flag diff
      const resZero = compareRawRGBA(base, candSubtle, width, height, {
        diffThreshold: 0.0,
      });
      expect(resZero.diffCount).toBe(1);
      expect(resZero.hasDiff).toBe(true);

      // At default diffThreshold (0.063) -> subtle 1-unit delta must NOT flag diff
      const resDefault = compareRawRGBA(base, candSubtle, width, height, {
        diffThreshold: DEFAULT_DIFF_THRESHOLD,
      });
      expect(resDefault.diffCount).toBe(0);
      expect(resDefault.hasDiff).toBe(false);

      // Verify alias `threshold` matches `diffThreshold`
      const resAlias = compareRawRGBA(base, candSubtle, width, height, {
        threshold: 0.0,
      });
      expect(resAlias.diffCount).toBe(1);

      // 2. Substantial delta (RGB delta 50)
      const candLarge = Buffer.from([
        150, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100,
        100, 255,
      ]);

      // At default 0.063 -> flags diff
      const resFlagged = compareRawRGBA(base, candLarge, width, height, {
        diffThreshold: 0.063,
      });
      expect(resFlagged.diffCount).toBe(1);
      expect(resFlagged.hasDiff).toBe(true);

      // At diffThreshold 1.0 (maximum tolerance) -> suppresses diff
      const resPermissive = compareRawRGBA(base, candLarge, width, height, {
        diffThreshold: 1.0,
      });
      expect(resPermissive.diffCount).toBe(0);
      expect(resPermissive.hasDiff).toBe(false);
    });

    it('supports custom diffColor and diffMask options in diff buffer generation', () => {
      const width = 10;
      const height = 10;
      const base = Buffer.alloc(width * height * 4, 255);
      const cand = Buffer.alloc(width * height * 4, 255);

      // Change pixel (0,0) to black
      cand[0] = 0;
      cand[1] = 0;
      cand[2] = 0;

      // Custom diff color: neon green [0, 255, 0, 255] with diffMask
      const result = compareRawRGBA(base, cand, width, height, {
        diffColor: [0, 255, 0, 255],
        diffMask: true,
        generateDiffImage: true,
      });

      expect(result.hasDiff).toBe(true);
      expect(result.diffImage).toBeDefined();

      if (result.diffImage) {
        const decoded = decodePng(result.diffImage);
        // Changed pixel (0,0) should match custom neon green
        expect(decoded.data[0]).toBe(0); // R
        expect(decoded.data[1]).toBe(255); // G
        expect(decoded.data[2]).toBe(0); // B
        expect(decoded.data[3]).toBe(255); // A

        // Unchanged pixel (1,0) under diffMask: true must be black [0, 0, 0, 255]
        const unchangedIdx = 4;
        expect(decoded.data[unchangedIdx]).toBe(0);
        expect(decoded.data[unchangedIdx + 1]).toBe(0);
        expect(decoded.data[unchangedIdx + 2]).toBe(0);
        expect(decoded.data[unchangedIdx + 3]).toBe(255);
      }
    });

    it('gracefully handles corrupted PNG buffers in compareImages without uncaught exceptions', async () => {
      const validPng = encodePng(Buffer.alloc(10 * 10 * 4, 128), 10, 10);
      const corruptBuffer = Buffer.from('NOT_A_VALID_PNG_FILE_HEADER_DATA');

      // compareImages must catch decoding errors and return fallback diff result with hasDiff: true
      const result = await compareImages(validPng, corruptBuffer);
      expect(result.hasDiff).toBe(true);
      expect(result.isSameDimensions).toBe(false);
    });
  });

  // ==========================================================================
  // Section 3: Git Baseline Resolver Adversarial Stress
  // ==========================================================================
  describe('Git Baseline Resolver', () => {
    let tmpDir: string;
    const originalEnv = { ...process.env };

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'diffra-git-m5-stress-'),
      );
      await runGit(['init', '-b', 'main'], tmpDir);
      await runGit(['config', 'user.name', 'Milestone5 Challenger'], tmpDir);
      await runGit(['config', 'user.email', 'challenger@diffra.dev'], tmpDir);

      // Commit 1 on main
      await fs.writeFile(path.join(tmpDir, 'root.txt'), 'root commit 1\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit 1 on main'], tmpDir);
    });

    afterEach(async () => {
      process.env = { ...originalEnv };
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('resolves baseline commit and branch correctly in detached HEAD state', async () => {
      // Create commit 2 on main
      await fs.writeFile(path.join(tmpDir, 'root.txt'), 'root commit 2\n');
      await runGit(['commit', '-am', 'commit 2 on main'], tmpDir);
      const commit2Sha = await runGit(['rev-parse', 'HEAD'], tmpDir);

      // Create branch feature-alpha with commit 3
      await runGit(['checkout', '-b', 'feature-alpha'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'alpha.txt'), 'alpha content\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit 3 on feature-alpha'], tmpDir);

      // Detach HEAD to commit 2
      await runGit(['checkout', commit2Sha], tmpDir);

      // Clear CI environment variables
      delete process.env.GITHUB_HEAD_REF;
      delete process.env.GITHUB_REF_NAME;
      delete process.env.CI_COMMIT_REF_NAME;
      delete process.env.GITHUB_BASE_REF;

      const gitInfo = await getGitInfo(undefined, tmpDir);

      // In detached HEAD, branch should default to 'HEAD'
      expect(gitInfo.branch).toBe('HEAD');
      expect(gitInfo.commit).toBe(commit2Sha);
      expect(gitInfo.baselineCommit).toBeDefined();
      expect(gitInfo.baselineCommit.length).toBeGreaterThan(0);
    });

    it('falls back safely when target baseline branch does not exist', async () => {
      const nonExistentBranch = 'non-existent-baseline-branch-xyz';

      // Call getGitInfo requesting a branch that does not exist
      const gitInfo = await getGitInfo(nonExistentBranch, tmpDir);

      // Must not throw; must fall back to existing DAG reference or current commit
      expect(gitInfo.commit).toBeDefined();
      expect(gitInfo.baselineCommit).toBeDefined();
      expect(gitInfo.baselineCommit.length).toBeGreaterThan(0);
    });

    it('correctly resolves ancestor in multi-tier branching hierarchy', async () => {
      // main: Commit A
      const commitASha = await runGit(['rev-parse', 'HEAD'], tmpDir);

      // develop: branches from main, adds Commit B
      await runGit(['checkout', '-b', 'develop'], tmpDir);
      await fs.writeFile(path.join(tmpDir, 'develop.txt'), 'develop work\n');
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit B on develop'], tmpDir);
      const commitBSha = await runGit(['rev-parse', 'HEAD'], tmpDir);

      // feature/nested: branches from develop, adds Commit C
      await runGit(['checkout', '-b', 'feature/nested'], tmpDir);
      await fs.writeFile(
        path.join(tmpDir, 'nested.txt'),
        'nested feature work\n',
      );
      await runGit(['add', '.'], tmpDir);
      await runGit(['commit', '-m', 'commit C on feature/nested'], tmpDir);

      // 1. Explicit baseline 'main' -> baseline commit MUST be Commit A
      const mainInfo = await getGitInfo('main', tmpDir);
      expect(mainInfo.baselineBranch).toBe('main');
      expect(mainInfo.baselineCommit).toBe(commitASha);

      // 2. Explicit baseline 'develop' -> baseline commit MUST be Commit B
      const devInfo = await getGitInfo('develop', tmpDir);
      expect(devInfo.baselineBranch).toBe('develop');
      expect(devInfo.baselineCommit).toBe(commitBSha);

      // 3. Dynamic topology discovery (zero config) -> nearest neighbor MUST be 'develop' (distance 1)
      delete process.env.GITHUB_BASE_REF;
      const dynamicInfo = await getGitInfo(undefined, tmpDir);
      expect(dynamicInfo.baselineBranch).toBe('develop');
      expect(dynamicInfo.baselineCommit).toBe(commitBSha);
    });

    it('handles remote URL parsing across diverse formats', () => {
      expect(parseGitRemoteUrl('git@github.com:Diffra/engine-repo.git')).toBe(
        'https://github.com/Diffra/engine-repo',
      );

      expect(
        parseGitRemoteUrl('https://gitlab.example.org/org/core-system.git'),
      ).toBe('https://gitlab.example.org/org/core-system');

      expect(parseGitRemoteUrl('http://git.internal.corp/team/project')).toBe(
        'https://git.internal.corp/team/project',
      );

      expect(parseGitRemoteUrl('')).toBeUndefined();
      expect(parseGitRemoteUrl('not-a-valid-url')).toBeUndefined();
    });
  });

  // ==========================================================================
  // Section 4: Resource Stability & Memory Leak Stress
  // ==========================================================================
  describe('Resource Stability & Teardown Verification', () => {
    it('executes repeated image comparison cycles without unbounded memory growth', async () => {
      const iterations = 50;
      const width = 120;
      const height = 120;

      const baseRgba = Buffer.alloc(width * height * 4, 100);
      const candRgba = Buffer.alloc(width * height * 4, 100);
      // Mutate one pixel per iteration
      candRgba[0] = 200;

      const basePng = encodePng(baseRgba, width, height);
      const candPng = encodePng(candRgba, width, height);

      const memBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const res = await compareImages(basePng, candPng, {
          generateDiffImage: true,
        });
        expect(res.hasDiff).toBe(true);
      }

      const memAfter = process.memoryUsage().heapUsed;
      // Heap difference should be modest; no 100MB+ memory leak
      const heapGrowthMB = (memAfter - memBefore) / (1024 * 1024);
      expect(heapGrowthMB).toBeLessThan(50);
    });
  });
});
