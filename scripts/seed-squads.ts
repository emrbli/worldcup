import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema.js';
import { teams, players, teamProfiles } from '../src/lib/db/schema.js';
import {
  fetchWcTeams,
  normalizeSquad,
} from '../db/seed/sources/football-data-squads.js';

/**
 * One-shot full national-squads seed (enrichment — football-data.org):
 *   pnpm seed:squads
 *
 * Populates full ~26-man squads for all 48 WC teams, plus team logos (crests)
 * and coaches, from a SINGLE football-data.org API call. Idempotent and
 * authoritative: per team it DELETEs all existing players (football-data is now
 * the squad authority — this also clears the older 10/team TheSportsDB rows),
 * re-inserts the squad, sets teams.logo_url + source_ids, and upserts the coach.
 */
async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    // Our teams → Map<name, id>
    const ourTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
    const teamByName = new Map<string, string>();
    for (const t of ourTeams) {
      if (t.name) teamByName.set(t.name, t.id);
    }

    process.stdout.write('→ Fetching football-data WC teams (single call)…\n');
    const raw = await fetchWcTeams();
    process.stdout.write(`  Fetched ${raw.teams?.length ?? 0} teams.\n\n`);

    let matchedTeams = 0;
    let totalPlayers = 0;
    let logosSet = 0;
    let coachesSet = 0;
    const unmatched: string[] = [];

    for (const fdTeam of raw.teams ?? []) {
      const sq = normalizeSquad(fdTeam);
      const teamId = teamByName.get(sq.ourNameKey);

      if (!teamId) {
        process.stdout.write(
          `  WARN: no team match for football-data "${sq.name}" (resolved "${sq.ourNameKey}") — skipping\n`,
        );
        unmatched.push(sq.name);
        continue;
      }

      // 1) Players — authoritative replace (clear ALL, then insert squad).
      await db.delete(players).where(eq(players.teamId, teamId));
      if (sq.players.length > 0) {
        await db.insert(players).values(
          sq.players.map((p) => ({
            teamId,
            name: p.name,
            position: p.position,
            dateOfBirth: p.dateOfBirth,
            nationality: p.nationality,
            sourceIds: { football_data: String(p.fdPlayerId) },
          })),
        );
      }
      totalPlayers += sq.players.length;

      // 2) Team — logo + source_ids merge.
      await db
        .update(teams)
        .set({
          logoUrl: sq.crest,
          sourceIds: sql`coalesce(${teams.sourceIds}, '{}'::jsonb) || ${JSON.stringify({ football_data: String(sq.fdTeamId) })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, teamId));
      if (sq.crest) logosSet++;

      // 3) Coach (+ nationality) — upsert team_profiles.
      if (sq.coach) {
        await db
          .insert(teamProfiles)
          .values({
            teamId,
            coach: sq.coach,
            coachNationality: sq.coachNationality,
          })
          .onConflictDoUpdate({
            target: teamProfiles.teamId,
            set: { coach: sq.coach, coachNationality: sq.coachNationality },
          });
        coachesSet++;
      }

      matchedTeams++;
    }

    process.stdout.write('\n  Summary:\n');
    process.stdout.write(`    matched teams:   ${matchedTeams}\n`);
    process.stdout.write(`    players inserted: ${totalPlayers}\n`);
    process.stdout.write(`    logos set:       ${logosSet}\n`);
    process.stdout.write(`    coaches set:     ${coachesSet}\n`);
    process.stdout.write(
      `    unmatched teams: ${unmatched.length ? unmatched.join(', ') : '(none)'}\n`,
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
