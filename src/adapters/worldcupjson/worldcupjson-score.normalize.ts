import type {
  WCJMatch,
  WCJMatchesResponse,
  WCJMatchStatus,
} from './worldcupjson.types.js';
import type { MatchStatus, NormalizedMatchUpdate } from '../espn/espn.types.js';

/**
 * Map worldcupjson status to canonical MatchStatus.
 */
export function mapWcjStatus(status: WCJMatchStatus): MatchStatus {
  switch (status) {
    case 'future':
      return 'scheduled';
    case 'in_progress':
      return 'live';
    case 'completed':
      return 'ft';
    default:
      return 'scheduled'; // unknown → treat as upcoming
  }
}

function toScore(goals: number | null, status: MatchStatus): number | null {
  // worldcupjson sets goals to null for future matches and 0 for in-progress/completed.
  // If match is still future (not started) goals will be null.
  if (status === 'scheduled') return null;
  return goals;
}

function normalizeMatch(m: WCJMatch): NormalizedMatchUpdate {
  const status = mapWcjStatus(m.status);
  return {
    sourceEventId: String(m.id),
    kickoffUtc: new Date(m.datetime),
    homeFifa: m.home_team_country, // 3-letter FIFA code
    awayFifa: m.away_team_country,
    status,
    minute: null, // worldcupjson does not provide a live minute field
    homeScore: toScore(m.home_team.goals, status),
    awayScore: toScore(m.away_team.goals, status),
    homeScoreHt: null,
    awayScoreHt: null,
    homePens: toScore(m.home_team.penalties, status),
    awayPens: toScore(m.away_team.penalties, status),
  };
}

/**
 * Pure transform: worldcupjson matches response → normalised updates.
 * Optionally filter to a specific UTC date.
 */
export function normalizeWcjScoreboard(
  raw: WCJMatchesResponse,
  filterDate?: Date,
): NormalizedMatchUpdate[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  let matches = raw;

  if (filterDate) {
    const dateStr = filterDate.toISOString().slice(0, 10); // YYYY-MM-DD
    matches = raw.filter((m) => m.datetime.startsWith(dateStr));
  }

  return matches.map(normalizeMatch);
}
