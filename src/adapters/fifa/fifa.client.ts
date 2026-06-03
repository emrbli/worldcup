import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation.js';
import type {
  FifaCalendarResponse,
  FifaLiveResponse,
  FifaStandingResponse,
  FifaTeam,
  FifaTimelineResponse,
  FifaTopScorersResponse,
  FifaWatchResponse,
} from './fifa.types.js';

/** Competition id is fixed for the FIFA World Cup. */
const ID_COMPETITION = '17';

/** In-memory cache TTL: short, just to dedupe bursts within a sync run. */
const CACHE_TTL_MS = 60_000;
/** Minimum gap between outbound requests (politeness / soft rate-limit). */
const MIN_INTERVAL_MS = 250;
/** Retry budget for 429 / 5xx. */
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 500;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

/**
 * Thin HTTP client for the FIFA first-party API (undocumented; see §6).
 * Knows nothing about our domain — fetches and returns raw JSON.
 *
 * Net-new vs ESPN client (FIFA is rate-sensitive & undocumented):
 *   (a) tiny 60s in-memory TTL cache keyed by URL,
 *   (b) a single in-flight chain + min-interval gate (≥250ms between calls),
 *   (c) exponential backoff retry on HTTP 429 / 5xx.
 * No new npm dependency — all built from native fetch + timers.
 */
@Injectable()
export class FifaClient {
  private readonly logger = new Logger(FifaClient.name);

  private readonly baseUrl: string;
  private readonly seasonId: string;

  /** TTL cache keyed by full URL. */
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  /** Serialises requests so the min-interval gate is honoured. */
  private chain: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.baseUrl = this.config
      .get('FIFA_API_BASE_URL', { infer: true })
      .replace(/\/+$/, '');
    this.seasonId = this.config.get('FIFA_SEASON_ID', { infer: true });
  }

  // ---------------------------------------------------------------------------
  // Public endpoints
  // ---------------------------------------------------------------------------

  /** Full calendar (all 104 matches). */
  async fetchCalendar(): Promise<FifaCalendarResponse> {
    const url = `${this.baseUrl}/calendar/matches?idSeason=${this.seasonId}&count=500&language=en`;
    return this.get<FifaCalendarResponse>(url, 'calendar');
  }

  /** Broadcasters per market. */
  async fetchWatch(): Promise<FifaWatchResponse> {
    const url = `${this.baseUrl}/watch/season/${this.seasonId}`;
    return this.get<FifaWatchResponse>(url, 'watch');
  }

  /** Group standings for a stage (optionally a single group). */
  async fetchStanding(
    idStage: string,
    idGroup?: string,
  ): Promise<FifaStandingResponse> {
    let url = `${this.baseUrl}/calendar/${ID_COMPETITION}/${this.seasonId}/${idStage}/Standing`;
    if (idGroup) url += `?idGroup=${idGroup}`;
    return this.get<FifaStandingResponse>(url);
  }

  /** Match timeline (events). Empty pre-tournament. */
  async fetchTimeline(
    idStage: string,
    idMatch: string,
  ): Promise<FifaTimelineResponse> {
    const url = `${this.baseUrl}/timelines/${ID_COMPETITION}/${this.seasonId}/${idStage}/${idMatch}`;
    return this.get<FifaTimelineResponse>(url);
  }

  /** Live match payload — null when no live match. */
  async fetchLive(
    idStage: string,
    idMatch: string,
  ): Promise<FifaLiveResponse | null> {
    const url = `${this.baseUrl}/live/football/${ID_COMPETITION}/${this.seasonId}/${idStage}/${idMatch}`;
    return this.get<FifaLiveResponse | null>(url);
  }

  /** Top scorers — null pre-tournament. */
  async fetchTopScorers(): Promise<FifaTopScorersResponse | null> {
    const url = `${this.baseUrl}/topseasonplayerstatistics/season/${this.seasonId}/topscorers`;
    return this.get<FifaTopScorersResponse | null>(url);
  }

  /**
   * Team-statistic leaderboard by stat type (e.g. "goals", "assists").
   * NOTE: this endpoint 404s pre-tournament — best-effort, kept for §3 wiring.
   */
  async fetchTeamStats(statType: string): Promise<unknown> {
    const url = `${this.baseUrl}/topseasonteamstatistics/season/${this.seasonId}/${statType}`;
    return this.get<unknown>(url);
  }

  /** Single team profile. */
  async fetchTeam(idTeam: string): Promise<FifaTeam> {
    const url = `${this.baseUrl}/teams/${idTeam}`;
    return this.get<FifaTeam>(url);
  }

  // ---------------------------------------------------------------------------
  // Core: cache + serialised gate + backoff retry
  // ---------------------------------------------------------------------------

  /**
   * Single entry point for all GETs.
   *  (a) returns a fresh cached value when present (60s TTL),
   *  (b) serialises every request through one promise chain and enforces a
   *      ≥250ms gap between outbound calls,
   *  (c) retries 429/5xx with exponential backoff (3 tries, 500ms·2^n).
   * Throws on a non-retryable !res.ok response (mirrors ESPN client).
   */
  private async get<T>(url: string, cacheKey?: string): Promise<T> {
    const key = cacheKey ?? url;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    // Serialise: append this request to the chain so only one runs at a time
    // and the min-interval gate is respected across concurrent callers.
    const run = this.chain.then(() => this.fetchWithBackoff<T>(url));
    // Keep the chain alive regardless of this request's success/failure.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );

    const value = await run;
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /** Enforces the min-interval gate, then fetches with backoff retry. */
  private async fetchWithBackoff<T>(url: string): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await this.respectInterval();

      let res: Response;
      try {
        res = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        // Network/timeout — retry with backoff.
        lastError = err;
        await this.backoff(attempt);
        continue;
      }

      if (res.ok) {
        return res.json() as Promise<T>;
      }

      // Retry only transient statuses (429 + 5xx); fail fast otherwise.
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(
          `FIFA fetch ${res.status} ${res.statusText} (${url})`,
        );
        this.logger.warn(
          `FIFA transient ${res.status} on ${url} (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await this.backoff(attempt);
        continue;
      }

      throw new Error(`FIFA fetch failed: ${res.status} ${res.statusText}`);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`FIFA fetch failed after ${MAX_RETRIES} retries: ${url}`);
  }

  /** Blocks until at least MIN_INTERVAL_MS has passed since the last call. */
  private async respectInterval(): Promise<void> {
    const wait = this.lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await delay(wait);
    this.lastRequestAt = Date.now();
  }

  /** Exponential backoff: 500ms · 2^attempt. */
  private async backoff(attempt: number): Promise<void> {
    await delay(BACKOFF_BASE_MS * 2 ** attempt);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
