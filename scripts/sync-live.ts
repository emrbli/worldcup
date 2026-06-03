import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as schema from '../src/lib/db/schema.js';
import { EspnClient } from '../src/adapters/espn/espn.client.js';
import { EspnScoreboardAdapter } from '../src/adapters/espn/espn-scoreboard.adapter.js';
import { WorldcupJsonClient } from '../src/adapters/worldcupjson/worldcupjson.client.js';
import { WorldcupJsonScoreboardAdapter } from '../src/adapters/worldcupjson/worldcupjson-scoreboard.adapter.js';
import { LiveScoreService } from '../src/jobs/live-score/live-score.service.js';
import type { DrizzleDb } from '../src/lib/db/db.module.js';

/**
 * One-shot live-score sync with ESPN → worldcupjson fallback.
 * (FootballDataClient needs ConfigService DI; omitted here since FD is only
 * a 3rd-level fallback and the CLI shouldn't touch it directly.)
 *
 * Usage:
 *   pnpm sync:live              → today UTC
 *   pnpm sync:live 2026-06-11   → specific UTC date
 */
async function main(): Promise<void> {
  const arg = process.argv[2];
  const date = arg ? new Date(`${arg}T12:00:00Z`) : new Date();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema }) as DrizzleDb;

  const espnClient = new EspnClient();
  const wcjClient = new WorldcupJsonClient();

  const adapters = [
    new EspnScoreboardAdapter(espnClient),
    new WorldcupJsonScoreboardAdapter(wcjClient),
  ];

  // EventEmitter2 is a no-op here (no WS in CLI context) but satisfies the constructor.
  const service = new LiveScoreService(db, adapters, new EventEmitter2());

  try {
    const result = await service.syncDate(date);
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
