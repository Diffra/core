import type http from 'node:http';
import {
  createStaticHandler,
  formatServerUrl,
  startStaticServer,
  stopServer,
} from '@diffra/core/server';

export { formatServerUrl };

/** Serves a pre-built site (for example static Storybook) from a directory. */
export function createPreviewHandler(staticRoot: string) {
  return createStaticHandler({ root: staticRoot });
}

/** Starts the preview server on a dynamic port unless one is given. */
export async function startPreviewServer(options: {
  root: string;
  port?: number;
}): Promise<{ server: http.Server; url: string; port: number }> {
  const { server, url, port } = await startStaticServer(options);
  return { server, url, port };
}

export const stopPreviewServer = stopServer;
