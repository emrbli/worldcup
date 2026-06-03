import { localized } from './fifa-calendar.normalize.js';
import type {
  FifaLeader,
  FifaLeaderRow,
  FifaTopScorersResponse,
} from './fifa.types.js';

function normalizeRow(l: FifaLeader): FifaLeaderRow {
  return {
    category: 'topscorers',
    scope: 'player',
    rank: typeof l.Rank === 'number' ? l.Rank : null,
    value: typeof l.Value === 'number' ? l.Value : null,
    playerName: localized(l.PlayerName) ?? localized(l.Player?.PlayerName),
    teamName: localized(l.TeamName),
    idPlayer: l.IdPlayer ?? l.Player?.IdPlayer ?? null,
    idTeam: l.IdTeam ?? null,
  };
}

/**
 * Pure transform: FIFA top-scorers JSON → leader rows.
 * The real fixture is `null` (pre-tournament) → returns [].
 * Tolerant of {Results:[...]} when present.
 */
export function normalizeTopScorers(
  raw: FifaTopScorersResponse | null,
): FifaLeaderRow[] {
  if (!raw || !raw.Results) return [];
  return raw.Results.map(normalizeRow);
}
