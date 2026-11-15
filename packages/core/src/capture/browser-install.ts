import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium, firefox, webkit } from 'playwright';
import playwrightPackage from 'playwright/package.json' with { type: 'json' };

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

const LAUNCHERS = { chromium, firefox, webkit };

/** Browsers that are not yet downloaded for the bundled Playwright version. */
export function findMissingBrowsers(browsers: BrowserName[]): BrowserName[] {
  return [...new Set(browsers)].filter(
    (name) => !fs.existsSync(LAUNCHERS[name].executablePath()),
  );
}

/** How much of a failed command's output is kept for the error message. */
const OUTPUT_TAIL_BYTES = 2000;

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    // The output is shown as it arrives, and its end is kept so that a failure
    // says why, not only that it failed.
    let tail = '';
    const keep = (stream: NodeJS.WriteStream) => (chunk: Buffer) => {
      stream.write(chunk);
      tail = (tail + chunk.toString()).slice(-OUTPUT_TAIL_BYTES);
    };
    child.stdout?.on('data', keep(process.stdout));
    child.stderr?.on('data', keep(process.stderr));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with ${code}${tail.trim() ? `:\n${tail.trim()}` : ''}`,
          ),
        );
    });
  });
}

/**
 * Downloads any browsers that are missing, using the Playwright CLI at exactly
 * the version this package is built against so the browser revision matches.
 * System libraries are installed too on Linux CI, where they are usually absent.
 */
export async function ensureBrowsers(
  browsers: BrowserName[] = ['chromium'],
): Promise<void> {
  const missing = findMissingBrowsers(browsers);
  if (missing.length === 0) return;

  const withDeps = process.platform === 'linux' && Boolean(process.env.CI);
  console.log(
    `[diffra] Installing Playwright browsers: ${missing.join(', ')}${withDeps ? ' (with system dependencies)' : ''}`,
  );
  const install = ['install', ...(withDeps ? ['--with-deps'] : []), ...missing];
  const spec = `playwright@${playwrightPackage.version}`;
  // npx comes with npm, which not every Node setup carries, so another way of
  // running a package is tried before giving up.
  const runners: [string, string[]][] = [
    ['npx', ['--yes', spec, ...install]],
    ['pnpm', ['dlx', spec, ...install]],
  ];
  const failures: string[] = [];
  for (const [command, args] of runners) {
    try {
      await run(command, args);
      return;
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err));
    }
  }
  throw new Error(
    `Could not install the Playwright browsers.\n${failures.join('\n')}`,
  );
}
