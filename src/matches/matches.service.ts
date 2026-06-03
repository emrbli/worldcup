import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../lib/db/db.module.js';
import type { DrizzleDb } from '../lib/db/db.module.js';
import {
  matches,
  teams,
  groups,
  venues,
  matchEvents,
  matchLineups,
} from '../lib/db/schema.js';
import type { MatchQueryDto } from './dto/match-query.dto.js';

const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

@Injectable()
export class MatchesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(query: MatchQueryDto) {
    const conditions: SQL[] = [];

    if (query.stage) conditions.push(eq(matches.stage, query.stage));
    if (query.status) conditions.push(eq(matches.status, query.status));

    if (query.group) {
      const [group] = await this.db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.letter, query.group));
      if (group) conditions.push(eq(matches.groupId, group.id));
    }

    // Date filter — resolve 'today' to current UTC date
    const dateStr = query.today
      ? new Date().toISOString().slice(0, 10)
      : query.date;

    if (dateStr) {
      const start = new Date(`${dateStr}T00:00:00Z`);
      const end = new Date(`${dateStr}T23:59:59.999Z`);
      conditions.push(gte(matches.kickoffUtc, start));
      conditions.push(lte(matches.kickoffUtc, end));
    }

    const rows = await this.db
      .select({
        id: matches.id,
        matchNumber: matches.matchNumber,
        stage: matches.stage,
        matchday: matches.matchday,
        kickoffUtc: matches.kickoffUtc,
        status: matches.status,
        minute: matches.minute,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homeScoreHt: matches.homeScoreHt,
        awayScoreHt: matches.awayScoreHt,
        homePens: matches.homePens,
        awayPens: matches.awayPens,
        homePlaceholder: matches.homePlaceholder,
        awayPlaceholder: matches.awayPlaceholder,
        groupLetter: groups.letter,
        homeTeamId: homeTeam.id,
        homeTeamName: homeTeam.name,
        homeTeamIso2: homeTeam.iso2,
        awayTeamId: awayTeam.id,
        awayTeamName: awayTeam.name,
        awayTeamIso2: awayTeam.iso2,
        venueName: venues.name,
        venueId: venues.id,
      })
      .from(matches)
      .leftJoin(groups, eq(matches.groupId, groups.id))
      .leftJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .leftJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id))
      .leftJoin(venues, eq(matches.venueId, venues.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(matches.kickoffUtc, matches.matchNumber);

    return rows.map((r) => ({
      id: r.id,
      matchNumber: r.matchNumber,
      stage: r.stage,
      group: r.groupLetter ?? null,
      matchday: r.matchday,
      kickoffUtc: r.kickoffUtc,
      status: r.status,
      minute: r.minute,
      homeTeam: r.homeTeamId
        ? { id: r.homeTeamId, name: r.homeTeamName, iso2: r.homeTeamIso2 }
        : null,
      awayTeam: r.awayTeamId
        ? { id: r.awayTeamId, name: r.awayTeamName, iso2: r.awayTeamIso2 }
        : null,
      homePlaceholder: r.homePlaceholder,
      awayPlaceholder: r.awayPlaceholder,
      score: {
        home: r.homeScore,
        away: r.awayScore,
        homeHt: r.homeScoreHt,
        awayHt: r.awayScoreHt,
        homePens: r.homePens,
        awayPens: r.awayPens,
      },
      venue: r.venueId ? { id: r.venueId, name: r.venueName } : null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Single match detail
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const homeTeamAlias = alias(teams, 'home_team');
    const awayTeamAlias = alias(teams, 'away_team');

    const [row] = await this.db
      .select({
        id: matches.id,
        matchNumber: matches.matchNumber,
        stage: matches.stage,
        matchday: matches.matchday,
        kickoffUtc: matches.kickoffUtc,
        status: matches.status,
        minute: matches.minute,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        homeScoreHt: matches.homeScoreHt,
        awayScoreHt: matches.awayScoreHt,
        homePens: matches.homePens,
        awayPens: matches.awayPens,
        homePlaceholder: matches.homePlaceholder,
        awayPlaceholder: matches.awayPlaceholder,
        officials: matches.officials,
        groupLetter: groups.letter,
        homeTeamId: homeTeamAlias.id,
        homeTeamName: homeTeamAlias.name,
        homeTeamIso2: homeTeamAlias.iso2,
        homeTeamFifa: homeTeamAlias.fifaCode,
        awayTeamId: awayTeamAlias.id,
        awayTeamName: awayTeamAlias.name,
        awayTeamIso2: awayTeamAlias.iso2,
        awayTeamFifa: awayTeamAlias.fifaCode,
        venueId: venues.id,
        venueName: venues.name,
      })
      .from(matches)
      .leftJoin(groups, eq(matches.groupId, groups.id))
      .leftJoin(homeTeamAlias, eq(matches.homeTeamId, homeTeamAlias.id))
      .leftJoin(awayTeamAlias, eq(matches.awayTeamId, awayTeamAlias.id))
      .leftJoin(venues, eq(matches.venueId, venues.id))
      .where(eq(matches.id, id));

    if (!row) return null;

    return {
      id: row.id,
      matchNumber: row.matchNumber,
      stage: row.stage,
      group: row.groupLetter ?? null,
      matchday: row.matchday,
      kickoffUtc: row.kickoffUtc,
      status: row.status,
      minute: row.minute,
      homeTeam: row.homeTeamId
        ? {
            id: row.homeTeamId,
            name: row.homeTeamName,
            iso2: row.homeTeamIso2,
            fifaCode: row.homeTeamFifa,
          }
        : null,
      awayTeam: row.awayTeamId
        ? {
            id: row.awayTeamId,
            name: row.awayTeamName,
            iso2: row.awayTeamIso2,
            fifaCode: row.awayTeamFifa,
          }
        : null,
      homePlaceholder: row.homePlaceholder,
      awayPlaceholder: row.awayPlaceholder,
      score: {
        home: row.homeScore,
        away: row.awayScore,
        homeHt: row.homeScoreHt,
        awayHt: row.awayScoreHt,
        homePens: row.homePens,
        awayPens: row.awayPens,
      },
      officials: row.officials ?? {},
      venue: row.venueId ? { id: row.venueId, name: row.venueName } : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Match events (goal/card ticker)
  // ---------------------------------------------------------------------------

  async findEvents(matchId: string) {
    const evTeam = alias(teams, 'ev_team');
    const rows = await this.db
      .select({
        id: matchEvents.id,
        type: matchEvents.type,
        minute: matchEvents.minute,
        playerName: matchEvents.playerName,
        detail: matchEvents.detail,
        source: matchEvents.source,
        createdAt: matchEvents.createdAt,
        teamFifa: evTeam.fifaCode,
        teamIso2: evTeam.iso2,
        teamName: evTeam.name,
      })
      .from(matchEvents)
      .leftJoin(evTeam, eq(matchEvents.teamId, evTeam.id))
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt));

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      minute: r.minute,
      playerName: r.playerName,
      detail: r.detail,
      source: r.source,
      createdAt: r.createdAt,
      team: r.teamFifa
        ? { fifaCode: r.teamFifa, iso2: r.teamIso2, name: r.teamName }
        : null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Match lineups
  // ---------------------------------------------------------------------------

  async findLineups(matchId: string) {
    // Get the match to determine home/away team IDs
    const [match] = await this.db
      .select({
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
      })
      .from(matches)
      .where(eq(matches.id, matchId));

    const lineupTeam = alias(teams, 'lineup_team');
    const rows = await this.db
      .select({
        teamId: matchLineups.teamId,
        formation: matchLineups.formation,
        players: matchLineups.players,
        teamName: lineupTeam.name,
        teamFifa: lineupTeam.fifaCode,
        teamIso2: lineupTeam.iso2,
      })
      .from(matchLineups)
      .leftJoin(lineupTeam, eq(matchLineups.teamId, lineupTeam.id))
      .where(eq(matchLineups.matchId, matchId));

    return rows.map((r) => ({
      side: match ? (r.teamId === match.homeTeamId ? 'home' : 'away') : null,
      team: {
        id: r.teamId,
        name: r.teamName,
        fifaCode: r.teamFifa,
        iso2: r.teamIso2,
      },
      formation: r.formation,
      players: r.players,
    }));
  }
}
