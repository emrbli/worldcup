// ---------------------------------------------------------------------------
// football-data.org full national-squads seed source (enrichment — see plan §6).
//
// STATIC seed only: fetched ONCE (one API call), written to Postgres, never a
// runtime dependency. Provides per-team full squads (~26 players), team crests
// (logos), and coaches via GET /v4/competitions/WC/teams.
//
// Plain fetch (no Nest DI) so the standalone seed script can use it directly.
// Free tier = 10 calls/min — this source needs only a single call.
// ---------------------------------------------------------------------------

const BASE = (process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org/v4').replace(
  /\/+$/,
  '',
);

// ---------------------------------------------------------------------------
// Wire types (minimal — only the fields we consume)
// ---------------------------------------------------------------------------

export interface FDSquadPlayer {
  id: number;
  name: string;
  position: string | null; // Goalkeeper | Defence | Midfield | Offence (coarse)
  dateOfBirth: string | null; // ISO 'YYYY-MM-DD'
  nationality: string | null;
}

export interface FDCoach {
  id?: number;
  name: string | null;
  nationality?: string | null;
}

export interface FDTeam {
  id: number;
  name: string;
  tla: string | null;
  crest: string | null;
  founded: number | null;
  coach: FDCoach | null;
  squad: FDSquadPlayer[];
}

export interface FDTeamsResponse {
  teams: FDTeam[];
}

// ---------------------------------------------------------------------------
// Name matching: football-data team.name → our teams.name. 43 match exactly;
// these 5 need an override. Build the our-teams map by name from the DB.
// ---------------------------------------------------------------------------

export const NAME_OVERRIDES: Record<string, string> = {
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Cape Verde Islands': 'Cape Verde',
  'Congo DR': 'DR Congo',
  Czechia: 'Czech Republic',
  'United States': 'USA',
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** Full WC team list with squads, crests and coaches (single API call). */
export async function fetchWcTeams(): Promise<FDTeamsResponse> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN is required');

  const url = `${BASE}/competitions/WC/teams`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': token, accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(
      `football-data fetch failed: ${res.status} ${res.statusText} (${url})`,
    );
  }
  return res.json() as Promise<FDTeamsResponse>;
}

// ---------------------------------------------------------------------------
// Normalize (pure)
// ---------------------------------------------------------------------------

export interface NormalizedSquadPlayer {
  name: string;
  position: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  fdPlayerId: number;
}

export interface NormalizedSquad {
  fdTeamId: number;
  name: string; // football-data team name (raw)
  ourNameKey: string; // resolved name to match against our teams.name
  crest: string | null;
  coach: string | null;
  coachNationality: string | null;
  founded: number | null;
  players: NormalizedSquadPlayer[];
}

/** Pure: shape a single FD team into our normalized squad. */
export function normalizeSquad(team: FDTeam): NormalizedSquad {
  const ourNameKey = NAME_OVERRIDES[team.name] ?? team.name;
  return {
    fdTeamId: team.id,
    name: team.name,
    ourNameKey,
    crest: team.crest ?? null,
    coach: team.coach?.name ?? null,
    coachNationality: team.coach?.nationality ?? null,
    founded: team.founded ?? null,
    players: (team.squad ?? []).map((p) => ({
      name: p.name,
      position: p.position ?? null,
      dateOfBirth: p.dateOfBirth ?? null,
      nationality: p.nationality ?? null,
      fdPlayerId: p.id,
    })),
  };
}
