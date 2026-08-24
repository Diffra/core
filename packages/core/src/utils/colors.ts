const isColorSupported =
  !('NO_COLOR' in process.env) &&
  (process.env.FORCE_COLOR === '1' || process.stdout.isTTY === true);

function format(open: string, close: string) {
  return (str: string | number) =>
    isColorSupported ? `\x1b[${open}m${str}\x1b[${close}m` : String(str);
}

export const colors = {
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
