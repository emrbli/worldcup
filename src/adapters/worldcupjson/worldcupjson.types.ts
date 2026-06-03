// ---------------------------------------------------------------------------
// worldcupjson.net API typings.
// Endpoint: https://worldcupjson.net/matches[?details=true]
// Community-maintained Rails app. No auth required, no documented rate limit.
// ---------------------------------------------------------------------------

// Known values: 'future' | 'in_progress' | 'completed' — string for forward-compatibility.
export type WCJMatchStatus = string;

export interface WCJTeam {
  /** 3-letter country code — equivalent to FIFA code (QAT, MEX, ARG...). */
  country: string;
  name: string;
  goals: number | null;
  penalties: number | null;
}

export interface WCJMatch {
  id: number;
  venue: string;
  location: string;
  status: WCJMatchStatus;
  attendance: string | null;
  stage_name: string;
  home_team_country: string; // 3-letter, same as homeFifa
  away_team_country: string;
  datetime: string; // ISO UTC, e.g. "2022-11-20T16:00:00Z"
  winner: string | null; // team name or "Draw"
  winner_code: string | null;
  home_team: WCJTeam;
  away_team: WCJTeam;
  last_checked_at: string | null;
  last_changed_at: string | null;
}

/** GET /matches returns WCJMatch[] */
export type WCJMatchesResponse = WCJMatch[];
