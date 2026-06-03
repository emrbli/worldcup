import type { EspnRoster, EspnSummaryResponse } from './espn.types.js';

export interface LineupPlayer {
  name: string;
  number: number | null;
  position: string | null;
  starter: boolean;
}

export interface LineupResult {
  teamFifa: string;
  formation: string | null; // ESPN does not provide formation → null
  players: LineupPlayer[];
}

function normalizeRoster(roster: EspnRoster): LineupResult {
  return {
    teamFifa: roster.team.abbreviation,
    formation: null,
    players: (roster.roster ?? []).map((entry) => ({
      name: entry.athlete.displayName,
      number: entry.jersey ? parseInt(entry.jersey, 10) || null : null,
      position: entry.position?.abbreviation ?? null,
      starter: entry.starter,
    })),
  };
}

/**
 * Pure transform: ESPN summary rosters[] → LineupResult[].
 * Returns one entry per team (home + away).
 * No I/O — fully unit-testable.
 */
export function normalizeEspnLineups(
  summary: EspnSummaryResponse,
): LineupResult[] {
  const rosters = summary.rosters;
  if (!rosters || rosters.length === 0) return [];
  return rosters.map(normalizeRoster);
}
