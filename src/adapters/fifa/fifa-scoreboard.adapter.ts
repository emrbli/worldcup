import { Injectable } from '@nestjs/common';
import type { LiveScorePort } from '../../domain/live-score.port.js';
import type { NormalizedMatchUpdate } from './fifa.types.js';
import { FifaClient } from './fifa.client.js';
import { normalizeCalendar } from './fifa-calendar.normalize.js';

/**
 * Last-resort live-score adapter (priority = 4) — FIFA first-party calendar.
 * Enrichment / fallback only; the chain is ESPN (1°) → worldcupjson (2°) →
 * football-data (3°) → FIFA (4°). ESPN & worldcupjson own scores.
 */
@Injectable()
export class FifaScoreboardAdapter implements LiveScorePort {
  readonly name = 'fifa';
  readonly priority = 4;

  constructor(private readonly client: FifaClient) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchUpdates(date: Date): Promise<NormalizedMatchUpdate[]> {
    // FIFA calendar returns all 104 fixtures regardless of date; the service
    // resolves by FIFA-code pair / event id, so the date arg is unused here.
    const raw = await this.client.fetchCalendar();
    return normalizeCalendar(raw);
  }
}
