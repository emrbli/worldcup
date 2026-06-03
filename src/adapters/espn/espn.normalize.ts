import type {
  EspnEvent,
  EspnScoreboard,
  EspnStatus,
  MatchStatus,
  NormalizedMatchUpdate,
} from './espn.types.js';
import { ESPN_STATUS } from './espn.types.js';

/**
 * Map ESPN status (state + type name) to our canonical MatchStatus.
 * Priority: postpone/cancel/abandon checks first, then halftime, then state.
 * Unknown names are handled gracefully via state fallback.
 */
export function mapStatus(status: EspnStatus): MatchStatus {
  const name = status.type.name.toUpperCase();
  const state = status.type.state;

  // Postponed/cancelled/abandoned — check before state (can be any state)
  if (
    name.includes('POSTPONED') ||
    name.includes('CANCEL') ||
    name.includes('ABANDON') ||
    name.includes('SUSPEND')
  ) {
    return 'postponed';
  }
  if (name.includes('HALFTIME')) return 'ht';

  // Delayed still means pre-game (not live)
  if (name === ESPN_STATUS.DELAYED || name === ESPN_STATUS.RAIN_DELAY) {
    return 'scheduled';
  }

  switch (state) {
    case 'pre':
      return 'scheduled';
    case 'in':
      return 'live'; // covers IN_PROGRESS, EXTRA_TIME, PENALTY, unknown in-game
    case 'post':
      return 'ft';
    default:
      return 'scheduled';
  }
}

/** Parse the playing minute from displayClock ("45'", "90+2'") or numeric clock. */
export function parseMinute(status: EspnStatus): number | null {
  if (status.type.state !== 'in') return null;
  if (status.displayClock) {
    // Take the first integer group: "90+2'" → 90, "45'" → 45
    const match = status.displayClock.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  if (typeof status.clock === 'number') return Math.floor(status.clock);
  return null;
}

function parseScore(value: string | undefined, scored: boolean): number | null {
  if (!scored) return null;
  if (value === undefined || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function normalizeEvent(event: EspnEvent): NormalizedMatchUpdate | null {
  const comp = event.competitions[0];
  if (!comp) return null;

  const home = comp.competitors.find((c) => c.homeAway === 'home');
  const away = comp.competitors.find((c) => c.homeAway === 'away');
  if (!home || !away) return null;

  const status = mapStatus(event.status);
  // Only surface real scores once the match has begun (state !== 'pre').
  // ESPN sends score:"0" even pre-game, so we must gate on state.
  const scored = event.status.type.state !== 'pre';

  return {
    sourceEventId: event.id,
    kickoffUtc: new Date(event.date),
    homeFifa: home.team.abbreviation,
    awayFifa: away.team.abbreviation,
    status,
    minute: parseMinute(event.status),
    homeScore: parseScore(home.score, scored),
    awayScore: parseScore(away.score, scored),
    homeScoreHt: null, // scoreboard endpoint does not carry half-time detail
    awayScoreHt: null,
    homePens: home.shootoutScore ? parseScore(home.shootoutScore, true) : null,
    awayPens: away.shootoutScore ? parseScore(away.shootoutScore, true) : null,
  };
}

/**
 * Pure transform: ESPN scoreboard JSON → normalised match updates.
 * No I/O — fully unit-testable with fixture files.
 */
export function normalizeScoreboard(
  raw: EspnScoreboard,
): NormalizedMatchUpdate[] {
  if (!raw.events) return [];
  return raw.events
    .map(normalizeEvent)
    .filter((u): u is NormalizedMatchUpdate => u !== null);
}
