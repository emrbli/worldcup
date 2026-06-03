import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const dataSources = pgTable('data_sources', {
  key: text('key').primaryKey(),
  baseUrl: text('base_url'),
  type: text('type'),
  enabled: boolean('enabled').default(true),
  priority: integer('priority'),
});

export const syncLog = pgTable('sync_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source'),
  entity: text('entity'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status'),
  rowsUpserted: integer('rows_upserted'),
  error: text('error'),
});
