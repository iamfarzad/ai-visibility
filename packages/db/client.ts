import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/ai_visibility',
});

export const db = drizzle(pool, { schema });

export * from './schema';
