import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/lib/db/schema.js';
import { FifaClient } from '../src/adapters/fifa/fifa.client.js';
import { FifaSyncService } from '../src/jobs/fifa-sync/fifa-sync.service.js';
import type { DrizzleDb } from '../src/lib/db/db.module.js';

/**
 * One-shot FIFA enrichment sync (secondary / enrichment — master plan §8 F):
 *   pnpm sync:fifa
 * Populates standings (from FIFA group tables), tournament_leaders (topscorers),
 * and — for live/finished matches — match_events / match_lineups / officials.
 */
async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema }) as DrizzleDb;

  // FifaClient reads FIFA_API_BASE_URL / FIFA_SEASON_ID via ConfigService —
  // stub it from process.env (with the same defaults as env.validation.ts).
  const configStub = {
    get: (key: string, _opts?: unknown) => {
      if (key === 'FIFA_API_BASE_URL')
        return process.env.FIFA_API_BASE_URL ?? 'https://api.fifa.com/api/v3';
      if (key === 'FIFA_SEASON_ID') return process.env.FIFA_SEASON_ID ?? '285023';
      return undefined;
    },
  } as never;

  const client = new FifaClient(configStub);
  const service = new FifaSyncService(db, client);

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
