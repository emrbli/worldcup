import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../lib/db/db.module.js';
import type { DrizzleDb } from '../../lib/db/db.module.js';
import { matches, teams, matchLineups } from '../../lib/db/schema.js';
import { EspnSummaryClient } from '../../adapters/espn/espn.summary-client.js';
import { normalizeEspnLineups } from '../../adapters/espn/espn-lineups.normalize.js';

export interface LineupsSyncResult {
  candidates: number;
  updated: number;
}

/**
 * Pre-match lineups sync (§8 E).
 *
 * Fetches starting XI from ESPN /summary for matches kicking off
 * in the next ~1 hour that have no lineups yet.
 * ESPN publishes lineups typically ~1h before kickoff.
 */
@Injectable()
export class LineupsSyncService {
  private readonly logger = new Logger(LineupsSyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly espnSummary: EspnSummaryClient,
  ) {}

  async sync(): Promise<LineupsSyncResult> {
    const startedAt = new Date();
    const candidates = await this.loadCandidates();
    this.logger.log(
      `lineups sync: ${candidates.length} candidate matches without lineups`,
    );

    if (candidates.length === 0) {
      await this.writeSyncLog(startedAt, 'ok', 0, null);
      return { candidates: 0, updated: 0 };
    }

    // Build teamFifa → teamId map
    const teamRows = await this.db
      .select({ id: teams.id, fifaCode: teams.fifaCode })
      .from(teams);
    const teamByFifa = new Map(
      teamRows.filter((t) => t.fifaCode).map((t) => [t.fifaCode!, t.id]),
    );

    let updated = 0;
    for (const c of candidates) {
      const espnId = c.sourceIds?.espn;
      if (!espnId) {
        this.logger.warn(
          `lineups: match ${c.id} has no ESPN source id, skipping`,
        );
        continue;
      }
      try {
        const summary = await this.espnSummary.fetchSummary(espnId);
        const lineups = normalizeEspnLineups(summary);

        if (lineups.length === 0) {
          this.logger.debug(`lineups: no roster data yet for match ${c.id}`);
          continue;
        }

        for (const lineup of lineups) {
          const teamId = teamByFifa.get(lineup.teamFifa);
          if (!teamId) {
            this.logger.warn(`lineups: unknown FIFA code ${lineup.teamFifa}`);
            continue;
          }
          await this.db.execute(sql`
            INSERT INTO match_lineups (match_id, team_id, formation, players)
            VALUES (${c.id}, ${teamId}, ${lineup.formation}, ${JSON.stringify(lineup.players)}::jsonb)
            ON CONFLICT (match_id, team_id)
            DO UPDATE SET formation = EXCLUDED.formation, players = EXCLUDED.players
          `);
          updated++;
        }
        this.logger.log(
          `lineups: stored ${lineups.length} lineups for match ${c.id}`,
        );
      } catch (err) {
        this.logger.warn(
          `lineups: failed for match ${c.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await this.writeSyncLog(startedAt, 'ok', updated, null);
    return { candidates: candidates.length, updated };
  }

  private async loadCandidates(): Promise<
    { id: string; sourceIds: Record<string, string> | null }[]
  > {
    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);

    // Matches that already have lineups (both teams)
    const withLineups = await this.db
      .selectDistinct({ matchId: matchLineups.matchId })
      .from(matchLineups);
    const lineupMatchIds = withLineups.map((r) => r.matchId);

    const query = this.db
      .select({ id: matches.id, sourceIds: matches.sourceIds })
      .from(matches)
      .where(
        and(
          gt(matches.kickoffUtc, now),
          lt(matches.kickoffUtc, in1h),
          eq(matches.status, 'scheduled'),
        ),
      );

    const rows = await query;
    return lineupMatchIds.length > 0
      ? rows.filter((r) => !lineupMatchIds.includes(r.id))
      : rows;
  }

  private async writeSyncLog(
    startedAt: Date,
    status: string,
    rowsUpserted: number,
    error: string | null,
  ): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO sync_log (id, source, entity, started_at, finished_at, status, rows_upserted, error)
      VALUES (gen_random_uuid(), 'espn', 'lineups',
              ${startedAt.toISOString()}, ${new Date().toISOString()},
              ${status}, ${rowsUpserted}, ${error})
    `);
  }
}
