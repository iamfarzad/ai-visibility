export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum FindingStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  IGNORED = 'ignored',
}

export enum ActionMode {
  AUTO_SAFE = 'auto_safe',
  APPROVAL_REQUIRED = 'approval_required',
  NEVER_AUTO = 'never_auto',
}

export enum HandoffStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
}

export enum ActionOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  CANCELLED = 'cancelled',
}

export enum VerificationVerdict {
  IMPROVED = 'improved',
  UNCHANGED = 'unchanged',
  WORSENED = 'worsened',
}

export enum ConnectorProvider {
  GSC = 'gsc',
  PSI = 'psi',
  GITHUB = 'github',
  VERCEL = 'vercel',
  WORDPRESS = 'wordpress',
  SHOPIFY = 'shopify',
  WEBFLOW = 'webflow',
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export type FindingEvidence = {
  gscQuery?: string;
  losingUrl?: string;
  targetUrl?: string;
  coverageState?: string;
  lcpValue?: number;
  jsRendered?: boolean;
  [key: string]: unknown;
};

export type PlanAction = {
  templateKey: string;
  target: string;
  filesAllowed: string[];
  mode: ActionMode;
};

export type VerificationCheck = {
  type: string;
  expected: unknown;
  tolerance?: number;
};

export type PromptPack = {
  category: string;
  intentType: string;
  prompt: string;
  geography: string;
  expectedBrands: string[];
  difficulty: number; // 1-5
};
