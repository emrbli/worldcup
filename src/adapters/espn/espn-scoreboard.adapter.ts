import { Injectable } from '@nestjs/common';
import type { LiveScorePort } from '../../domain/live-score.port.js';
import type { NormalizedMatchUpdate } from './espn.types.js';
import { EspnClient } from './espn.client.js';
import { normalizeScoreboard } from './espn.normalize.js';

/**
 * Primary live-score adapter (priority = 1).
 * No authentication required; fastest source.
 */
@Injectable()
export class EspnScoreboardAdapter implements LiveScorePort {
  readonly name = 'espn';
  readonly priority = 1;

  constructor(private readonly client: EspnClient) {}

  async fetchUpdates(date: Date): Promise<NormalizedMatchUpdate[]> {
    const raw = await this.client.fetchScoreboard(date);
    return normalizeScoreboard(raw);
  }
}
