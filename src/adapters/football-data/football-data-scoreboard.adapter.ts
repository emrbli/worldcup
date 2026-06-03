import { Injectable } from '@nestjs/common';
import type { LiveScorePort } from '../../domain/live-score.port.js';
import type { NormalizedMatchUpdate } from '../espn/espn.types.js';
import { FootballDataClient } from './football-data.client.js';
import { normalizeFdScoreboard } from './football-data-score.normalize.js';

/**
 * Tertiary live-score adapter (priority = 3).
 * ⚠️  FREE TIER: 10 req/min — only called when ESPN AND worldcupjson both fail.
 * One API call fetches the entire day's matches; filter happens client-side.
 */
@Injectable()
export class FootballDataScoreboardAdapter implements LiveScorePort {
  readonly name = 'football-data';
  readonly priority = 3;

  constructor(private readonly client: FootballDataClient) {}

  async fetchUpdates(date: Date): Promise<NormalizedMatchUpdate[]> {
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const raw = await this.client.fetchMatches(dateStr, dateStr);
    return normalizeFdScoreboard(raw, date);
  }
}
