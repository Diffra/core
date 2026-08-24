import type {
  DriverContext,
  UrlTargetConfig,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export class UrlDriver implements VisualDriver {
  name = 'url';

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    const { config } = context;
    const rawUrls = config.urls || [];
    const targets: VisualTarget[] = [];

    const baseUrl = config.storybookUrl || 'http://localhost:3000';

    for (let i = 0; i < rawUrls.length; i++) {
      const item = rawUrls[i];
      let urlStr: string;
      let configObj: UrlTargetConfig | undefined;

      if (typeof item === 'string') {
        urlStr = item;
      } else {
        urlStr = item.url;
        configObj = item;
      }

      const fullUrl =
        urlStr.startsWith('http://') || urlStr.startsWith('https://')
          ? urlStr
          : `${baseUrl.replace(/\/$/, '')}/${urlStr.replace(/^\//, '')}`;

      let urlPath = urlStr;
      try {
        const parsed = new URL(fullUrl);
        urlPath = parsed.pathname || '/';
      } catch {}

      const cleanName =
        configObj?.name ||
        (urlPath === '/' || urlPath === ''
          ? 'Home'
          : urlPath
              .replace(/^\//, '')
              .replace(/[/_]/g, ' ')
              .replace(/-/g, ' '));

      const id =
        configObj?.id ||
        (urlPath === '/' || urlPath === ''
          ? 'route--home'
          : `route--${urlPath
              .replace(/^\//, '')
              .replace(/[^a-zA-Z0-9]/g, '_')
              .toLowerCase()}`);

      const group = configObj?.group || 'Pages';

      targets.push({
        id,
        name: cleanName,
        group,
        component: group,
        title: group,
        url: fullUrl,
        selector: configObj?.selector,
        parameters: {
          snapshot: {
            delay: configObj?.delay ?? config.delay,
            diffThreshold: configObj?.diffThreshold ?? config.diffThreshold,
            viewports: configObj?.viewports ?? config.viewports,
            selector: configObj?.selector,
          },
        },
      });
    }

    return targets;
  }
}

export function createUrlDriver(): VisualDriver {
  return new UrlDriver();
}
