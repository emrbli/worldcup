import type { NormalizedMatchUpdate } from '../adapters/espn/espn.types.js';

/**
 * Port (interface) for live-score adapters.
 * Each data source (ESPN, worldcupjson, football-data) implements this.
 * LiveScoreService tries adapters in priority order; lower number = higher priority.
 */
export interface LiveScorePort {
  /** Adapter name — used in logs and sync_log. */
  readonly name: string;

  /**
   * Priority: 1 = primary (ESPN), 2 = secondary (worldcupjson),
   * 3 = tertiary (football-data, rate-limited: 10 req/min).
   */
  readonly priority: number;

  /**
   * Fetch normalised match updates for the given UTC date.
   * Throws on network/parse/auth error (service will try next adapter).
   */
  fetchUpdates(date: Date): Promise<NormalizedMatchUpdate[]>;
}
