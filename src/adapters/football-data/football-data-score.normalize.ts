import type { FDMatch, FDMatchesResponse } from './football-data.types.js';
import { FD_STATUS } from './football-data.types.js';
import type { MatchStatus, NormalizedMatchUpdate } from '../espn/espn.types.js';

/**
 * Map football-data.org match status to canonical MatchStatus.
 */
export function mapFdStatus(status: string): MatchStatus {
  switch (status) {
    case FD_STATUS.SCHEDULED:
    case FD_STATUS.TIMED:
      return 'scheduled';
    case FD_STATUS.IN_PLAY:
      return 'live';
    case FD_STATUS.PAUSED:
      return 'ht';
    case FD_STATUS.FINISHED:
    case FD_STATUS.AWARDED:
      return 'ft';
    case FD_STATUS.SUSPENDED:
    case FD_STATUS.POSTPONED:
    case FD_STATUS.CANCELLED:
      return 'postponed';
    default:
      return 'scheduled'; // unknown → safe default
  }
}

function normalizeMatch(m: FDMatch): NormalizedMatchUpdate {
  const status = mapFdStatus(m.status);
  const scored = status !== 'scheduled';

  return {
    sourceEventId: String(m.id),
    kickoffUtc: new Date(m.utcDate),
    homeFifa: m.homeTeam.tla, // tla = FIFA 3-letter code (verified)
    awayFifa: m.awayTeam.tla,
    status,
    minute: scored ? (m.minute ?? null) : null,
    homeScore: scored ? (m.score.fullTime.home ?? null) : null,
    awayScore: scored ? (m.score.fullTime.away ?? null) : null,
    homeScoreHt: scored ? (m.score.halfTime.home ?? null) : null,
    awayScoreHt: scored ? (m.score.halfTime.away ?? null) : null,
    homePens: null, // FD does not expose shootout scores in the matches list
    awayPens: null,
  };
}

/**
 * Pure transform: football-data.org matches response → normalised updates.
 * Optionally filter to a specific UTC date.
 */
export function normalizeFdScoreboard(
  raw: FDMatchesResponse,
  filterDate?: Date,
): NormalizedMatchUpdate[] {
  if (!raw.matches || raw.matches.length === 0) return [];

  let matches: FDMatch[] = raw.matches;

  if (filterDate) {
    const dateStr = filterDate.toISOString().slice(0, 10); // YYYY-MM-DD
    matches = raw.matches.filter((m) => m.utcDate.startsWith(dateStr));
  }

  return matches.map(normalizeMatch);
}
