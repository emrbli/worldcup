import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { teams, matches, cities, venues } from './core.js';

// ---------------------------------------------------------------------------
// MODULE 4 — CONTENT (enrichment data — most from wc26-mcp MIT dataset)
// ⭐ = premium-tier value; backend serves all data gating-free (app-side gate)
// ---------------------------------------------------------------------------

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id),
  name: text('name').notNull(),
  position: text('position'),
  number: integer('number'),
  club: text('club'),
  // Enriched from football-data.org squads (full ~26-man rosters).
  dateOfBirth: text('date_of_birth'), // ISO 'YYYY-MM-DD'
  nationality: text('nationality'),
  sourceIds: jsonb('source_ids').$type<Record<string, string>>().default({}),
});

/**
 * Team profile — coach, style, key players, WC history.
 * Source: wc26-mcp (MIT). One row per team; PK = team_id.
 */
export const teamProfiles = pgTable('team_profiles', {
  teamId: uuid('team_id')
    .primaryKey()
    .references(() => teams.id),
  coach: text('coach'),
  coachNationality: text('coach_nationality'),
  style: text('style'),
  keyPlayers: jsonb('key_players')
    .$type<{ name: string; position: string; club: string }[]>()
    .default([]),
  wcHistory: text('wc_history'),
  qualifyingSummary: text('qualifying_summary'),
});

/**
 * City guide — highlights, transit, food, activities.
 * Source: wc26-mcp (MIT). Keyed by city_id; also stores venue_id from source.
 */
export const cityGuides = pgTable('city_guides', {
  cityId: uuid('city_id')
    .primaryKey()
    .references(() => cities.id),
  // wc26-mcp venue_id for reference (e.g. "metlife")
  sourceVenueId: text('source_venue_id'),
  highlights: jsonb('highlights').$type<string[]>().default([]),
  gettingThere: jsonb('getting_there')
    .$type<Record<string, unknown>>()
    .default({}),
  foodAndDrink: jsonb('food_and_drink')
    .$type<Record<string, unknown>>()
    .default({}),
  thingsToDo: jsonb('things_to_do').$type<string[]>().default([]),
  localTips: jsonb('local_tips').$type<string[]>().default([]),
});

/**
 * Fan zones — official FIFA fan festivals per city.
 * Source: wc26-mcp (MIT).
 */
export const fanZones = pgTable('fan_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id').references(() => cities.id),
  venueId: uuid('venue_id').references(() => venues.id),
  name: text('name'),
  address: text('address'),
  capacity: integer('capacity'),
  hours: text('hours'),
  activities: jsonb('activities').$type<string[]>().default([]),
  transportation: text('transportation'),
  freeEntry: boolean('free_entry').default(true),
  lat: numeric('lat'),
  lng: numeric('lng'),
  sourceId: text('source_id'), // wc26-mcp id
});

/**
 * Visa requirements — entry requirements per nationality for each host country.
 * Source: wc26-mcp (MIT).
 */
export const visaInfo = pgTable('visa_info', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id),
  nationality: text('nationality'),
  passportCountry: text('passport_country'),
  entryRequirements: jsonb('entry_requirements')
    .$type<Record<string, unknown>>()
    .default({}),
});

/**
 * Historical H2H matchups between World Cup 2026 teams.
 * Source: wc26-mcp (MIT). One row per pair (team_a < team_b for consistency).
 */
export const historicalMatchups = pgTable('historical_matchups', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamAId: uuid('team_a_id').references(() => teams.id),
  teamBId: uuid('team_b_id').references(() => teams.id),
  totalMatches: integer('total_matches').default(0),
  teamAWins: integer('team_a_wins').default(0),
  draws: integer('draws').default(0),
  teamBWins: integer('team_b_wins').default(0),
  totalGoalsTeamA: integer('total_goals_team_a').default(0),
  totalGoalsTeamB: integer('total_goals_team_b').default(0),
  summary: text('summary'),
  aggregate: jsonb('aggregate').$type<Record<string, unknown>>().default({}),
});

/**
 * News articles — from wc26-mcp embedded dataset + optional RSS crawler.
 */
export const news = pgTable('news', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title'),
  url: text('url'),
  source: text('source'),
  summary: text('summary'),
  imageUrl: text('image_url'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  categories: jsonb('categories').$type<string[]>().default([]),
  relatedTeams: jsonb('related_teams').$type<string[]>().default([]),
  sourceId: text('source_id'), // wc26-mcp id or RSS guid (for dedup)
});

/**
 * Odds — tournament-level or match-level betting lines.
 * Source: wc26-mcp (illustrative, not live). Updated by crawler when live odds needed.
 */
export const odds = pgTable('odds', {
  id: uuid('id').primaryKey().defaultRandom(),
  scope: text('scope'), // tournament | match
  matchId: uuid('match_id').references(() => matches.id),
  market: text('market'), // tournament_winner | match_winner | over_under
  selection: text('selection'), // team name or "over/under"
  value: text('value'), // "+400" or "1.75"
  impliedProbability: text('implied_probability'),
  bookmaker: text('bookmaker'),
  source: text('source'), // wc26-mcp | the_odds_api
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/**
 * Tournament leaders — topscorers / assists / team-stat leaders.
 * Source: FIFA first-party API (secondary/enrichment). Idempotent seed keyed
 * on (category, rank).
 */
export const tournamentLeaders = pgTable(
  'tournament_leaders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: text('category'), // topscorers | assists | team_goals | ...
    scope: text('scope'), // player | team
    teamId: uuid('team_id').references(() => teams.id),
    playerId: uuid('player_id').references(() => players.id),
    playerName: text('player_name'),
    teamName: text('team_name'),
    rank: integer('rank'),
    value: numeric('value'),
    detail: jsonb('detail').$type<Record<string, unknown>>().default({}),
    source: text('source'), // fifa
    sourceIds: jsonb('source_ids').$type<Record<string, string>>().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('tournament_leaders_category_rank_uq').on(
      table.category,
      table.rank,
    ),
  ],
);
