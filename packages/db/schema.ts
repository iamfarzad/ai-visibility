import { pgTable, serial, varchar, text, timestamp, jsonb, integer, boolean, real, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Control Plane ───────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  authProvider: varchar('auth_provider', { length: 50 }),
  role: varchar('role', { length: 50 }).default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerUserId: integer('owner_user_id').notNull().references(() => users.id),
  plan: varchar('plan', { length: 50 }).default('free'),
  billingProvider: varchar('billing_provider', { length: 50 }),
  billingCustomerId: varchar('billing_customer_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  ownerIdx: index('workspace_owner_idx').on(table.ownerUserId),
}));

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  name: varchar('name', { length: 255 }).notNull(),
  primaryDomain: varchar('primary_domain', { length: 255 }),
  platformType: varchar('platform_type', { length: 50 }),
  repoRef: varchar('repo_ref', { length: 255 }),
  vercelProjectRef: varchar('vercel_project_ref', { length: 255 }),
  cmsRef: varchar('cms_ref', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active'),
}, table => ({
  workspaceIdx: index('project_workspace_idx').on(table.workspaceId),
}));

// ─── Connector Plane ─────────────────────────────────────────────────────────

export const connectors = pgTable('connectors', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  provider: varchar('provider', { length: 50 }).notNull(), // 'github', 'gsc', 'vercel', 'wordpress', etc.
  authType: varchar('auth_type', { length: 50 }), // 'oauth_app', 'oauth_user', 'token', etc.
  scopes: text('scopes'),
  encryptedToken: text('encrypted_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  healthStatus: varchar('health_status', { length: 50 }).default('unknown'),
}, table => ({
  projectIdx: index('connector_project_idx').on(table.projectId),
}));

// ─── Execution Plane ─────────────────────────────────────────────────────────

export const findings = pgTable('findings', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  source: varchar('source', { length: 50 }).notNull(), // 'gsc', 'psi', 'benchmark'
  issueType: varchar('issue_type', { length: 100 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'
  evidenceJson: jsonb('evidence_json'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  status: varchar('status', { length: 50 }).default('open'),
}, table => ({
  projectIdx: index('finding_project_idx').on(table.projectId),
  statusIdx: index('finding_status_idx').on(table.status),
}));

export const handoffs = pgTable('handoffs', {
  id: serial('id').primaryKey(),
  findingId: integer('finding_id').notNull().references(() => findings.id),
  plannerModel: varchar('planner_model', { length: 100 }),
  planJson: jsonb('plan_json'),
  riskScore: real('risk_score'),
  status: varchar('status', { length: 50 }).default('pending'),
  approverUserId: integer('approver_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  findingIdx: index('handoff_finding_idx').on(table.findingId),
}));

export const actionRuns = pgTable('action_runs', {
  id: serial('id').primaryKey(),
  handoffId: integer('handoff_id').notNull().references(() => handoffs.id),
  executorType: varchar('executor_type', { length: 50 }), // 'github_pr', 'cms_draft'
  branchName: varchar('branch_name', { length: 255 }),
  prNumber: integer('pr_number'),
  cmsDraftId: varchar('cms_draft_id', { length: 255 }),
  previewUrl: text('preview_url'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  outcome: varchar('outcome', { length: 50 }), // 'success', 'failure', 'cancelled'
}, table => ({
  handoffIdx: index('action_run_handoff_idx').on(table.handoffId),
}));

export const verificationRuns = pgTable('verification_runs', {
  id: serial('id').primaryKey(),
  actionRunId: integer('action_run_id').notNull().references(() => actionRuns.id),
  method: varchar('method', { length: 50 }).notNull(), // 'gsc_inspection', 'prompt_snapshot', 'lighthouse'
  beforeJson: jsonb('before_json'),
  afterJson: jsonb('after_json'),
  verdict: varchar('verdict', { length: 50 }), // 'improved', 'unchanged', 'worsened'
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, table => ({
  actionIdx: index('verification_action_idx').on(table.actionRunId),
}));

// ─── Memory Plane ────────────────────────────────────────────────────────────

export const visibilityMemory = pgTable('visibility_memory', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  memoryVersion: integer('memory_version').default(1).notNull(),
  baselineJson: jsonb('baseline_json'),
  entitiesJson: jsonb('entities_json'),
  competitorsJson: jsonb('competitors_json'),
  trackedPromptsJson: jsonb('tracked_prompts_json'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  projectIdx: index('visibility_memory_project_idx').on(table.projectId),
}));

export const actionMap = pgTable('action_map', {
  id: serial('id').primaryKey(),
  issueType: varchar('issue_type', { length: 100 }).notNull().unique(),
  platformType: varchar('platform_type', { length: 50 }).notNull(),
  templateKey: varchar('template_key', { length: 100 }).notNull(),
  defaultMode: varchar('default_mode', { length: 50 }).notNull(), // 'auto_safe', 'approval_required', 'never_auto'
  requiresApproval: boolean('requires_approval').default(true),
  filesAllowedJson: jsonb('files_allowed_json'),
});

// ─── Audit Plane ───────────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  actorType: varchar('actor_type', { length: 50 }).notNull(), // 'user', 'system', 'agent'
  actorId: varchar('actor_id', { length: 255 }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: varchar('resource_id', { length: 255 }),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  workspaceIdx: index('audit_workspace_idx').on(table.workspaceId),
  createdIdx: index('audit_created_idx').on(table.createdAt),
}));

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  provider: varchar('provider', { length: 50 }).notNull(), // 'stripe', 'paddle'
  providerSubscriptionId: varchar('provider_subscription_id', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('incomplete'),
  seatCount: integer('seat_count').default(1),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
}, table => ({
  workspaceIdx: index('subscription_workspace_idx').on(table.workspaceId),
}));

// ─── Relations ─────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerUserId], references: [users.id] }),
  projects: many(projects),
  subscriptions: many(subscriptions),
  auditLogs: many(auditLogs),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  connectors: many(connectors),
  findings: many(findings),
  visibilityMemory: many(visibilityMemory),
}));

export const findingsRelations = relations(findings, ({ one, many }) => ({
  project: one(projects, { fields: [findings.projectId], references: [projects.id] }),
  handoffs: many(handoffs),
}));

export const handoffsRelations = relations(handoffs, ({ one, many }) => ({
  finding: one(findings, { fields: [handoffs.findingId], references: [findings.id] }),
  actionRuns: many(actionRuns),
}));

export const actionRunsRelations = relations(actionRuns, ({ one, many }) => ({
  handoff: one(handoffs, { fields: [actionRuns.handoffId], references: [handoffs.id] }),
  verifications: many(verificationRuns),
}));
