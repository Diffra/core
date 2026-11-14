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

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
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
  await run('npx', [
    '--yes',
    `playwright@${playwrightPackage.version}`,
    'install',
    ...(withDeps ? ['--with-deps'] : []),
    ...missing,
  ]);
}
