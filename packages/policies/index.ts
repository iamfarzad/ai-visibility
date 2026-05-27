import { ActionMode } from '@ai-visibility/types';

export interface PolicyEngine {
  classify(issueType: string, platformType: string): PolicyDecision;
}

export interface PolicyDecision {
  mode: ActionMode;
  requiresApproval: boolean;
  allowedFiles?: string[];
  reason: string;
}

const AUTO_SAFE_TEMPLATES = new Set([
  'metadata_patch_pr',
  'jsonld_fix_pr',
  'internal_link_patch_pr',
  'sitemap_submit',
  'asset_optimization_pr',
]);

const APPROVAL_REQUIRED_TEMPLATES = new Set([
  'redirect_fix_pr',
  'canonical_fix_pr',
  'faq_block_draft',
  'comparison_page_draft',
  'render_strategy_fix_pr',
  'profile_sync_draft',
  'browser_verification_run',
]);

const NEVER_AUTO_TEMPLATES = new Set([
  'delete_content',
  'global_theme_rewrite',
  'credential_reset',
  'billing_change',
]);

export const policyEngine: PolicyEngine = {
  classify(issueType: string, platformType: string): PolicyDecision {
    const key = `${issueType}_${platformType}`;

    // Never automatic: irreversible or compliance-affected
    if (NEVER_AUTO_TEMPLATES.has(issueType)) {
      return {
        mode: ActionMode.NEVER_AUTO,
        requiresApproval: true,
        reason: 'Action is irreversible, security-sensitive, or compliance-affected. Manual review required.',
      };
    }

    // Approval required: user-visible or structural
    if (APPROVAL_REQUIRED_TEMPLATES.has(issueType)) {
      return {
        mode: ActionMode.APPROVAL_REQUIRED,
        requiresApproval: true,
        reason: 'Action affects visible structure or search-critical metadata. Requires human approval.',
      };
    }

    // Auto-safe: reversible, scoped, previewable
    if (AUTO_SAFE_TEMPLATES.has(issueType)) {
      return {
        mode: ActionMode.AUTO_SAFE,
        requiresApproval: false,
        reason: 'Action is reversible, scoped to specific files, and produces a previewable diff.',
      };
    }

    // Default conservative
    return {
      mode: ActionMode.APPROVAL_REQUIRED,
      requiresApproval: true,
      reason: `No specific policy for ${key}. Defaulting to approval-required for safety.`,
    };
  },
};

/**
 * Internal test: Can the action be previewed, diffed, reverted, and explained in one audit record?
 * If no → bump up a tier.
 */
export function auditGateCheck(
  canPreview: boolean,
  canDiff: boolean,
  canRevert: boolean,
  canExplain: boolean
): ActionMode {
  if (canPreview && canDiff && canRevert && canExplain) {
    return ActionMode.AUTO_SAFE;
  }
  if (canPreview || canDiff) {
    return ActionMode.APPROVAL_REQUIRED;
  }
  return ActionMode.NEVER_AUTO;
}
