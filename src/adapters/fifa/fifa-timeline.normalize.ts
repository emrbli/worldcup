import { localized } from './fifa-calendar.normalize.js';
import type { FifaEvent, FifaTimelineResponse } from './fifa.types.js';

/** One normalised timeline event. */
export interface FifaTimelineEvent {
  type: string;
  minute: number | null;
  fifaIdTeam: string | null;
  playerName: string | null;
  detail: Record<string, unknown>;
}

/**
 * PROVISIONAL FIFA Event Type (int) → our event type.
 * SYNTHETIC / unverified: Event[] is empty in every real pre-tournament
 * fixture, so these codes are a best-effort guess (mirrors the synthetic
 * fixture fifa-timeline-sample.json). Revisit once a real played-match
 * timeline is observed. Unknown types fall through to 'other'.
 */
const FIFA_EVENT_TYPE: Record<number, string> = {
  0: 'goal',
  1: 'own_goal',
  2: 'penalty',
  3: 'yellow',
  4: 'red',
  5: 'sub',
  6: 'var',
};

/** Parse the leading integer from a FIFA minute string ("12'", "90+2'"). */
function parseMinute(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeEvent(e: FifaEvent): FifaTimelineEvent {
  const type =
    typeof e.Type === 'number' ? (FIFA_EVENT_TYPE[e.Type] ?? 'other') : 'other';
  const description = localized(e.EventDescription);
  return {
    type,
    minute: parseMinute(e.MatchMinute),
    fifaIdTeam: e.IdTeam ?? null,
    playerName: localized(e.PlayerName),
    detail: {
      rawType: e.Type ?? null,
      idPlayer: e.IdPlayer ?? null,
      description,
    },
  };
}

/**
 * Pure transform: FIFA timeline JSON → normalised events.
 * Tolerant of an absent/empty Event[] (the real pre-tournament shape).
 */
export function normalizeTimeline(
  raw: FifaTimelineResponse,
): FifaTimelineEvent[] {
  if (!raw.Event || raw.Event.length === 0) return [];
  return raw.Event.map(normalizeEvent);
}
