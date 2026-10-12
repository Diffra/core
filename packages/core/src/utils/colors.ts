/**
 * Dynamically determines ANSI color support in compliance with
 * no-color.org and force-color specifications.
 */
export function isColorSupported(): boolean {
  const forceColor = process.env.FORCE_COLOR;
  if (forceColor === '0' || forceColor === 'false') {
    return false;
  }
  if (forceColor !== undefined && forceColor !== '') {
    return true;
  }
  const noColor = process.env.NO_COLOR;
  if (noColor !== undefined && noColor !== '') {
    return false;
  }
  return process.stdout?.isTTY === true;
}

function format(open: string, close: string) {
  return (str: string | number) =>
    isColorSupported() ? `\x1b[${open}m${str}\x1b[${close}m` : String(str);
}

export const colors = {
  isColorSupported,
  reset: format('0', '0'),
  bold: format('1', '22'),
  dim: format('2', '22'),
  italic: format('3', '23'),
  underline: format('4', '24'),

  red: format('31', '39'),
  green: format('32', '39'),
  yellow: format('33', '39'),
  blue: format('34', '39'),
  cyan: format('36', '39'),
  white: format('37', '39'),
  gray: format('90', '39'),
};
