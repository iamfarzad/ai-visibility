import fastify from 'fastify';
import { db } from '@ai-visibility/db';
import { enqueueTask } from './tasks.js';
import * as crypto from 'node:crypto';

const app = fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

app.get('/api/workspaces', async () => {
  const rows = await db.query.workspaces.findMany({});
  return { workspaces: rows };
});

app.get('/api/projects', async () => {
  const rows = await db.query.projects.findMany({});
  return { projects: rows };
});

app.get('/api/findings', async () => {
  const rows = await db.query.findings.findMany({});
  return { findings: rows };
});

app.post('/api/projects/:projectId/ingest-gsc', async (request: any, reply: any) => {
  const projectId = parseInt(request.params.projectId);
  if (isNaN(projectId)) return reply.status(400).send({ error: 'Invalid projectId' });

  const correlationId = crypto.randomUUID();

  await enqueueTask({
    jobType: 'ingest_gsc',
    projectId,
    correlationId,
    retryCount: 0,
  });

  return reply.status(202).send({ correlationId, status: 'queued', jobType: 'ingest_gsc' });
});

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' });
    app.log.info('API listening on port %s', process.env.PORT || 4000);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
