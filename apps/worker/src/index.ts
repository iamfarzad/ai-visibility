/**
 * Cloud Tasks job processor.
 * Designed for at-least-once delivery — every handler MUST be idempotent.
 */

import fastify from 'fastify';
import { db, findings, handoffs } from '@ai-visibility/db';
import { policyEngine } from '@ai-visibility/policies';
import { ActionMode, FindingStatus } from '@ai-visibility/types';
import { GSCConnector, normalizeSearchAnalytics, deduplicateFindings } from '@ai-visibility/gsc-connector';
import type { SearchAnalyticsRow } from '@ai-visibility/gsc-connector';

export interface JobPayload {
  jobType: 'ingest_gsc' | 'ingest_psi' | 'plan_fix' | 'execute_fix' | 'verify_run' | 'prompt_snapshot';
  projectId: number;
  findingId?: number;
  handoffId?: number;
  actionRunId?: number;
  correlationId: string;
  retryCount: number;
}

function logJobStart(payload: JobPayload) {
  console.log(`[JOB START] ${payload.jobType} | correlation=${payload.correlationId} | retry=${payload.retryCount}`);
}

function logJobEnd(payload: JobPayload, outcome: string) {
  console.log(`[JOB END] ${payload.jobType} | correlation=${payload.correlationId} | outcome=${outcome}`);
}

export async function processJob(payload: JobPayload): Promise<{ success: boolean; message: string }> {
  logJobStart(payload);

  try {
    switch (payload.jobType) {
      case 'ingest_gsc':
        return await handleIngestGSC(payload);
      case 'ingest_psi':
        return await handleIngestPSI(payload);
      case 'plan_fix':
        return await handlePlanFix(payload);
      case 'execute_fix':
        return await handleExecuteFix(payload);
      case 'verify_run':
        return await handleVerifyRun(payload);
      case 'prompt_snapshot':
        return await handlePromptSnapshot(payload);
      default:
        return { success: false, message: `Unknown job type: ${(payload as any).jobType}` };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[JOB ERROR] ${payload.jobType} | correlation=${payload.correlationId} | error=${error}`);
    return { success: false, message: error };
  } finally {
    logJobEnd(payload, 'completed');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGSCConnector(): GSCConnector {
  return new GSCConnector({
    siteUrl: process.env.GSC_SITE_URL ?? 'sc-domain:farzadbayat.com',
    credentials: {
      clientEmail: process.env.GSC_CLIENT_EMAIL ?? '',
      privateKey: (process.env.GSC_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    },
  });
}

function getDateRange(daysAgo: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleIngestGSC(payload: JobPayload): Promise<{ success: boolean; message: string; count?: number }> {
  const connector = getGSCConnector();

  // Fetch current 30 days
  const currentRange = getDateRange(30);
  const rows = await connector.getSearchAnalytics({
    startDate: currentRange.startDate,
    endDate: currentRange.endDate,
    dimensions: ['query', 'page'],
    rowLimit: 1000,
  });

  // Fetch prior 30 days for comparison
  const priorRange = getDateRange(60);
  const priorRows = await connector.getSearchAnalytics({
    startDate: priorRange.startDate,
    endDate: getDateRange(30).startDate, // 60 to 30 days ago
    dimensions: ['query', 'page'],
    rowLimit: 1000,
  });

  // Normalize + deduplicate
  const rawFindings = normalizeSearchAnalytics(rows, priorRows);
  const deduped = deduplicateFindings(rawFindings);

  // Insert into DB
  let inserted = 0;
  for (const f of deduped) {
    await db.insert(findings).values({
      projectId: payload.projectId,
      source: 'gsc',
      issueType: f.issueType,
      severity: f.severity,
      evidenceJson: f.evidenceJson,
      status: FindingStatus.OPEN,
    });
    inserted++;
  }

  return {
    success: true,
    message: `GSC ingestion complete: ${rows.length} rows → ${rawFindings.length} findings → ${inserted} inserted (deduped)`,
    count: inserted,
  };
}

async function handleIngestPSI(payload: JobPayload): Promise<{ success: boolean; message: string }> {
  // TODO (Slice 3): Implement PageSpeed Insights ingestion
  return { success: true, message: 'PSI ingestion placeholder complete' };
}

async function handlePlanFix(payload: JobPayload): Promise<{ success: boolean; message: string }> {
  if (!payload.findingId) return { success: false, message: 'Missing findingId' };

  const finding = await db.query.findings.findFirst({
    where: (f, { eq }) => eq(f.id, payload.findingId!),
  });
  if (!finding) return { success: false, message: 'Finding not found' };

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, finding.projectId),
  });

  const decision = policyEngine.classify(finding.issueType, project?.platformType ?? 'unknown');

  const [handoff] = await db.insert(handoffs).values({
    findingId: payload.findingId,
    plannerModel: 'gemini-3.5-flash',
    planJson: { decision, finding: { id: finding.id, issueType: finding.issueType } },
    riskScore: decision.mode === ActionMode.AUTO_SAFE ? 0.2 : decision.mode === ActionMode.APPROVAL_REQUIRED ? 0.6 : 1.0,
    status: decision.mode === ActionMode.AUTO_SAFE ? 'pending' : 'pending',
  }).returning();

  return { success: true, message: `Handoff ${handoff.id} created with mode ${decision.mode}` };
}

async function handleExecuteFix(payload: JobPayload): Promise<{ success: boolean; message: string }> {
  // TODO (Slice 6): Implement GitHub draft PR creation or CMS draft write
  return { success: true, message: 'Fix execution placeholder complete' };
}

async function handleVerifyRun(payload: JobPayload): Promise<{ success: boolean; message: string }> {
  // TODO: Post-change verification (GSC inspection, lighthouse, prompt snapshot)
  return { success: true, message: 'Verification placeholder complete' };
}

async function handlePromptSnapshot(payload: JobPayload): Promise<{ success: boolean; message: string }> {
  // TODO (Slice 7): Implement NorGEO-style prompt snapshot + answer extraction
  return { success: true, message: 'Prompt snapshot placeholder complete' };
}

// ─── HTTP Server (for Cloud Run) ────────────────────────────────────────────

const server = fastify({ logger: true });

server.post('/tasks/process', async (request: any, reply: any) => {
  const payload = request.body as JobPayload;
  const result = await processJob(payload);
  return reply.status(result.success ? 200 : 500).send(result);
});

server.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

async function start() {
  const port = Number((process as any).env?.PORT) || 8080;
  await server.listen({ port, host: '0.0.0.0' });
  server.log.info('Worker listening on port %s', port);
}

start();
