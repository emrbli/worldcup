// ---------------------------------------------------------------------------
// football-data.org v4 API typings.
// Endpoint: https://api.football-data.org/v4/competitions/WC/matches
// Requires X-Auth-Token header. FREE tier: 10 calls/minute.
// ---------------------------------------------------------------------------

export const FD_STATUS = {
  SCHEDULED: 'SCHEDULED', // → canonical: scheduled
  TIMED: 'TIMED', // time set, not started → scheduled
  IN_PLAY: 'IN_PLAY', // → live
  PAUSED: 'PAUSED', // half-time break → ht
  FINISHED: 'FINISHED', // → ft
  AWARDED: 'AWARDED', // walkover result → ft
  SUSPENDED: 'SUSPENDED', // → postponed
  POSTPONED: 'POSTPONED', // → postponed
  CANCELLED: 'CANCELLED', // → postponed
} as const;

// string: forward-compatible — use FD_STATUS constants for switch/comparisons.
export type FDMatchStatus = string;

export const FD_REFEREE_TYPE = {
  REFEREE: 'REFEREE',
  ASSISTANT_REFEREE_N1: 'ASSISTANT_REFEREE_N1',
  ASSISTANT_REFEREE_N2: 'ASSISTANT_REFEREE_N2',
  FOURTH_OFFICIAL: 'FOURTH_OFFICIAL',
  VIDEO_ASSISTANT_REFEREE_N1: 'VIDEO_ASSISTANT_REFEREE_N1',
  VIDEO_ASSISTANT_REFEREE_N2: 'VIDEO_ASSISTANT_REFEREE_N2',
} as const;

// string: forward-compatible — use FD_REFEREE_TYPE constants for switch/comparisons.
export type FDRefereeType = string;

export interface FDReferee {
  id: number;
  name: string;
  type: FDRefereeType;
  nationality: string | null;
}

export interface FDScoreDetail {
  home: number | null;
  away: number | null;
}

export interface FDScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
  fullTime: FDScoreDetail;
  halfTime: FDScoreDetail;
}

export interface FDTeam {
  id: number;
  name: string;
  shortName?: string;
  /** 3-letter FIFA code (tla = "three letter abbreviation"). Matches our fifaCode. */
  tla: string;
  crest?: string;
}

export interface FDMatch {
  id: number;
  utcDate: string; // ISO, e.g. "2026-06-11T19:00:00Z"
  status: FDMatchStatus;
  minute?: number; // present when IN_PLAY
  matchday?: number;
  stage?: string;
  group?: string | null;
  lastUpdated?: string;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: FDScore;
  referees: FDReferee[];
  odds?: Record<string, unknown>;
}

export interface FDMatchesResponse {
  count?: number;
  filters?: Record<string, unknown>;
  competition?: { id: number; name: string; code: string };
  matches: FDMatch[];
}

// ---------------------------------------------------------------------------
// Canonical officials shape (stored in matches.officials jsonb)
// ---------------------------------------------------------------------------
export interface OfficialsJson {
  referee?: string;
  assistants?: string[];
  fourth?: string;
  var?: string;
}
