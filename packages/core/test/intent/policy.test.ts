import { describe, expect, it } from 'vitest';
import {
  type ApprovalPolicy,
  checkApproval,
  DEFAULT_APPROVAL_POLICY,
  type Explanation,
  type VisualTestResult,
} from '../../src/index.js';

type ProofStatus = 'proven' | 'unproven' | 'not-attempted';

function result(
  kind?: 'intended' | 'collateral',
  proof?: ProofStatus,
  status: VisualTestResult['status'] = 'changed',
): VisualTestResult {
  return {
    id: 'button--primary',
    name: 'Primary',
    viewport: { width: 10, height: 10 },
    status,
    candidate: {},
    classification: kind
      ? { kind, reason: `classified as ${kind} by the test` }
      : undefined,
    explanation: proof
      ? ({
          proof: { status: proof, note: '', reverted: 0 },
        } as unknown as Explanation)
      : undefined,
  };
}

describe('approval policy', () => {
  it('defaults to intended', () => {
    expect(DEFAULT_APPROVAL_POLICY).toBe('intended');
  });

  describe('never', () => {
    it.each([
      ['intended and proven', result('intended', 'proven')],
      ['intended', result('intended')],
      ['collateral', result('collateral')],
      ['unclassified', result()],
    ])('refuses a change that is %s', (_name, r) => {
      const check = checkApproval(r, 'never');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('agent.autoApprove is "never"');
      expect(check.reason).toContain('diffra approve');
    });
  });

  describe('any', () => {
    it.each([
      ['intended and proven', result('intended', 'proven')],
      ['collateral', result('collateral')],
      ['unclassified', result()],
      ['unproven', result('intended', 'unproven')],
    ])('allows a change that is %s', (_name, r) => {
      expect(checkApproval(r, 'any')).toEqual({ allowed: true });
    });
  });

  describe.each<ApprovalPolicy>(['intended', 'proven'])('%s', (policy) => {
    it('refuses a change with no declared intent', () => {
      const check = checkApproval(result(), policy);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/No intent was declared/);
      expect(check.reason).toMatch(/Declare an intent/);
    });

    it('refuses a collateral change with the classification reason', () => {
      const check = checkApproval(result('collateral', 'proven'), policy);
      expect(check).toEqual({
        allowed: false,
        reason: 'classified as collateral by the test',
      });
    });

    it('applies to added and removed snapshots', () => {
      expect(
        checkApproval(result(undefined, undefined, 'added'), policy).allowed,
      ).toBe(false);
      expect(
        checkApproval(result('collateral', undefined, 'removed'), policy)
          .allowed,
      ).toBe(false);
    });
  });

  describe('intended', () => {
    it.each<[string, ProofStatus | undefined]>([
      ['no proof', undefined],
      ['an unproven change', 'unproven'],
      ['a change that was not attempted', 'not-attempted'],
      ['a proven change', 'proven'],
    ])('allows an intended change with %s', (_name, proof) => {
      expect(checkApproval(result('intended', proof), 'intended')).toEqual({
        allowed: true,
      });
    });

    it('allows intended added and removed snapshots', () => {
      expect(
        checkApproval(result('intended', undefined, 'added'), 'intended')
          .allowed,
      ).toBe(true);
      expect(
        checkApproval(result('intended', undefined, 'removed'), 'intended')
          .allowed,
      ).toBe(true);
    });
  });

  describe('proven', () => {
    it('allows an intended change that is proven', () => {
      expect(checkApproval(result('intended', 'proven'), 'proven')).toEqual({
        allowed: true,
      });
    });

    it('asks for a proof when there is none', () => {
      const check = checkApproval(result('intended'), 'proven');
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/diffra_prove/);
    });

    it.each<ProofStatus>(['unproven', 'not-attempted'])(
      'refuses an intended change that is %s',
      (status) => {
        const check = checkApproval(result('intended', status), 'proven');
        expect(check.allowed).toBe(false);
        expect(check.reason).toContain(status);
        expect(check.reason).toMatch(/diffra_prove/);
      },
    );
  });
});
