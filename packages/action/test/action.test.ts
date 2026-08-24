import { describe, expect, it } from 'vitest';
import { matchesBranchOrBool } from '../src/index.js';

describe('@diffra/action branch matching', () => {
  it('matches exact branches or refs', () => {
    expect(matchesBranchOrBool('main', 'refs/heads/main')).toBe(true);
    expect(matchesBranchOrBool('master', 'refs/heads/master')).toBe(true);
    expect(matchesBranchOrBool('feat/buttons', 'refs/heads/feat/buttons')).toBe(
      true,
    );
    expect(matchesBranchOrBool('main', 'refs/heads/feature')).toBe(false);
    expect(matchesBranchOrBool('main', 'main')).toBe(true);
  });

  it('matches boolean flags', () => {
    expect(matchesBranchOrBool('true', 'refs/heads/feature')).toBe(true);
    expect(matchesBranchOrBool('true', 'refs/heads/main')).toBe(true);
    expect(matchesBranchOrBool('false', 'refs/heads/main')).toBe(false);
    expect(matchesBranchOrBool('', 'refs/heads/main')).toBe(false);
    expect(matchesBranchOrBool('false', 'refs/heads/feature')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(matchesBranchOrBool('release/1.0', 'refs/heads/release/1.0')).toBe(
      true,
    );
    expect(matchesBranchOrBool('release/1.0', 'refs/heads/release/2.0')).toBe(
      false,
    );
  });
});
