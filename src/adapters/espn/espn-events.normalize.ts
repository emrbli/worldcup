import type {
  EspnCompetitionDetail,
  EspnSummaryResponse,
} from './espn.types.js';

export type EventType = 'goal' | 'own_goal' | 'penalty' | 'yellow' | 'red';

export interface NormalizedEvent {
  type: EventType;
  minute: number | null;
  teamFifa: string;
  playerName: string | null;
}

/**
 * Determine the canonical event type from an ESPN competition detail.
 * Priority: ownGoal > penaltyKick > scoringPlay > redCard > yellow (default).
 */
export function mapEventType(detail: EspnCompetitionDetail): EventType {
  if (detail.ownGoal) return 'own_goal';
  if (detail.penaltyKick) return 'penalty';
  if (detail.scoringPlay) return 'goal';
  if (detail.redCard) return 'red';
  return 'yellow';
}

/** Parse minute from ESPN clock.displayValue e.g. "38'" → 38, "90+2'" → 90. */
export function parseEventMinute(
  displayValue: string | undefined,
): number | null {
  if (!displayValue) return null;
  const match = displayValue.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function normalizeDetail(
  detail: EspnCompetitionDetail,
): NormalizedEvent | null {
  const teamFifa = detail.team?.abbreviation;
  if (!teamFifa) return null; // skip events with no team (e.g. VAR reviews)

  return {
    type: mapEventType(detail),
    minute: parseEventMinute(detail.clock?.displayValue),
    teamFifa,
    playerName: detail.participants[0]?.athlete.displayName ?? null,
  };
}

/**
 * Pure transform: ESPN summary response → normalised events.
 * Only processes scoring events and cards from header.competitions[0].details[].
 * No I/O — fully unit-testable.
 */
export function normalizeEspnEvents(
  summary: EspnSummaryResponse,
): NormalizedEvent[] {
  const comp = summary.header?.competitions?.[0];
  if (!comp) return [];

  const details = comp.details ?? [];
  return details
    .map(normalizeDetail)
    .filter((e): e is NormalizedEvent => e !== null);
}
