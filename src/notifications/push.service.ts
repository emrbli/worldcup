import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { DevicesService } from '../devices/devices.service.js';
import type { Env } from '../config/env.validation.js';
import type { NormalizedEvent } from '../adapters/espn/espn-events.normalize.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100; // Expo recommends max 100 per request

interface MatchEventsUpdatedEvent {
  matchId: string;
  events: NormalizedEvent[];
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Push notification service — sends goal alerts via Expo Push API.
 * Gated by PUSH_ENABLED env flag (off by default).
 * Push failures are logged but never throw (must not break the sync loop).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly devices: DevicesService,
  ) {
    this.enabled = this.config.get('PUSH_ENABLED', { infer: true });
  }

  @OnEvent('match.events.updated')
  async onMatchEventsUpdated(event: MatchEventsUpdatedEvent): Promise<void> {
    if (!this.enabled) return;

    const goalEvents = event.events.filter(
      (e) => e.type === 'goal' || e.type === 'own_goal',
    );
    if (goalEvents.length === 0) return;

    for (const goalEvent of goalEvents) {
      await this.sendGoalPush(event.matchId, goalEvent).catch(
        (err: unknown) => {
          this.logger.warn(
            `Push failed for match ${event.matchId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        },
      );
    }
  }

  async sendGoalPush(matchId: string, event: NormalizedEvent): Promise<void> {
    if (!this.enabled) return;

    const tokens = await this.devices.getPushTokens();
    if (tokens.length === 0) return;

    const isOwnGoal = event.type === 'own_goal';
    const title = isOwnGoal ? '⚽ Own Goal!' : '⚽ Goal!';
    const minutePart = event.minute != null ? ` ${event.minute}'` : '';
    const scorerPart = event.playerName ?? event.teamFifa;
    const body = `${scorerPart}${minutePart}`;

    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      title,
      body,
      data: { matchId, eventType: event.type },
    }));

    // Batch in chunks of 100 (Expo limit)
    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      const chunk = messages.slice(i, i + EXPO_BATCH_SIZE);
      await this.sendBatch(chunk);
    }

    this.logger.log(
      `Push sent: ${title} — ${body} to ${tokens.length} devices`,
    );
  }

  private async sendBatch(messages: ExpoPushMessage[]): Promise<void> {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Expo push failed: ${res.status} ${res.statusText}`);
    }
  }
}
