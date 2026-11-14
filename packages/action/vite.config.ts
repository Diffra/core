import fs from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);

/** The bundle is the action's entry point, so it lives at the repository root. */
const OUT_DIR = path.resolve(import.meta.dirname, '../../dist');
export const ACTION_ENTRY = 'action.mjs';

/**
 * Playwright locates its package files relative to its own directory. Inside a
 * single-file bundle that directory is this folder, so the two files it reads
 * to select browser builds are shipped here.
 */
const PLAYWRIGHT_SHIM_DIR = 'playwright-core';

function playwrightCoreDir(): string {
  const coreEntry = require.resolve('@diffra/core');
  const playwrightPackage = createRequire(coreEntry).resolve(
    'playwright/package.json',
  );
  return path.dirname(
    createRequire(playwrightPackage).resolve('playwright-core/package.json'),
  );
}

/** Folder next to the bundle that core looks in for the review interface. */
const VIEWER_SHIM_DIR = 'viewer';

function viewerFiles(): { script: string; styles: string } {
  const coreRequire = createRequire(require.resolve('@diffra/core'));
  return {
    script: coreRequire.resolve('@diffra/viewer/bundle'),
    styles: coreRequire.resolve('@diffra/viewer/style.css'),
  };
}

function shipPlaywrightFiles(): Plugin {
  let outDir = OUT_DIR;
  return {
    name: 'diffra-ship-runtime-files',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const source = playwrightCoreDir();
      const target = path.join(outDir, PLAYWRIGHT_SHIM_DIR);
      fs.mkdirSync(target, { recursive: true });
      for (const file of ['package.json', 'browsers.json']) {
        fs.copyFileSync(path.join(source, file), path.join(target, file));
      }

      // Review bundles are written by core, which finds the viewer here.
      const viewer = viewerFiles();
      const viewerTarget = path.join(outDir, VIEWER_SHIM_DIR);
      fs.mkdirSync(viewerTarget, { recursive: true });
      fs.copyFileSync(
        viewer.script,
        path.join(viewerTarget, 'viewer.bundle.js'),
      );
      fs.copyFileSync(viewer.styles, path.join(viewerTarget, 'viewer.css'));
    },
  };
}

/**
 * Stream libraries import browser polyfills of Node modules by path, such as
 * `process/` or `string_decoder/lib/string_decoder.js`, so they can also run
 * in a browser. In Node the built-in module is the same thing, and the
 * polyfill path would otherwise be left as an import the bundle cannot
 * satisfy. Real built-in subpaths such as `fs/promises` are untouched.
 */
function nodeBuiltinsInsteadOfPolyfills(): Plugin {
  const builtins = new Set(builtinModules);
  return {
    name: 'diffra-node-builtins',
    enforce: 'pre',
    resolveId(source) {
      if (source.startsWith('node:') || builtins.has(source)) return null;
      const [name] = source.split('/');
      if (name && source !== name && builtins.has(name)) {
        return { id: `node:${name}`, external: true };
      }
      return null;
    },
  };
}

// An ES module has no CommonJS globals, which bundled dependencies expect.
// __dirname points into the shipped Playwright folder (see above).
const COMMONJS_SHIM = [
  "import { createRequire as __createRequire } from 'node:module';",
  "import { fileURLToPath as __fileURLToPath } from 'node:url';",
  "import { dirname as __dirname_of, join as __join } from 'node:path';",
  'const require = __createRequire(import.meta.url);',
  'const __filename = __fileURLToPath(import.meta.url);',
  `const __dirname = __join(__dirname_of(__filename), '${PLAYWRIGHT_SHIM_DIR}', 'lib');`,
].join(' ');

export default defineConfig({
  plugins: [nodeBuiltinsInsteadOfPolyfills(), shipPlaywrightFiles()],
  build: {
    ssr: path.resolve(import.meta.dirname, 'src/index.ts'),
    outDir: OUT_DIR,
    emptyOutDir: true,
    target: 'node24',
    minify: true,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: ACTION_ENTRY,
        codeSplitting: false,
        banner: COMMONJS_SHIM,
      },
      onwarn(warning, warn) {
        // Bundled third-party code uses direct eval; it is not ours to change.
        if (warning.code === 'EVAL') return;
        warn(warning);
      },
    },
  },
  ssr: {
    noExternal: true,
    external: [
      ...builtinModules,
      ...builtinModules.map((name) => `node:${name}`),
    ],
  },
});
