import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const confederations = pgTable('confederations', {
  code: text('code').primaryKey(),
  name: text('name'),
});

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  letter: char('letter', { length: 1 }).unique(),
  name: text('name'),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  fifaCode: text('fifa_code'),
  iso2: text('iso2'),
  name: text('name'),
  nameI18n: jsonb('name_i18n').$type<Record<string, string>>().default({}),
  confederation: text('confederation').references(() => confederations.code),
  groupId: uuid('group_id').references(() => groups.id),
  isHost: boolean('is_host').default(false),
  fifaRanking: integer('fifa_ranking'),
  logoUrl: text('logo_url'),
  // active | withdrawn | disqualified — resilience for late roster changes.
  status: text('status').default('active'),
  sourceIds: jsonb('source_ids').$type<Record<string, string>>().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  country: text('country'),
  timezone: text('timezone'),
  lat: numeric('lat'),
  lng: numeric('lng'),
});

export const venues = pgTable('venues', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  fifaName: text('fifa_name'),
  cityId: uuid('city_id').references(() => cities.id),
  country: text('country'),
  capacity: integer('capacity'),
  lat: numeric('lat'),
  lng: numeric('lng'),
  imageUrl: text('image_url'),
  sourceIds: jsonb('source_ids').$type<Record<string, string>>().default({}),
});

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchNumber: integer('match_number'),
    stage: text('stage'), // group | r32 | r16 | qf | sf | third | final
    groupId: uuid('group_id').references(() => groups.id),
    matchday: integer('matchday'),
    homeTeamId: uuid('home_team_id').references(() => teams.id),
    awayTeamId: uuid('away_team_id').references(() => teams.id),
    homePlaceholder: text('home_placeholder'),
    awayPlaceholder: text('away_placeholder'),
    venueId: uuid('venue_id').references(() => venues.id),
    kickoffUtc: timestamp('kickoff_utc', { withTimezone: true }),
    // scheduled | live | ht | ft | postponed | awarded | void | abandoned | cancelled
    status: text('status').default('scheduled'),
    // normal | forfeit | walkover | awarded | void — how the result was decided
    resultType: text('result_type').default('normal'),
    // computed | fifa_decision — provenance of a non-normal outcome
    decidedBy: text('decided_by'),
    minute: integer('minute'),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    homeScoreHt: integer('home_score_ht'),
    awayScoreHt: integer('away_score_ht'),
    homePens: integer('home_pens'),
    awayPens: integer('away_pens'),
    // ⭐ referee crew — filled by pre-match officials job (§8 D), not by seed
    officials: jsonb('officials')
      .$type<{
        referee?: string;
        assistants?: string[];
        fourth?: string;
        var?: string;
      }>()
      .default({}),
    sourceIds: jsonb('source_ids').$type<Record<string, string>>().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('matches_kickoff_utc_idx').on(table.kickoffUtc),
    index('matches_status_idx').on(table.status),
  ],
);

export const standings = pgTable(
  'standings',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    played: integer('played').default(0),
    won: integer('won').default(0),
    drawn: integer('drawn').default(0),
    lost: integer('lost').default(0),
    gf: integer('gf').default(0),
    ga: integer('ga').default(0),
    gd: integer('gd').default(0),
    points: integer('points').default(0),
    // fair-play / disciplinary points (yellow/red) — official tiebreaker.
    fairPlayPoints: integer('fair_play_points').default(0),
    // disciplinary/administrative points deduction (e.g. FIFA penalty).
    pointsAdjustment: integer('points_adjustment').default(0),
    rank: integer('rank'),
    // manual rank override when a tie is settled by drawing of lots.
    manualRank: integer('manual_rank'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.teamId] })],
);
