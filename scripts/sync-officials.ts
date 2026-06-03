import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/lib/db/schema.js';
import { FootballDataClient } from '../src/adapters/football-data/football-data.client.js';
import { OfficialsSyncService } from '../src/jobs/pre-match-officials/officials.service.js';
import type { DrizzleDb } from '../src/lib/db/db.module.js';

/**
 * One-shot officials sync CLI:
 *   pnpm sync:officials   → syncs matches in next 48 hours that need officials
 */
async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema }) as DrizzleDb;

  // FootballDataClient needs ConfigService for the token — wire manually
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN is required');

  // Stub ConfigService for FootballDataClient
  const configStub = {
    get: (_key: string, _opts?: unknown) => token,
  } as never;

  const fdClient = new FootballDataClient(configStub);
  const service = new OfficialsSyncService(db, fdClient);

  try {
    const result = await service.sync();
    process.stdout.write(`Done: ${JSON.stringify(result)}\n`);
  } finally {
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
