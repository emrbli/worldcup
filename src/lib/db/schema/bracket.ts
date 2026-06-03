import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { matches, teams } from './core.js';

// ---------------------------------------------------------------------------
// MODULE 3 — BRACKET (knockout stage structure)
// Populated once from openfootball data; match_id links to the actual match.
// home_source / away_source track which slot feeds into this position
// (e.g. "1A", "Winner M73", "3A/B/C/D/F") until teams are determined.
// ---------------------------------------------------------------------------

export const bracketSlots = pgTable('bracket_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  round: text('round'), // r32 | r16 | qf | sf | third | final
  position: integer('position'), // match_number within the round
  matchId: uuid('match_id').references(() => matches.id),
  homeSource: text('home_source'), // "2A" / "Winner M73"
  awaySource: text('away_source'),
  // Manual override of the computed advancing team (e.g. FIFA decision / kura).
  overrideWinnerTeamId: uuid('override_winner_team_id').references(
    () => teams.id,
  ),
});
