import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { matches } from './core.js';
import { teams } from './core.js';

// ---------------------------------------------------------------------------
// MODULE 2 — LIVE (match dynamics)
// ---------------------------------------------------------------------------

/**
 * Individual match events: goals, cards, substitutions, VAR reviews.
 * Unique constraint on (match_id, type, minute, team_id) prevents ESPN
 * duplicate pushes from creating duplicate rows.
 */
export const matchEvents = pgTable(
  'match_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // goal|own_goal|penalty|yellow|red|sub|var
    minute: integer('minute'),
    teamId: uuid('team_id').references(() => teams.id),
    playerName: text('player_name'),
    detail: jsonb('detail').$type<Record<string, unknown>>().default({}),
    source: text('source'), // espn|worldcupjson
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('match_events_match_id_idx').on(table.matchId, table.createdAt),
    // Deduplication: same event type at same minute for same team in same match
    unique('match_events_dedup').on(
      table.matchId,
      table.type,
      table.minute,
      table.teamId,
    ),
  ],
);

/**
 * Starting XI and bench for each team — populated ~1h before kickoff (§8 E).
 * Primary key ensures one lineup row per (match, team).
 */
export const matchLineups = pgTable(
  'match_lineups',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    formation: text('formation'),
    players: jsonb('players')
      .$type<
        {
          name: string;
          number: number | null;
          position: string | null;
          starter: boolean;
        }[]
      >()
      .default([]),
  },
  (table) => [primaryKey({ columns: [table.matchId, table.teamId] })],
);

/**
 * Match statistics (possession, shots, passes…) — ⭐ premium-quality data.
 * Primary key ensures one stats row per (match, team).
 */
export const matchStats = pgTable(
  'match_stats',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    stats: jsonb('stats').$type<Record<string, number>>().default({}), // {"possession":54,"shots":12,"on_target":4,...}
  },
  (table) => [primaryKey({ columns: [table.matchId, table.teamId] })],
);
