import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { matches } from './core.js';

/**
 * FIFA /watch broadcast listings — static seed, per-market (country).
 * FIFA = secondary/enrichment.
 */
export const broadcasts = pgTable(
  'broadcasts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    matchId: uuid('match_id').references(() => matches.id),
    scope: text('scope'), // match | tournament
    market: text('market'), // ISO country code — FIFA IdCountryIso3166Alpha2
    channel: text('channel'), // broadcaster name
    kind: text('kind'), // tv | stream
    url: text('url'),
    language: text('language'),
    logoUrl: text('logo_url'),
    sourceIds: jsonb('source_ids').$type<Record<string, string>>().default({}), // { "fifa": IdChannel }
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('broadcasts_market_idx').on(table.market),
    uniqueIndex('broadcasts_match_market_channel_uq').on(
      table.matchId,
      table.market,
      table.channel,
    ),
  ],
);
