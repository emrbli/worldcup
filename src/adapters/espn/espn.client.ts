import { Injectable, Logger } from '@nestjs/common';
import type { EspnScoreboard } from './espn.types.js';

const BASE_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

/**
 * Thin HTTP client for the ESPN hidden scoreboard API.
 * Knows nothing about our domain — just fetches and returns raw JSON.
 */
@Injectable()
export class EspnClient {
  private readonly logger = new Logger(EspnClient.name);

  /**
   * @param date optional UTC date; when given, fetches that day's fixtures.
   *             ESPN expects YYYYMMDD.
   */
  async fetchScoreboard(date?: Date): Promise<EspnScoreboard> {
    const url = new URL(BASE_URL);
    if (date) {
      const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
      url.searchParams.set('dates', yyyymmdd);
    }

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(
        `ESPN scoreboard fetch failed: ${res.status} ${res.statusText}`,
      );
    }

    return res.json() as Promise<EspnScoreboard>;
  }
}
