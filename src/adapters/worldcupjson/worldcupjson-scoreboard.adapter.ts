import { Injectable } from '@nestjs/common';
import type { LiveScorePort } from '../../domain/live-score.port.js';
import type { NormalizedMatchUpdate } from '../espn/espn.types.js';
import { WorldcupJsonClient } from './worldcupjson.client.js';
import { normalizeWcjScoreboard } from './worldcupjson-score.normalize.js';

/**
 * Secondary live-score adapter (priority = 2).
 * No authentication required, no documented rate limit.
 */
@Injectable()
export class WorldcupJsonScoreboardAdapter implements LiveScorePort {
  readonly name = 'worldcupjson';
  readonly priority = 2;

  constructor(private readonly client: WorldcupJsonClient) {}

  async fetchUpdates(date: Date): Promise<NormalizedMatchUpdate[]> {
    const raw = await this.client.fetchMatches();
    return normalizeWcjScoreboard(raw, date);
  }
}
