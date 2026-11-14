import { spawn } from 'node:child_process';

/** The command that opens a URL in the default browser on each platform. */
function openerFor(platform: NodeJS.Platform): {
  command: string;
  args: (url: string) => string[];
} {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: (url) => [url] };
    case 'win32':
      // The empty title argument stops `start` from treating the URL as one.
      return { command: 'cmd', args: (url) => ['/c', 'start', '""', url] };
    default:
      return { command: 'xdg-open', args: (url) => [url] };
  }
}

/** Opens a URL in the default browser. Failing to do so is not an error. */
export function openInBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform,
): void {
  const { command, args } = openerFor(platform);
  try {
    const child = spawn(command, args(url), {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    // A missing opener only means the user opens the printed link themselves.
  }
}
