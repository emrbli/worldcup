import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../lib/db/db.module.js';
import type { DrizzleDb } from '../lib/db/db.module.js';
import { matches, teams, venues } from '../lib/db/schema.js';

const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];

@Injectable()
export class BracketService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async getBracket() {
    const homeTeam = alias(teams, 'home_team');
    const awayTeam = alias(teams, 'away_team');

    const rows = await this.db
      .select({
        id: matches.id,
        matchNumber: matches.matchNumber,
        stage: matches.stage,
        kickoffUtc: matches.kickoffUtc,
        status: matches.status,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        homeTeamIso2: homeTeam.iso2,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        awayTeamIso2: awayTeam.iso2,
        homePlaceholder: matches.homePlaceholder,
        awayPlaceholder: matches.awayPlaceholder,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homePens: matches.homePens,
        awayPens: matches.awayPens,
        venueName: venues.name,
      })
      .from(matches)
      .leftJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .leftJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
      .leftJoin(venues, eq(matches.venueId, venues.id))
      .where(ne(matches.stage, 'group'))
      .orderBy(asc(matches.matchNumber));

    const byRound: Record<string, unknown[]> = {};
    for (const r of ROUND_ORDER) byRound[r] = [];

    for (const row of rows) {
      const stage = row.stage ?? 'unknown';
      if (!byRound[stage]) byRound[stage] = [];
      byRound[stage].push({
        id: row.id,
        matchNumber: row.matchNumber,
        kickoffUtc: row.kickoffUtc,
        status: row.status,
        homeTeam: row.homeTeamId
          ? {
              id: row.homeTeamId,
              name: row.homeTeamName,
              iso2: row.homeTeamIso2,
            }
          : null,
        awayTeam: row.awayTeamId
          ? {
              id: row.awayTeamId,
              name: row.awayTeamName,
              iso2: row.awayTeamIso2,
            }
          : null,
        homePlaceholder: row.homePlaceholder,
        awayPlaceholder: row.awayPlaceholder,
        score:
          row.status !== 'scheduled'
            ? {
                home: row.homeScore,
                away: row.awayScore,
                homePens: row.homePens,
                awayPens: row.awayPens,
              }
            : null,
        venue: row.venueName,
      });
    }

    return byRound;
  }
}
