import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../lib/db/db.module.js';
import type { DrizzleDb } from '../lib/db/db.module.js';
import { standings, groups, teams } from '../lib/db/schema.js';
import type { StandingsQueryDto } from './dto/standings-query.dto.js';

@Injectable()
export class StandingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(query: StandingsQueryDto) {
    const conditions = [];
    if (query.group) conditions.push(eq(groups.letter, query.group));

    const rows = await this.db
      .select({
        groupId: groups.id,
        groupLetter: groups.letter,
        groupName: groups.name,
        teamId: teams.id,
        teamName: teams.name,
        teamIso2: teams.iso2,
        teamFifaCode: teams.fifaCode,
        rank: standings.rank,
        played: standings.played,
        won: standings.won,
        drawn: standings.drawn,
        lost: standings.lost,
        gf: standings.gf,
        ga: standings.ga,
        gd: standings.gd,
        points: standings.points,
      })
      .from(standings)
      .innerJoin(groups, eq(standings.groupId, groups.id))
      .innerJoin(teams, eq(standings.teamId, teams.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(groups.letter), asc(standings.rank), asc(teams.name));

    // Aggregate into per-group structure
    const groupMap = new Map<
      string,
      {
        group: string;
        name: string | null;
        standings: unknown[];
      }
    >();

    for (const row of rows) {
      const key = row.groupLetter ?? '';
      if (!groupMap.has(key)) {
        groupMap.set(key, { group: key, name: row.groupName, standings: [] });
      }
      groupMap.get(key)!.standings.push({
        rank: row.rank,
        team: {
          id: row.teamId,
          name: row.teamName,
          iso2: row.teamIso2,
          fifaCode: row.teamFifaCode,
        },
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        gf: row.gf,
        ga: row.ga,
        gd: row.gd,
        points: row.points,
      });
    }

    return [...groupMap.values()].sort((a, b) =>
      a.group.localeCompare(b.group),
    );
  }
}
