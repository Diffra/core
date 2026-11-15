/** Reads the arguments an agent passes to a tool, with errors it can act on. */

export function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value === '') {
    throw new Error(`"${key}" must be a non-empty string.`);
  }
  return value;
}

export function requireString(
  args: Record<string, unknown>,
  key: string,
): string {
  const value = optionalString(args, key);
  if (value === undefined) throw new Error(`"${key}" is required.`);
  return value;
}

export function optionalInteger(
  args: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`"${key}" must be a whole number of 0 or more.`);
  }
  return value;
}

export function optionalStringList(
  args: Record<string, unknown>,
  key: string,
): string[] | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item === '')
  ) {
    throw new Error(`"${key}" must be a list of non-empty strings.`);
  }
  return value as string[];
}

export function requireStringList(
  args: Record<string, unknown>,
  key: string,
): string[] {
  const value = optionalStringList(args, key);
  if (!value || value.length === 0) {
    throw new Error(`"${key}" is required and must not be empty.`);
  }
  return value;
}
