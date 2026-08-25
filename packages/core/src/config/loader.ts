import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { cosmiconfig } from 'cosmiconfig';
import type { DiffraConfig } from '../types/index.js';
import { type DiffraConfigResolved, DiffraConfigSchema } from './schema.js';

const MODULE_NAME = 'diffra';

/**
 * Loads and validates diffra configuration from filesystem or overrides.
 */
export async function loadConfig(
  cwd = process.cwd(),
  overrides: Partial<DiffraConfig> = {},
): Promise<DiffraConfigResolved> {
  let rawConfig: Record<string, unknown> = {};

  // 1. Check for TypeScript config files directly
  const tsConfigNames = [
    `${MODULE_NAME}.config.ts`,
    `${MODULE_NAME}.config.mts`,
    `.${MODULE_NAME}rc.ts`,
  ];

  for (const name of tsConfigNames) {
    const candidate = path.resolve(cwd, name);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        const imported = await import(pathToFileURL(candidate).href);
        rawConfig = imported.default || imported;
        break;
      }
    } catch {}
  }

  // 2. Fall back to cosmiconfig standard search
  if (Object.keys(rawConfig).length === 0) {
    const explorer = cosmiconfig(MODULE_NAME, {
      searchPlaces: [
        'package.json',
        `.${MODULE_NAME}rc`,
        `.${MODULE_NAME}rc.json`,
        `.${MODULE_NAME}rc.yaml`,
        `.${MODULE_NAME}rc.yml`,
        `.${MODULE_NAME}rc.js`,
        `.${MODULE_NAME}rc.cjs`,
        `.${MODULE_NAME}rc.mjs`,
        `${MODULE_NAME}.config.js`,
        `${MODULE_NAME}.config.cjs`,
        `${MODULE_NAME}.config.mjs`,
        `${MODULE_NAME}.config.json`,
      ],
    });

    const result = await explorer.search(cwd);
    if (result?.config) {
      rawConfig = result.config;
    }
  }

  const merged = {
    ...rawConfig,
    ...overrides,
  };

  const parsed = DiffraConfigSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(`Invalid Diffra configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}
