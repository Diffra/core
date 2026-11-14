import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { encodePng } from '@diffra/engine';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createImageDriver,
  PNG_SIGNATURE,
  validatePngFile,
} from '../../src/drivers/index.js';
import { discoverFrom } from '../support/drivers.js';

describe('image driver', () => {
  it('ImageDriver discovers valid PNG files across multiple directories', async () => {
    const baseDir = path.join(os.tmpdir(), `diffra-img-multi-${Date.now()}`);
    const dirA = path.join(baseDir, 'desktop');
    const dirB = path.join(baseDir, 'mobile');
    await fs.mkdir(dirA, { recursive: true });
    await fs.mkdir(dirB, { recursive: true });

    const png = encodePng(Buffer.alloc(4 * 4 * 4, 100), 4, 4);
    await fs.writeFile(path.join(dirA, 'hero.png'), png);
    await fs.writeFile(path.join(dirB, 'hero.png'), png);

    const driver = createImageDriver({ dirs: [dirA, dirB] });
    try {
      const targets = await discoverFrom(driver, {
        config: {},
        cwd: process.cwd(),
      });
      expect(targets).toHaveLength(2);
      expect(targets[0]?.id).not.toBe(targets[1]?.id);
      expect(targets.some((t) => t.id.includes('desktop_hero'))).toBe(true);
      expect(targets.some((t) => t.id.includes('mobile_hero'))).toBe(true);
    } finally {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });

  it('ImageDriver skips 0-byte and corrupted PNG files during discovery and capture', async () => {
    const baseDir = path.join(os.tmpdir(), `diffra-img-corrupt-${Date.now()}`);
    await fs.mkdir(baseDir, { recursive: true });

    await fs.writeFile(path.join(baseDir, 'zero-byte.png'), Buffer.alloc(0));
    await fs.writeFile(
      path.join(baseDir, 'corrupt-header.png'),
      Buffer.from('NOT_PNG_HEADER'),
    );
    const validPng = encodePng(Buffer.alloc(2 * 2 * 4, 255), 2, 2);
    await fs.writeFile(path.join(baseDir, 'valid.png'), validPng);

    const driver = createImageDriver({ dir: baseDir });
    try {
      const targets = await discoverFrom(driver, {
        config: {},
        cwd: process.cwd(),
      });
      expect(targets).toHaveLength(1);
      expect(targets[0]?.name).toBe('valid');

      // Test capture on invalid targets
      const zeroTask = {
        target: {
          id: 't1',
          name: 't1',
          filePath: path.join(baseDir, 'zero-byte.png'),
        },
        viewport: { width: 100, height: 100 },
      };
      const corruptTask = {
        target: {
          id: 't2',
          name: 't2',
          filePath: path.join(baseDir, 'corrupt-header.png'),
        },
        viewport: { width: 100, height: 100 },
      };
      const validTask = {
        target: {
          id: 't3',
          name: 't3',
          filePath: path.join(baseDir, 'valid.png'),
        },
        viewport: { width: 100, height: 100 },
      };

      const buf0 = await driver.capture?.(zeroTask, {
        config: {},
        cwd: process.cwd(),
      });
      const bufCorrupt = await driver.capture?.(corruptTask, {
        config: {},
        cwd: process.cwd(),
      });
      const bufValid = await driver.capture?.(validTask, {
        config: {},
        cwd: process.cwd(),
      });

      expect(buf0).toBeNull();
      expect(bufCorrupt).toBeNull();
      expect(bufValid).not.toBeNull();
      expect(bufValid?.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    } finally {
      await fs.rm(baseDir, { recursive: true, force: true });
    }
  });

  it('validatePngFile correctly identifies PNG magic signature', async () => {
    const tmpDir = path.join(os.tmpdir(), `diffra-magic-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    const validPath = path.join(tmpDir, 'valid.png');
    const zeroPath = path.join(tmpDir, 'zero.png');
    const shortPath = path.join(tmpDir, 'short.png');
    const invalidPath = path.join(tmpDir, 'invalid.png');

    await fs.writeFile(validPath, encodePng(Buffer.alloc(1 * 1 * 4, 1), 1, 1));
    await fs.writeFile(zeroPath, Buffer.alloc(0));
    await fs.writeFile(shortPath, Buffer.from([0x89, 0x50]));
    await fs.writeFile(invalidPath, Buffer.from('1234567890'));

    try {
      expect((await validatePngFile(validPath)).valid).toBe(true);
      expect((await validatePngFile(zeroPath)).valid).toBe(false);
      expect((await validatePngFile(shortPath)).valid).toBe(false);
      expect((await validatePngFile(invalidPath)).valid).toBe(false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  describe('Image Driver Stress & Multi-Directory Scanning', () => {
    const tempDirs: string[] = [];

    function makeTempDir(prefix: string): string {
      const dir = path.join(
        os.tmpdir(),
        `diffra-adv-img-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      );
      tempDirs.push(dir);
      return dir;
    }

    afterEach(async () => {
      for (const dir of tempDirs) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      }
      tempDirs.length = 0;
    });

    it('validatePngFile stress: verifies headers across 0-byte, truncated, and non-PNG formats', async () => {
      const tempDir = makeTempDir('validate-stress');
      await fs.mkdir(tempDir, { recursive: true });

      const files = {
        zero: path.join(tempDir, 'zero.png'),
        oneByte: path.join(tempDir, '1byte.png'),
        fourBytes: path.join(tempDir, '4bytes.png'),
        sevenBytes: path.join(tempDir, '7bytes.png'),
        corruptEight: path.join(tempDir, 'corrupt8.png'),
        jpeg: path.join(tempDir, 'photo.png'),
        gif87: path.join(tempDir, 'anim87.png'),
        gif89: path.join(tempDir, 'anim89.png'),
        bmp: path.join(tempDir, 'bitmap.png'),
        webp: path.join(tempDir, 'modern.png'),
        valid: path.join(tempDir, 'valid.png'),
      };

      // 0 bytes
      await fs.writeFile(files.zero, Buffer.alloc(0));
      // Truncated headers
      await fs.writeFile(files.oneByte, Buffer.from([0x89]));
      await fs.writeFile(
        files.fourBytes,
        Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      );
      await fs.writeFile(
        files.sevenBytes,
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]),
      );
      // 8 bytes but not PNG
      await fs.writeFile(files.corruptEight, Buffer.from('NOT_PNG!'));
      // Other image formats
      await fs.writeFile(
        files.jpeg,
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
      );
      await fs.writeFile(
        files.gif87,
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00]),
      );
      await fs.writeFile(
        files.gif89,
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]),
      );
      await fs.writeFile(
        files.bmp,
        Buffer.from([0x42, 0x4d, 0x36, 0x00, 0x00, 0x00, 0x00, 0x00]),
      );
      await fs.writeFile(
        files.webp,
        Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]),
      );
      // Valid PNG
      await fs.writeFile(
        files.valid,
        encodePng(Buffer.alloc(2 * 2 * 4, 128), 2, 2),
      );

      // Verify empirical results
      expect(await validatePngFile(files.zero)).toEqual({
        valid: false,
        reason: 'File is 0 bytes (empty)',
      });
      expect(await validatePngFile(files.oneByte)).toEqual({
        valid: false,
        reason: 'File size is less than 8-byte PNG header',
      });
      expect(await validatePngFile(files.fourBytes)).toEqual({
        valid: false,
        reason: 'File size is less than 8-byte PNG header',
      });
      expect(await validatePngFile(files.sevenBytes)).toEqual({
        valid: false,
        reason: 'File size is less than 8-byte PNG header',
      });
      expect(await validatePngFile(files.corruptEight)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.jpeg)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.gif87)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.gif89)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.bmp)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.webp)).toEqual({
        valid: false,
        reason: 'Invalid PNG magic header',
      });
      expect(await validatePngFile(files.valid)).toEqual({ valid: true });

      // Non-existent file
      const nonExistent = await validatePngFile(
        path.join(tempDir, 'ghost-non-existent.png'),
      );
      expect(nonExistent.valid).toBe(false);
      expect(nonExistent.reason).toMatch(/ENOENT/);
    });

    it('ImageDriver discovery skips corrupt, truncated, and non-PNG files while discovering valid targets', async () => {
      const tempDir = makeTempDir('discover-stress');
      await fs.mkdir(tempDir, { recursive: true });

      // Populate with mixture of invalid and valid files
      await fs.writeFile(path.join(tempDir, 'empty.png'), Buffer.alloc(0));
      await fs.writeFile(
        path.join(tempDir, 'trunc.png'),
        Buffer.from([0x89, 0x50]),
      );
      await fs.writeFile(
        path.join(tempDir, 'jpeg.png'),
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      );
      await fs.writeFile(
        path.join(tempDir, 'gif.png'),
        Buffer.from('GIF89a\x01\x00'),
      );
      await fs.writeFile(
        path.join(tempDir, 'noise.png'),
        Buffer.from('RANDOM_CORRUPT_BYTES_XYZ'),
      );
      await fs.writeFile(
        path.join(tempDir, 'notes.txt'),
        Buffer.from('Should be ignored because not .png'),
      );

      // Two valid PNGs
      const pngA = encodePng(Buffer.alloc(1 * 1 * 4, 10), 1, 1);
      const pngB = encodePng(Buffer.alloc(2 * 2 * 4, 20), 2, 2);
      await fs.writeFile(path.join(tempDir, 'button-primary.png'), pngA);
      await fs.writeFile(path.join(tempDir, 'button-secondary.png'), pngB);

      const driver = createImageDriver({ dir: tempDir });
      const targets = await discoverFrom(driver, {
        config: {},
        cwd: process.cwd(),
      });

      expect(targets).toHaveLength(2);
      const names = (targets ?? []).map((t) => t.name).sort();
      expect(names).toEqual(['button-primary', 'button-secondary']);
    });

    it('ImageDriver capture handles corrupt/truncated targets returning null without unhandled exceptions', async () => {
      const tempDir = makeTempDir('capture-stress');
      await fs.mkdir(tempDir, { recursive: true });

      const emptyPath = path.join(tempDir, 'zero.png');
      const truncPath = path.join(tempDir, 'trunc.png');
      const fakePath = path.join(tempDir, 'fake.png');
      const validPath = path.join(tempDir, 'real.png');

      await fs.writeFile(emptyPath, Buffer.alloc(0));
      await fs.writeFile(truncPath, Buffer.from([0x89, 0x50]));
      await fs.writeFile(fakePath, Buffer.from('NOT_A_PNG_HEADER_HERE'));
      await fs.writeFile(
        validPath,
        encodePng(Buffer.alloc(2 * 2 * 4, 50), 2, 2),
      );

      const driver = createImageDriver({ dir: tempDir });

      // 1. 0-byte file capture
      const bufZero = await driver.capture?.(
        {
          target: { id: 'img--zero', name: 'zero', filePath: emptyPath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufZero).toBeNull();

      // 2. Truncated header capture
      const bufTrunc = await driver.capture?.(
        {
          target: { id: 'img--trunc', name: 'trunc', filePath: truncPath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufTrunc).toBeNull();

      // 3. Fake header capture
      const bufFake = await driver.capture?.(
        {
          target: { id: 'img--fake', name: 'fake', filePath: fakePath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufFake).toBeNull();

      // 4. Missing file capture
      const bufMissing = await driver.capture?.(
        {
          target: {
            id: 'img--missing',
            name: 'missing',
            filePath: path.join(tempDir, 'does-not-exist.png'),
          },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufMissing).toBeNull();

      // 5. Target with missing filePath and imagePath
      const bufNoPath = await driver.capture?.(
        {
          target: { id: 'img--nopath', name: 'nopath' },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufNoPath).toBeNull();

      // 6. Valid file capture succeeds with PNG_SIGNATURE
      const bufValid = await driver.capture?.(
        {
          target: { id: 'img--valid', name: 'valid', filePath: validPath },
          viewport: { width: 100, height: 100 },
        },
        { config: {}, cwd: process.cwd() },
      );
      expect(bufValid).not.toBeNull();
      expect(bufValid?.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    });

    it('ImageDriver captureAll filters out corrupt files without dropping valid captures', async () => {
      const tempDir = makeTempDir('captureall-stress');
      await fs.mkdir(tempDir, { recursive: true });

      const invalidPath = path.join(tempDir, 'bad.png');
      const validPath = path.join(tempDir, 'good.png');
      await fs.writeFile(invalidPath, Buffer.from('CORRUPT_DATA'));
      await fs.writeFile(
        validPath,
        encodePng(Buffer.alloc(2 * 2 * 4, 100), 2, 2),
      );

      const driver = createImageDriver({ dir: tempDir });
      const results = await driver.captureAll?.(
        [
          {
            target: { id: 'img--bad', name: 'bad', filePath: invalidPath },
            viewport: { width: 100, height: 100 },
          },
          {
            target: { id: 'img--good', name: 'good', filePath: validPath },
            viewport: { width: 100, height: 100 },
          },
        ],
        { config: {}, cwd: process.cwd() },
      );

      expect(results).toHaveLength(1);
      expect(results?.[0]?.target.id).toBe('img--good');
      expect(results?.[0]?.buffer.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    });

    it('multi-directory scanning eliminates collisions for duplicate basenames across different folders', async () => {
      const baseDir = makeTempDir('multidir-stress');
      const desktopDir = path.join(baseDir, 'desktop');
      const mobileDir = path.join(baseDir, 'mobile');
      await fs.mkdir(desktopDir, { recursive: true });
      await fs.mkdir(mobileDir, { recursive: true });

      // Duplicate basenames in different folders: 'hero.png' and 'footer.png'
      const pngDesktop = encodePng(Buffer.alloc(4 * 4 * 4, 50), 4, 4);
      const pngMobile = encodePng(Buffer.alloc(2 * 2 * 4, 150), 2, 2);

      await fs.writeFile(path.join(desktopDir, 'hero.png'), pngDesktop);
      await fs.writeFile(path.join(desktopDir, 'footer.png'), pngDesktop);
      await fs.writeFile(path.join(mobileDir, 'hero.png'), pngMobile);
      await fs.writeFile(path.join(mobileDir, 'footer.png'), pngMobile);

      const driver = createImageDriver({ dirs: [desktopDir, mobileDir] });
      const targets =
        (await discoverFrom(driver, {
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(4);
      const targetIds = targets.map((t) => t.id);
      const uniqueIds = new Set(targetIds);
      expect(uniqueIds.size).toBe(4);

      expect(targetIds).toContain('image--desktop_hero_png');
      expect(targetIds).toContain('image--mobile_hero_png');
      expect(targetIds).toContain('image--desktop_footer_png');
      expect(targetIds).toContain('image--mobile_footer_png');

      const desktopHero = targets.find(
        (t) => t.id === 'image--desktop_hero_png',
      );
      const mobileHero = targets.find((t) => t.id === 'image--mobile_hero_png');
      expect(desktopHero?.group).toBe('desktop');
      expect(mobileHero?.group).toBe('mobile');
      expect(desktopHero?.name).toBe('hero');
      expect(mobileHero?.name).toBe('hero');
    });

    it('multi-directory scanning handles nested folders without cross-folder collision', async () => {
      const baseDir = makeTempDir('multidir-nested');
      const dirA = path.join(baseDir, 'suiteA');
      const dirB = path.join(baseDir, 'suiteB');
      await fs.mkdir(path.join(dirA, 'components'), { recursive: true });
      await fs.mkdir(path.join(dirB, 'components'), { recursive: true });

      const samplePng = encodePng(Buffer.alloc(2 * 2 * 4, 99), 2, 2);
      await fs.writeFile(
        path.join(dirA, 'components', 'button.png'),
        samplePng,
      );
      await fs.writeFile(
        path.join(dirB, 'components', 'button.png'),
        samplePng,
      );

      const driver = createImageDriver({ dirs: [dirA, dirB] });
      const targets =
        (await discoverFrom(driver, {
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      expect(targets[0]?.id).not.toBe(targets[1]?.id);
      expect(targets[0]?.group).not.toBe(targets[1]?.group);
    });

    it('keeps ids distinct when configured directories share a folder name', async () => {
      // Boundary condition: two distinct directory paths that share the same directory name
      // e.g., /tmp/.../projectA/screenshots and /tmp/.../projectB/screenshots
      const baseDir = makeTempDir('multidir-samebasename');
      const dirA = path.join(baseDir, 'projectA', 'screenshots');
      const dirB = path.join(baseDir, 'projectB', 'screenshots');
      await fs.mkdir(dirA, { recursive: true });
      await fs.mkdir(dirB, { recursive: true });

      const samplePng = encodePng(Buffer.alloc(2 * 2 * 4, 88), 2, 2);
      await fs.writeFile(path.join(dirA, 'dialog.png'), samplePng);
      await fs.writeFile(path.join(dirB, 'dialog.png'), samplePng);

      const driver = createImageDriver({ dirs: [dirA, dirB] });
      const targets =
        (await discoverFrom(driver, {
          config: {},
          cwd: process.cwd(),
        })) ?? [];

      expect(targets).toHaveLength(2);
      const ids = targets.map((t) => t.id);
      expect(new Set(ids).size).toBe(2);
      expect(ids.some((id) => id.includes('projecta'))).toBe(true);
      expect(ids.some((id) => id.includes('projectb'))).toBe(true);
    });
  });
});
