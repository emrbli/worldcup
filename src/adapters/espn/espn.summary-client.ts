import { Injectable, Logger } from '@nestjs/common';
import type { EspnSummaryResponse } from './espn.types.js';

const BASE_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';

/**
 * Fetches the ESPN match summary for a single event.
 * Used for live event ticker (details[]) and lineups (rosters[]).
 */
@Injectable()
export class EspnSummaryClient {
  private readonly logger = new Logger(EspnSummaryClient.name);

  async fetchSummary(espnEventId: string): Promise<EspnSummaryResponse> {
    const url = new URL(BASE_URL);
    url.searchParams.set('event', espnEventId);

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(
        `ESPN summary fetch failed for event ${espnEventId}: ${res.status} ${res.statusText}`,
      );
    }

    return res.json() as Promise<EspnSummaryResponse>;
  }
}
