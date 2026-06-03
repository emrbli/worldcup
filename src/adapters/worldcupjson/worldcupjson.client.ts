import { Injectable, Logger } from '@nestjs/common';
import type { WCJMatchesResponse } from './worldcupjson.types.js';

const BASE_URL = 'https://worldcupjson.net/matches';

@Injectable()
export class WorldcupJsonClient {
  private readonly logger = new Logger(WorldcupJsonClient.name);

  async fetchMatches(): Promise<WCJMatchesResponse> {
    const url = `${BASE_URL}?details=true`;

    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(
        `worldcupjson fetch failed: ${res.status} ${res.statusText}`,
      );
    }

    return res.json() as Promise<WCJMatchesResponse>;
  }
}
