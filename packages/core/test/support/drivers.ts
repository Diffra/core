import type {
  DriverContext,
  VisualDriver,
  VisualTarget,
} from '../../src/types/index.js';

/**
 * Asks a driver for its targets. `discover` is optional on a driver, so a test
 * that expects targets fails loudly here instead of on an undefined later.
 */
export async function discoverFrom(
  driver: VisualDriver,
  context: DriverContext,
): Promise<VisualTarget[]> {
  if (!driver.discover) {
    throw new Error(`Driver "${driver.name}" does not discover targets`);
  }
  return driver.discover(context);
}
