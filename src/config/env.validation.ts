import { z } from 'zod';

const boolFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // WebSocket — optional separate port (fallback if WsAdapter fails on Fastify).
  // When unset, WS runs on the same port as HTTP (default behaviour).
  WS_PORT: z.coerce.number().int().positive().optional(),

  // ── Live score polling (ESPN primary, worldcupjson secondary, FD tertiary) ──
  LIVE_SYNC_ENABLED: boolFlag,
  LIVE_SYNC_CRON: z.string().default('*/1 * * * *'),

  // ── football-data.org token (10 req/min free tier) ──
  // Required at startup (even if officials job is disabled) so we fail fast
  // rather than silently skipping referee data on match day.
  FOOTBALL_DATA_TOKEN: z.string().min(1, 'FOOTBALL_DATA_TOKEN is required'),

  // ── Pre-match officials job (§8 D) — football-data.org referees[] ──
  OFFICIALS_SYNC_ENABLED: boolFlag,
  // Default: hourly — 1 FD call per run, well within 10/min limit
  OFFICIALS_SYNC_CRON: z.string().default('0 * * * *'),

  // ── Pre-match lineups job (§8 E) — ESPN /summary rosters[] ──
  LINEUPS_SYNC_ENABLED: boolFlag,
  LINEUPS_SYNC_CRON: z.string().default('*/5 * * * *'),

  // ── Push notifications (Expo Push API) ──
  PUSH_ENABLED: boolFlag,

  // ── FIFA first-party API (secondary / enrichment — undocumented, see master plan §6) ──
  FIFA_API_BASE_URL: z.string().url().default('https://api.fifa.com/api/v3'),
  FIFA_SEASON_ID: z.string().default('285023'),
  FIFA_SYNC_ENABLED: boolFlag, // default false — enrichment job off by default (Faz 2)
  FIFA_SYNC_CRON: z.string().default('*/5 * * * *'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates raw process.env against the Zod schema.
 * Called by ConfigModule.forRoot({ validate }) — throws on invalid config
 * so the application fails fast at startup with a clear error message.
 */
export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const messages = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${messages}`);
  }
  return result.data;
}
