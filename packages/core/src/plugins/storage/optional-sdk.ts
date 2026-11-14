/**
 * Loads a cloud SDK that is an optional peer dependency. Pass the import as a
 * function so bundlers can still see the literal module name.
 */
export async function loadSdk<T>(
  load: () => Promise<T>,
  packageName: string,
  backend: string,
): Promise<T> {
  try {
    return await load();
  } catch (cause) {
    throw new Error(
      `The ${backend} storage adapter needs the "${packageName}" package. Install it alongside @diffra/core.`,
      { cause },
    );
  }
}
