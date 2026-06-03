import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../lib/db/db.module.js';
import type { DrizzleDb } from '../lib/db/db.module.js';
import { groups, teams } from '../lib/db/schema.js';

@Injectable()
export class GroupsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll() {
    const rows = await this.db
      .select({
        groupId: groups.id,
        groupLetter: groups.letter,
        groupName: groups.name,
        teamId: teams.id,
        teamName: teams.name,
        teamFifaCode: teams.fifaCode,
        teamIso2: teams.iso2,
        teamIsHost: teams.isHost,
      })
      .from(groups)
      .leftJoin(teams, eq(teams.groupId, groups.id))
      .orderBy(groups.letter, teams.name);

    // Aggregate teams under their group
    const groupMap = new Map<
      string,
      {
        id: string;
        letter: string;
        name: string | null;
        teams: {
          id: string;
          name: string | null;
          fifaCode: string | null;
          iso2: string | null;
          isHost: boolean | null;
        }[];
      }
    >();

    for (const row of rows) {
      if (!groupMap.has(row.groupId)) {
        groupMap.set(row.groupId, {
          id: row.groupId,
          letter: row.groupLetter ?? '',
          name: row.groupName,
          teams: [],
        });
      }
      if (row.teamId) {
        groupMap.get(row.groupId)!.teams.push({
          id: row.teamId,
          name: row.teamName,
          fifaCode: row.teamFifaCode,
          iso2: row.teamIso2,
          isHost: row.teamIsHost,
        });
      }
    }

    return [...groupMap.values()].sort((a, b) =>
      a.letter.localeCompare(b.letter),
    );
  }
}
