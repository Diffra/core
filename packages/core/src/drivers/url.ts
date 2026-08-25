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
    const baseUrl = config.storybookUrl || '';

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
          : baseUrl
            ? `${baseUrl.replace(/\/$/, '')}/${urlStr.replace(/^\//, '')}`
            : urlStr;

      let urlPath = urlStr;
      try {
        const parsed = new URL(fullUrl.startsWith('http') ? fullUrl : `http://localhost${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`);
        urlPath = parsed.pathname || '/';
      } catch {}

      const segments = urlPath.split('/').filter(Boolean);
      const derivedGroup =
        configObj?.group ||
        (segments.length > 1
          ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
          : 'Pages');

      const derivedName =
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

      targets.push({
        id,
        name: derivedName,
        group: derivedGroup,
        component: derivedGroup,
        title: derivedGroup,
        url: fullUrl,
        selector: configObj?.selector,
        mask: configObj?.mask,
        parameters: {
          snapshot: {
            delay: configObj?.delay ?? config.delay,
            diffThreshold: configObj?.diffThreshold ?? config.diffThreshold,
            viewports: configObj?.viewports ?? config.viewports,
            selector: configObj?.selector,
            mask: configObj?.mask,
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
