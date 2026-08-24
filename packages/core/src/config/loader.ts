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
  const rawConfig = result?.config || {};

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
