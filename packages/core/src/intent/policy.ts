import type { VisualTestResult } from '../types/index.js';

/**
 * What an agent may approve without a person. `never`: nothing, a person runs
 * the approval. `intended`: changes that a declared intent covers. `proven`:
 * intended changes whose cause was proven by undoing it in the live page.
 * `any`: every change.
 */
export type ApprovalPolicy = 'never' | 'intended' | 'proven' | 'any';

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = 'intended';

export interface ApprovalCheck {
  allowed: boolean;
  /** Why the approval is refused, set when it is not allowed. */
  reason?: string;
}

/** Decides whether an agent may approve a snapshot under the given policy. */
export function checkApproval(
  result: VisualTestResult,
  policy: ApprovalPolicy,
): ApprovalCheck {
  if (policy === 'any') return { allowed: true };
  if (policy === 'never') {
    return {
      allowed: false,
      reason:
        'agent.autoApprove is "never", so a person must approve this change with "diffra approve".',
    };
  }

  const { classification } = result;
  if (!classification) {
    return {
      allowed: false,
      reason: `No intent was declared for ${result.id}. Declare an intent that covers it first.`,
    };
  }
  if (classification.kind !== 'intended') {
    return { allowed: false, reason: classification.reason };
  }
  if (policy === 'intended') return { allowed: true };

  const proof = result.explanation?.proof;
  if (proof?.status === 'proven') return { allowed: true };
  return {
    allowed: false,
    reason: proof
      ? `The change to ${result.id} is not proven (${proof.status}). Run diffra_prove, and approve only when it is proven.`
      : `The change to ${result.id} has no proof. Run diffra_prove to prove it first.`,
  };
}
