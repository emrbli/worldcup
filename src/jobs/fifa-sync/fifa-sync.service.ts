import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../lib/db/db.module.js';
import type { DrizzleDb } from '../../lib/db/db.module.js';
import {
  matches,
  teams,
  standings,
  matchLineups,
  tournamentLeaders,
} from '../../lib/db/schema.js';
import { FifaClient } from '../../adapters/fifa/fifa.client.js';
import { mapCalendar } from '../../adapters/fifa/fifa-calendar.normalize.js';
import { normalizeStandings } from '../../adapters/fifa/fifa-standings.normalize.js';
import { normalizeTopScorers } from '../../adapters/fifa/fifa-leaders.normalize.js';
import { normalizeTimeline } from '../../adapters/fifa/fifa-timeline.normalize.js';
import { normalizeLive } from '../../adapters/fifa/fifa-live.normalize.js';
import type { FifaCalendarResponse } from '../../adapters/fifa/fifa.types.js';

export interface FifaSyncResult {
  standings: number;
  leaders: number;
  events: number;
  lineups: number;
  officials: number;
}

/**
 * FIFA enrichment sync (master plan §8 F — secondary / enrichment, NOT score
 * authority). Run on demand via `pnpm sync:fifa` or by the (default-OFF)
 * scheduler. Each section is independent + writes its own sync_log row, so one
 * failing section never blocks the others.
 *
 * Populates:
 *   • standings        — FIFA group tables → standings (matched by FIFA code)
 *   • tournament_leaders — FIFA topscorers (empty pre-tournament)
 *   • match_events     — FIFA timelines for live/finished matches
 *   • match_lineups + matches.officials — FIFA /live for live matches
 *
 * Rate-limit/backoff/cache live in FifaClient. Calls stay sparse.
 */
@Injectable()
export class FifaSyncService {
  private readonly logger = new Logger(FifaSyncService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly fifa: FifaClient,
  ) {}

  async sync(): Promise<FifaSyncResult> {
    const res: FifaSyncResult = {
      standings: 0,
      leaders: 0,
      events: 0,
      lineups: 0,
      officials: 0,
    };

    const cal = await this.fifa.fetchCalendar();

    await this.safe('standings', () => this.syncStandings(cal, res));
    await this.safe('leaders', () => this.syncLeaders(res));
    await this.safe('match-enrichment', () => this.syncPlayedMatches(cal, res));

    this.logger.log(`fifa sync done: ${JSON.stringify(res)}`);
    return res;
  }

  // ---------------------------------------------------------------------------
  // Standings (FIFA group tables → standings, matched by FIFA code)
  // ---------------------------------------------------------------------------

  private async syncStandings(
    cal: FifaCalendarResponse,
    res: FifaSyncResult,
  ): Promise<void> {
    const startedAt = new Date();
    const teamByCode = await this.loadTeamByFifaCode();

    // Derive distinct (idStage, idGroup) pairs for the group stage from calendar.
    const groups = new Map<string, { idStage: string; idGroup: string }>();
    for (const m of mapCalendar(cal)) {
      if (m.round === 'group' && m.idStage && m.idGroup) {
        groups.set(m.idGroup, { idStage: m.idStage, idGroup: m.idGroup });
      }
    }

    let updated = 0;
    for (const { idStage, idGroup } of groups.values()) {
      const raw = await this.fifa.fetchStanding(idStage, idGroup);
      for (const row of normalizeStandings(raw)) {
        const teamId = row.fifaCode ? teamByCode.get(row.fifaCode) : undefined;
        if (!teamId) continue;
        await this.db
          .update(standings)
          .set({
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            gf: row.gf,
            ga: row.ga,
            gd: row.gd,
            points: row.points,
            rank: row.rank,
            updatedAt: new Date(),
          })
          .where(eq(standings.teamId, teamId));
        updated++;
      }
    }

    res.standings = updated;
    await this.writeSyncLog('standings', startedAt, 'ok', updated, null);
  }

  // ---------------------------------------------------------------------------
  // Top scorers → tournament_leaders (empty pre-tournament)
  // ---------------------------------------------------------------------------

  private async syncLeaders(res: FifaSyncResult): Promise<void> {
    const startedAt = new Date();
    const raw = await this.fifa.fetchTopScorers();
    const rows = normalizeTopScorers(raw);

    if (rows.length === 0) {
      await this.writeSyncLog('leaders', startedAt, 'ok', 0, null);
      return;
    }

    const teamByFifaId = await this.loadTeamByFifaId();
    let upserted = 0;
    for (const r of rows) {
      if (r.rank === null) continue;
      const teamId = r.idTeam ? (teamByFifaId.get(r.idTeam) ?? null) : null;
      await this.db
        .insert(tournamentLeaders)
        .values({
          category: r.category,
          scope: r.scope,
          teamId,
          playerName: r.playerName,
          teamName: r.teamName,
          rank: r.rank,
          value: r.value !== null ? String(r.value) : null,
          source: 'fifa',
          sourceIds: r.idPlayer ? { fifa: r.idPlayer } : {},
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [tournamentLeaders.category, tournamentLeaders.rank],
          set: {
            teamId,
            playerName: r.playerName,
            teamName: r.teamName,
            value: r.value !== null ? String(r.value) : null,
            updatedAt: new Date(),
          },
        });
      upserted++;
    }

    res.leaders = upserted;
    await this.writeSyncLog('leaders', startedAt, 'ok', upserted, null);
  }

  // ---------------------------------------------------------------------------
  // Timelines + live (only for live / finished matches → none pre-tournament)
  // ---------------------------------------------------------------------------

  private async syncPlayedMatches(
    cal: FifaCalendarResponse,
    res: FifaSyncResult,
  ): Promise<void> {
    const startedAt = new Date();

    // idMatch → idStage from the calendar (needed for timeline/live URLs).
    const stageByMatch = new Map<string, string>();
    for (const m of mapCalendar(cal)) {
      if (m.idStage) stageByMatch.set(m.idMatch, m.idStage);
    }

    // Our matches that are live/finished and carry a FIFA id.
    const rows = await this.db
      .select({
        id: matches.id,
        status: matches.status,
        sourceIds: matches.sourceIds,
      })
      .from(matches);
    const played = rows.filter(
      (r) =>
        (r.status === 'live' || r.status === 'ht' || r.status === 'ft') &&
        r.sourceIds?.fifa,
    );

    if (played.length === 0) {
      await this.writeSyncLog('timeline', startedAt, 'ok', 0, null);
      return;
    }

    const teamByFifaId = await this.loadTeamByFifaId();
    let events = 0;
    let lineups = 0;
    let officials = 0;

    for (const m of played) {
      const idMatch = m.sourceIds!.fifa;
      const idStage = stageByMatch.get(idMatch);
      if (!idStage) continue;

      // Timeline → match_events (dedup on match_id+type+minute+team_id)
      const tl = await this.fifa.fetchTimeline(idStage, idMatch);
      for (const ev of normalizeTimeline(tl)) {
        const teamId = ev.fifaIdTeam
          ? (teamByFifaId.get(ev.fifaIdTeam) ?? null)
          : null;
        const result = (await this.db.execute(sql`
          INSERT INTO match_events (id, match_id, type, minute, team_id, player_name, detail, source, created_at)
          VALUES (gen_random_uuid(), ${m.id}, ${ev.type}, ${ev.minute}, ${teamId},
                  ${ev.playerName}, ${JSON.stringify(ev.detail)}::jsonb, 'fifa', now())
          ON CONFLICT (match_id, type, minute, team_id) DO NOTHING
          RETURNING id
        `)) as { rows: { id: string }[] };
        if (result.rows.length > 0) events++;
      }

      // Live → lineups + officials
      const live = normalizeLive(await this.fifa.fetchLive(idStage, idMatch));
      for (const lu of live.lineups) {
        const teamId = teamByFifaId.get(lu.fifaIdTeam);
        if (!teamId) continue;
        // FIFA live player shape is unverified (no live match observed yet) —
        // store raw as the jsonb column type. Provisional; revisit on first live match.
        const players =
          lu.players as (typeof matchLineups.$inferInsert)['players'];
        await this.db
          .insert(matchLineups)
          .values({ matchId: m.id, teamId, formation: lu.formation, players })
          .onConflictDoUpdate({
            target: [matchLineups.matchId, matchLineups.teamId],
            set: { formation: lu.formation, players },
          });
        lineups++;
      }
      if (Object.keys(live.officials).length > 0) {
        await this.db
          .update(matches)
          .set({ officials: live.officials, updatedAt: new Date() })
          .where(eq(matches.id, m.id));
        officials++;
      }
    }

    res.events = events;
    res.lineups = lineups;
    res.officials = officials;
    await this.writeSyncLog(
      'timeline',
      startedAt,
      'ok',
      events + lineups + officials,
      null,
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Wrap a section so one failure logs + records, but never aborts the rest. */
  private async safe(label: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`fifa sync section "${label}" failed: ${message}`);
      await this.writeSyncLog(label, new Date(), 'error', 0, message);
    }
  }

  private async loadTeamByFifaCode(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ id: teams.id, fifaCode: teams.fifaCode })
      .from(teams);
    const map = new Map<string, string>();
    for (const r of rows) if (r.fifaCode) map.set(r.fifaCode, r.id);
    return map;
  }

  private async loadTeamByFifaId(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ id: teams.id, sourceIds: teams.sourceIds })
      .from(teams);
    const map = new Map<string, string>();
    for (const r of rows) {
      const f = r.sourceIds?.fifa;
      if (f) map.set(f, r.id);
    }
    return map;
  }

  private async writeSyncLog(
    entity: string,
    startedAt: Date,
    status: string,
    rowsUpserted: number,
    error: string | null,
  ): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO sync_log (id, source, entity, started_at, finished_at, status, rows_upserted, error)
      VALUES (gen_random_uuid(), 'fifa', ${entity},
              ${startedAt.toISOString()}, ${new Date().toISOString()},
              ${status}, ${rowsUpserted}, ${error})
    `);
  }
}
