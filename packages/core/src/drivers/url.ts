import type {
  DriverContext,
  UrlDriverConfig,
  UrlTargetConfig,
  VisualDriver,
  VisualTarget,
} from '../types/index.js';

export interface UrlDriverOptions {
  baseUrl?: string;
  urls?: Array<string | UrlTargetConfig>;
  headers?: Record<string, string>;
  auth?: { username: string; password?: string };
  cookies?: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
}

export class UrlDriver implements VisualDriver {
  name = 'url';
  private options?: UrlDriverOptions;

  constructor(options?: UrlDriverOptions) {
    this.options = options;
  }

  async discover(context: DriverContext): Promise<VisualTarget[]> {
    let options = this.options;
    if (!options || (!options.urls && !options.baseUrl)) {
      const cfgDrivers = context.config.drivers;
      if (Array.isArray(cfgDrivers)) {
        const match = cfgDrivers.find(
          (d): d is UrlDriverConfig =>
            typeof d === 'object' &&
            d !== null &&
            'driver' in d &&
            d.driver === 'url',
        );
        if (match && typeof match === 'object') {
          options = match;
        }
      } else if (
        typeof cfgDrivers === 'object' &&
        cfgDrivers !== null &&
        'driver' in cfgDrivers &&
        cfgDrivers.driver === 'url'
      ) {
        options = cfgDrivers as UrlDriverConfig;
      }
    }

    const rawUrls = options?.urls || [];
    const targets: VisualTarget[] = [];
    const baseUrl = options?.baseUrl || '';
    const defaultHeaders = options?.headers;
    const defaultAuth = options?.auth;
    const defaultCookies = options?.cookies;

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

      let fullUrl: string;
      if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
        fullUrl = urlStr;
      } else if (baseUrl) {
        fullUrl = `${baseUrl.replace(/\/+$/, '')}/${urlStr.replace(/^\/+/, '')}`;
      } else {
        fullUrl = urlStr.startsWith('/') ? urlStr : `/${urlStr}`;
      }

      // Neutral URL base without hardcoded localhost per AGENTS.md Rule 8
      const fallbackBase = baseUrl || 'http://diffra.internal';
      let parsed: URL;
      try {
        parsed = new URL(
          fullUrl.startsWith('http://') || fullUrl.startsWith('https://')
            ? fullUrl
            : `${fallbackBase.replace(/\/+$/, '')}/${fullUrl.replace(/^\/+/, '')}`,
        );
      } catch {
        parsed = new URL('http://diffra.internal/');
      }

      const rawPathname = parsed.pathname || '/';
      const rawQuery = parsed.search.replace(/^\?/, '');
      const rawHash = parsed.hash.replace(/^#/, '');

      let idSuffix = '';
      let nameSuffix = '';
      if (rawQuery) {
        idSuffix += `_${rawQuery.replace(/[^a-zA-Z0-9]/g, '_')}`;
        nameSuffix += ` (${rawQuery})`;
      }
      if (rawHash) {
        idSuffix += `_${rawHash.replace(/[^a-zA-Z0-9]/g, '_')}`;
        nameSuffix += ` #${rawHash}`;
      }

      const cleanedPath = rawPathname.replace(/^\/+|\/+$/g, '');
      const sanitizedPath =
        cleanedPath === '' ? 'home' : cleanedPath.replace(/[^a-zA-Z0-9]/g, '_');

      const cleanIdCore = `${sanitizedPath}${idSuffix}`
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
      const id = `route--${cleanIdCore || 'home'}`;

      let derivedName: string;
      if (configObj?.name) {
        derivedName = configObj.name;
      } else if (cleanedPath === '') {
        derivedName = `Home${nameSuffix}`;
      } else {
        derivedName = `${cleanedPath
          .replace(/[/_]/g, ' ')
          .replace(/-/g, ' ')}${nameSuffix}`;
      }

      const segments = cleanedPath.split('/').filter(Boolean);
      const derivedGroup =
        configObj?.group ||
        (segments.length > 1
          ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
          : 'Pages');

      const headers = configObj?.headers || defaultHeaders;
      const auth = configObj?.auth || defaultAuth;
      const cookies = configObj?.cookies || defaultCookies;

      targets.push({
        id,
        name: derivedName,
        group: derivedGroup,
        url: fullUrl,
        snapshot: configObj?.snapshot || {},
        metadata: {
          ...(headers ? { headers } : {}),
          ...(auth ? { auth } : {}),
          ...(cookies ? { cookies } : {}),
        },
      });
    }

    return targets;
  }
}

export function createUrlDriver(options?: UrlDriverOptions): VisualDriver {
  return new UrlDriver(options);
}
