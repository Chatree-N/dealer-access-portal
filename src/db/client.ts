import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/openchat';

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
