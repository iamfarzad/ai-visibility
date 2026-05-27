import fastify from 'fastify';
import { db } from '@ai-visibility/db';

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
