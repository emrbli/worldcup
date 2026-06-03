import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as schema from '../src/lib/db/schema.js';
import { StandingsCalcService } from '../src/jobs/standings/standings-calc.service.js';
import type { DrizzleDb } from '../src/lib/db/db.module.js';

/**
 * One-shot standings recalculation from match results.
 *   pnpm calc:standings         → recalculate all groups
 *   pnpm calc:standings {uuid}  → recalculate one group by UUID
 */
async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema }) as DrizzleDb;
  const service = new StandingsCalcService(db, new EventEmitter2() as never);

  const groupId = process.argv[2];
  if (groupId) {
    await service.recalculate(groupId);
    process.stdout.write(`Done: recalculated group ${groupId}\n`);
  } else {
    await service.recalculateAll();
    process.stdout.write('Done: all groups recalculated\n');
  }

  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => { console.error(err); process.exit(1); });
