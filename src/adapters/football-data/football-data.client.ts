import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FDMatchesResponse } from './football-data.types.js';
import type { Env } from '../../config/env.validation.js';

const BASE_URL = 'https://api.football-data.org/v4/competitions/WC/matches';

@Injectable()
export class FootballDataClient {
  private readonly logger = new Logger(FootballDataClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  /**
   * Fetch WC matches for a date range.
   * One request returns ALL matches in the range — no per-match calls needed.
   * Rate limit: 10 req/min (free tier). Use sparingly — only as last fallback
   * for live scores, and scheduled calls for officials.
   */
  async fetchMatches(
    dateFrom: string,
    dateTo: string,
  ): Promise<FDMatchesResponse> {
    const token = this.config.get('FOOTBALL_DATA_TOKEN', { infer: true });
    const url = new URL(BASE_URL);
    url.searchParams.set('dateFrom', dateFrom);
    url.searchParams.set('dateTo', dateTo);

    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        'X-Auth-Token': token,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 429) {
      throw new Error('football-data rate limit exceeded (10 req/min)');
    }
    if (!res.ok) {
      throw new Error(
        `football-data fetch failed: ${res.status} ${res.statusText}`,
      );
    }

    return res.json() as Promise<FDMatchesResponse>;
  }
}
