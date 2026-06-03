import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../lib/db/db.module.js';
import type { DrizzleDb } from '../../lib/db/db.module.js';
import { matches, teams } from '../../lib/db/schema.js';

interface MatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

interface TeamStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

/**
 * Recalculates standings for a group from all finished (ft) match results.
 * Triggered by 'standings.recalculate' event or called directly via CLI.
 *
 * Tie-break (MVP): points → gd → gf (FIFA full tie-break in Faz 4).
 */
@Injectable()
export class StandingsCalcService {
  private readonly logger = new Logger(StandingsCalcService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  @OnEvent('standings.recalculate')
  async onRecalculate(event: { groupId: string }): Promise<void> {
    await this.recalculate(event.groupId);
  }

  async recalculate(groupId: string): Promise<void> {
    // 1. Load all finished group matches
    const results = (await this.db
      .select({
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(matches)
      .where(
        and(
          eq(matches.groupId, groupId),
          eq(matches.status, 'ft'),
          isNotNull(matches.homeScore),
          isNotNull(matches.awayScore),
        ),
      )) as MatchResult[];

    if (results.length === 0) return;

    // 2. Load teams in this group
    const groupTeams = await this.db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.groupId, groupId));

    // 3. Accumulate stats
    const statsMap = new Map<string, TeamStats>();
    for (const t of groupTeams) {
      statsMap.set(t.id, {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      });
    }

    for (const r of results) {
      const home = r.homeTeamId ? statsMap.get(r.homeTeamId) : null;
      const away = r.awayTeamId ? statsMap.get(r.awayTeamId) : null;
      const hs = r.homeScore;
      const as_ = r.awayScore;

      if (home) {
        home.played++;
        home.gf += hs;
        home.ga += as_;
        home.gd = home.gf - home.ga;
        if (hs > as_) {
          home.won++;
          home.points += 3;
        } else if (hs === as_) {
          home.drawn++;
          home.points += 1;
        } else {
          home.lost++;
        }
      }
      if (away) {
        away.played++;
        away.gf += as_;
        away.ga += hs;
        away.gd = away.gf - away.ga;
        if (as_ > hs) {
          away.won++;
          away.points += 3;
        } else if (as_ === hs) {
          away.drawn++;
          away.points += 1;
        } else {
          away.lost++;
        }
      }
    }

    // 4. Sort: points DESC → gd DESC → gf DESC
    const sorted = [...statsMap.entries()].sort(([, a], [, b]) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });

    // 5. Upsert standings with rank
    for (let i = 0; i < sorted.length; i++) {
      const [teamId, s] = sorted[i];
      await this.db.execute(sql`
        INSERT INTO standings (group_id, team_id, played, won, drawn, lost, gf, ga, gd, points, rank, updated_at)
        VALUES (${groupId}::uuid, ${teamId}::uuid, ${s.played}, ${s.won}, ${s.drawn}, ${s.lost},
                ${s.gf}, ${s.ga}, ${s.gd}, ${s.points}, ${i + 1}, now())
        ON CONFLICT (group_id, team_id)
        DO UPDATE SET
          played = EXCLUDED.played, won = EXCLUDED.won, drawn = EXCLUDED.drawn,
          lost = EXCLUDED.lost, gf = EXCLUDED.gf, ga = EXCLUDED.ga, gd = EXCLUDED.gd,
          points = EXCLUDED.points, rank = EXCLUDED.rank, updated_at = EXCLUDED.updated_at
      `);
    }

    this.logger.log(
      `standings recalculated for group ${groupId}: ${sorted.length} teams`,
    );
  }

  /** Recalculate all groups (for CLI). */
  async recalculateAll(): Promise<void> {
    const groups = (await this.db.execute(
      sql`SELECT DISTINCT group_id FROM matches WHERE group_id IS NOT NULL`,
    )) as { rows: { group_id: string }[] };

    for (const { group_id } of groups.rows) {
      await this.recalculate(group_id);
    }
    this.logger.log(`standings recalculated for ${groups.rows.length} groups`);
  }
}
