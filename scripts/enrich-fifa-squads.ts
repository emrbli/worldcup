import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema.js';
import { teams, players } from '../src/lib/db/schema.js';
import { fetchFifaSquad } from '../db/seed/sources/fifa-squads.js';

/**
 * FIFA-first squad enrichment: fills jersey numbers + clean positions from the
 * official FIFA squad endpoint (the one source that has them).
 *   pnpm enrich:squads:fifa
 *
 * Per team (matched via teams.source_ids.fifa = IdTeam):
 *  - match each FIFA player to an existing (football-data) player by birth date
 *    → UPDATE number + position + merge source_ids.fifa
 *  - FIFA player with no birth-date match → INSERT (official squad completeness)
 * Idempotent (re-running just re-applies). Polite delay between teams.
 */
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    const teamRows = await db
      .select({ id: teams.id, name: teams.name, sourceIds: teams.sourceIds })
      .from(teams);

    let teamsDone = 0;
    let numbersSet = 0;
    let inserted = 0;
    const failed: string[] = [];

    for (const t of teamRows) {
      const idTeam = t.sourceIds?.fifa;
      if (!idTeam) continue;

      let squad;
      try {
        squad = await fetchFifaSquad(idTeam);
      } catch (err) {
        failed.push(`${t.name}: ${err instanceof Error ? err.message : String(err)}`);
        await sleep(500);
        continue;
      }

      // Existing players for this team, indexed by birth date.
      const existing = await db
        .select({ id: players.id, dob: players.dateOfBirth })
        .from(players)
        .where(eq(players.teamId, t.id));
      const byDob = new Map<string, string>();
      const dobDup = new Set<string>();
      for (const p of existing) {
        if (!p.dob) continue;
        if (byDob.has(p.dob)) dobDup.add(p.dob);
        else byDob.set(p.dob, p.id);
      }

      for (const fp of squad) {
        const matchId = fp.dob && !dobDup.has(fp.dob) ? byDob.get(fp.dob) : undefined;
        if (matchId) {
          await db
            .update(players)
            .set({
              number: fp.number,
              position: fp.position,
              sourceIds: sql`coalesce(${players.sourceIds}, '{}'::jsonb) || ${JSON.stringify({ fifa: fp.idPlayer })}::jsonb`,
            })
            .where(eq(players.id, matchId));
          if (fp.number !== null) numbersSet++;
        } else {
          await db.insert(players).values({
            teamId: t.id,
            name: fp.name,
            position: fp.position,
            number: fp.number,
            dateOfBirth: fp.dob,
            nationality: t.name,
            sourceIds: { fifa: fp.idPlayer },
          });
          inserted++;
          if (fp.number !== null) numbersSet++;
        }
      }

      // FIFA squad is authoritative: drop any non-FIFA leftovers for THIS team
      // (football-data players not in the official squad / birth-date dupes).
      // Only runs for teams we successfully fetched, so a FIFA outage can't
      // wipe the football-data fallback.
      await db
        .delete(players)
        .where(and(eq(players.teamId, t.id), sql`NOT (${players.sourceIds} ? 'fifa')`));

      teamsDone++;
      await sleep(350); // polite gap to avoid FIFA throttling
    }

    process.stdout.write(
      `\nFIFA squad enrich: teams=${teamsDone}/${teamRows.length}, numbers set=${numbersSet}, inserted=${inserted}` +
        (failed.length ? `\n  failed: ${failed.join('; ')}` : '\n'),
    );
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
