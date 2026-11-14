// Builds the optional native binding and places it where the engine looks for
// it. The TypeScript engine is used when no binding is present, so this step
// is only needed for the speed-up. Run `pnpm build` first.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIVE_DIR, nativeBindingFileName } from '../dist/index.js';

const LIBRARY_FILES = {
  darwin: 'libdiffra_diff.dylib',
  linux: 'libdiffra_diff.so',
  win32: 'diffra_diff.dll',
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const library = LIBRARY_FILES[process.platform];
if (!library) {
  console.error(`No native build is defined for ${process.platform}.`);
  process.exitCode = 1;
} else {
  execFileSync('cargo', ['build', '--release'], {
    cwd: root,
    stdio: 'inherit',
  });

  const outDir = path.join(root, NATIVE_DIR);
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, nativeBindingFileName());
  fs.copyFileSync(path.join(root, 'target', 'release', library), target);
  console.log(`Native binding written to ${path.relative(root, target)}`);
}
