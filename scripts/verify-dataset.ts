import 'dotenv/config';
import { Pool } from 'pg';

/**
 * Dataset health report. Prints row counts for every table, flags the core
 * tournament tables against their expected counts, and exits non-zero if a
 * core table is wrong (so CI / the build script can fail loudly).
 *
 * Usage: pnpm dataset:verify
 */
interface Check {
  table: string;
  expected?: number; // core tables have a hard expected count
  note?: string; // why an "informational" table may be empty
}

const CHECKS: Check[] = [
  { table: 'confederations', expected: 6 },
  { table: 'groups', expected: 12 },
  { table: 'teams', expected: 48 },
  { table: 'cities', expected: 16 },
  { table: 'venues', expected: 16 },
  { table: 'matches', expected: 104 },
  { table: 'standings', expected: 48 },
  { table: 'bracket_slots', expected: 32 },
  { table: 'players', note: 'full squads (football-data)' },
  { table: 'team_profiles', note: 'wc26-mcp + coaches' },
  { table: 'city_guides', note: 'wc26-mcp' },
  { table: 'fan_zones', note: 'wc26-mcp' },
  { table: 'visa_info', note: 'wc26-mcp' },
  { table: 'historical_matchups', note: 'wc26-mcp' },
  { table: 'news', note: 'RSS crawler' },
  { table: 'odds', note: 'wc26-mcp' },
  { table: 'broadcasts', note: 'FIFA /watch' },
  { table: 'tournament_leaders', note: 'fills once the tournament starts' },
  { table: 'match_events', note: 'fills on match day (live sync)' },
  { table: 'match_lineups', note: 'fills ~1h before kickoff' },
  { table: 'match_stats', note: 'fills on match day' },
];

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let failures = 0;

  // Coverage on enriched columns
  const enrich = async (sql: string): Promise<number> =>
    Number((await pool.query(sql)).rows[0]?.n ?? 0);

  process.stdout.write('\n  WorldCup dataset report\n  ───────────────────────\n');
  for (const c of CHECKS) {
    const n = await enrich(`SELECT count(*)::int AS n FROM "${c.table}"`);
    if (c.expected !== undefined) {
      const ok = n === c.expected;
      if (!ok) failures++;
      process.stdout.write(
        `  ${ok ? '✓' : '✗'} ${c.table.padEnd(22)} ${n}${ok ? '' : ` (expected ${c.expected})`}\n`,
      );
    } else {
      const tag = n > 0 ? '•' : '○';
      process.stdout.write(
        `  ${tag} ${c.table.padEnd(22)} ${n}${n === 0 && c.note ? `  — ${c.note}` : ''}\n`,
      );
    }
  }

  // Enrichment coverage (informational)
  const rankings = await enrich(`SELECT count(*)::int AS n FROM teams WHERE fifa_ranking IS NOT NULL`);
  const logos = await enrich(`SELECT count(*)::int AS n FROM teams WHERE logo_url IS NOT NULL AND logo_url <> ''`);
  const caps = await enrich(`SELECT count(*)::int AS n FROM venues WHERE capacity IS NOT NULL`);
  const fifaIds = await enrich(`SELECT count(*)::int AS n FROM matches WHERE source_ids ? 'fifa'`);
  process.stdout.write('\n  Enrichment coverage\n  ───────────────────\n');
  process.stdout.write(`  • teams w/ fifa_ranking   ${rankings}/48\n`);
  process.stdout.write(`  • teams w/ logo_url       ${logos}/48\n`);
  process.stdout.write(`  • venues w/ capacity      ${caps}/16\n`);
  process.stdout.write(`  • matches w/ source_ids.fifa ${fifaIds}/104\n`);

  await pool.end();

  if (failures > 0) {
    process.stdout.write(`\n  ✗ ${failures} core table(s) failed expected counts.\n`);
    process.exit(1);
  }
  process.stdout.write('\n  ✓ All core tables match expected counts.\n');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
