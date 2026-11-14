/** Moves an index by one step and wraps around both ends. */
export function stepIndex(
  current: number | null,
  count: number,
  direction: 1 | -1,
): number | null {
  if (count <= 0) return null;
  if (current === null || current < 0) {
    return direction === 1 ? 0 : count - 1;
  }
  return (current + direction + count) % count;
}
