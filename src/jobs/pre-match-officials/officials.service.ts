import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, lt, gt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../lib/db/db.module.js';
import type { DrizzleDb } from '../../lib/db/db.module.js';
import { matches, teams } from '../../lib/db/schema.js';
import { FootballDataClient } from '../../adapters/football-data/football-data.client.js';
import { normalizeOfficials } from '../../adapters/football-data/football-data-officials.normalize.js';
import { pairKey } from '../live-score/live-score.service.js';
import type { FDMatch } from '../../adapters/football-data/football-data.types.js';

export interface OfficialsSyncResult {
  candidates: number;
  updated: number;
}

/**
 * Pre-match officials sync (§8 D).
 *
 * Fetches referee assignments from football-data.org for matches scheduled
 * in the next ~48 hours that have no officials yet.
 *
 * Rate limit: 10 req/min (free tier) — 1 API call per run, well within limit.
 * Officials are typically assigned 24-48h before kickoff.
 */
@Injectable()
export class OfficialsSyncService {
  private readonly logger = new Logger(OfficialsSyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly fdClient: FootballDataClient,
  ) {}

  async sync(): Promise<OfficialsSyncResult> {
    const startedAt = new Date();

    // 1. Find scheduled matches in the next 48 hours with no officials yet
    const candidates = await this.loadCandidates();
    this.logger.log(
      `officials sync: ${candidates.length} candidate matches without officials`,
    );

    if (candidates.length === 0) {
      await this.writeSyncLog(startedAt, 'ok', 0, null);
      return { candidates: 0, updated: 0 };
    }

    try {
      // 2. One FD call fetches all WC matches for the next 2 days
      const today = new Date().toISOString().slice(0, 10);
      const dayAfter = new Date(Date.now() + 2 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const raw = await this.fdClient.fetchMatches(today, dayAfter);

      // 3. Index FD matches by pair key (tla is FIFA code, verified 48/48)
      const fdByPair = new Map<string, FDMatch>();
      for (const m of raw.matches) {
        fdByPair.set(pairKey(m.homeTeam.tla, m.awayTeam.tla), m);
      }

      // 4. Resolve team FIFA codes
      const teamRows = await this.db
        .select({ id: teams.id, fifaCode: teams.fifaCode })
        .from(teams);
      const fifaById = new Map(teamRows.map((t) => [t.id, t.fifaCode]));

      let updated = 0;
      for (const c of candidates) {
        const homeFifa = c.homeTeamId
          ? (fifaById.get(c.homeTeamId) ?? null)
          : null;
        const awayFifa = c.awayTeamId
          ? (fifaById.get(c.awayTeamId) ?? null)
          : null;
        if (!homeFifa || !awayFifa) continue;

        const fdMatch = fdByPair.get(pairKey(homeFifa, awayFifa));
        if (!fdMatch || fdMatch.referees.length === 0) continue;

        const officials = normalizeOfficials(fdMatch.referees);
        await this.db
          .update(matches)
          .set({ officials, updatedAt: new Date() })
          .where(eq(matches.id, c.id));
        updated++;
        this.logger.log(
          `officials: updated match ${c.id} (${homeFifa} vs ${awayFifa}) referee=${officials.referee ?? 'unknown'}`,
        );
      }

      await this.writeSyncLog(startedAt, 'ok', updated, null);
      this.logger.log(
        `officials sync done: ${updated}/${candidates.length} matches updated`,
      );
      return { candidates: candidates.length, updated };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.writeSyncLog(startedAt, 'error', 0, message);
      this.logger.error(`officials sync failed: ${message}`);
      throw err;
    }
  }

  private async loadCandidates(): Promise<
    { id: string; homeTeamId: string | null; awayTeamId: string | null }[]
  > {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    return this.db
      .select({
        id: matches.id,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .where(
        and(
          gt(matches.kickoffUtc, now),
          lt(matches.kickoffUtc, in48h),
          eq(matches.status, 'scheduled'),
          sql`${matches.officials} = '{}'::jsonb`,
        ),
      );
  }

  private async writeSyncLog(
    startedAt: Date,
    status: string,
    rowsUpserted: number,
    error: string | null,
  ): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO sync_log (id, source, entity, started_at, finished_at, status, rows_upserted, error)
      VALUES (gen_random_uuid(), 'football-data', 'officials',
              ${startedAt.toISOString()}, ${new Date().toISOString()},
              ${status}, ${rowsUpserted}, ${error})
    `);
  }
}
