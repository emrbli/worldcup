import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../lib/db/db.module.js';
import type { DrizzleDb } from '../lib/db/db.module.js';
import { teams, groups } from '../lib/db/schema.js';
import type { TeamQueryDto } from './dto/team-query.dto.js';

@Injectable()
export class TeamsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findAll(query: TeamQueryDto) {
    const conditions = [];

    if (query.group) {
      const [group] = await this.db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.letter, query.group));
      if (group) conditions.push(eq(teams.groupId, group.id));
    }

    if (query.confederation) {
      conditions.push(eq(teams.confederation, query.confederation));
    }

    const rows = await this.db
      .select({
        id: teams.id,
        name: teams.name,
        fifaCode: teams.fifaCode,
        iso2: teams.iso2,
        confederation: teams.confederation,
        groupId: teams.groupId,
        groupLetter: groups.letter,
        isHost: teams.isHost,
        fifaRanking: teams.fifaRanking,
        nameI18n: teams.nameI18n,
      })
      .from(teams)
      .leftJoin(groups, eq(teams.groupId, groups.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(groups.letter, teams.name);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      fifaCode: r.fifaCode,
      iso2: r.iso2,
      confederation: r.confederation,
      group: r.groupLetter ?? null,
      isHost: r.isHost,
      fifaRanking: r.fifaRanking,
      nameI18n: r.nameI18n,
    }));
  }
}
