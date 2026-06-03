// ---------------------------------------------------------------------------
// ESPN hidden API typings.
// Scoreboard: site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
// Summary:    site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={id}
// Only fields we consume are modelled; unknown fields are tolerated.
// ---------------------------------------------------------------------------

// Known STATUS_* values from the live API. Typed as const to enable exhaustive
// checks in normalizers, but the normalizer should still handle unknown values
// gracefully (new statuses may appear mid-tournament).
export const ESPN_STATUS = {
  SCHEDULED: 'STATUS_SCHEDULED',
  IN_PROGRESS: 'STATUS_IN_PROGRESS',
  HALFTIME: 'STATUS_HALFTIME',
  FULL_TIME: 'STATUS_FULL_TIME',
  FINAL: 'STATUS_FINAL',
  POSTPONED: 'STATUS_POSTPONED',
  ABANDONED: 'STATUS_ABANDONED',
  SUSPENDED: 'STATUS_SUSPENDED',
  DELAYED: 'STATUS_DELAYED',
  EXTRA_TIME: 'STATUS_EXTRA_TIME',
  PENALTY: 'STATUS_PENALTY', // penalty shootout
  RAIN_DELAY: 'STATUS_RAIN_DELAY',
} as const;

// string: forward-compatible — ESPN may add new STATUS_* values at any time.
// Use ESPN_STATUS constants for comparisons; do not exhaustive-check this type.
export type EspnStatusName = string;

export interface EspnStatusType {
  id: string;
  name: EspnStatusName;
  state: 'pre' | 'in' | 'post';
  completed: boolean;
  description?: string;
  detail?: string;
  shortDetail?: string;
}

export interface EspnStatus {
  clock?: number;
  displayClock?: string; // e.g. "45'" or "90+2'"
  type: EspnStatusType;
}

export interface EspnTeam {
  id: string;
  abbreviation: string; // FIFA code (48/48 verified), e.g. "MEX"
  displayName: string;
  shortDisplayName?: string;
  location?: string;
}

export interface EspnCompetitor {
  id: string;
  homeAway: 'home' | 'away';
  winner?: boolean;
  form?: string; // e.g. "WWDDW"
  score?: string; // string "0", "2" — null/absent when pre-game in some contexts
  shootoutScore?: string;
  team: EspnTeam;
}

export interface EspnVenue {
  id: string;
  fullName: string;
  address: { city: string; country: string };
}

export interface EspnCompetition {
  id: string;
  competitors: EspnCompetitor[];
  status?: EspnStatus;
  venue?: EspnVenue;
  details?: EspnCompetitionDetail[]; // populated via /summary only
}

export interface EspnEvent {
  id: string;
  uid?: string;
  date: string; // ISO, e.g. "2026-06-11T19:00Z"
  name?: string;
  shortName?: string;
  status: EspnStatus;
  competitions: EspnCompetition[];
  venue?: EspnVenue;
}

export interface EspnScoreboard {
  events: EspnEvent[];
}

// ---------------------------------------------------------------------------
// Summary endpoint: /summary?event={id}
// ---------------------------------------------------------------------------

/**
 * An individual match event (goal, red card, etc.) from
 * header.competitions[0].details[].
 * NOTE: keyEvents[] also exists but contains play-by-play (kickoffs, shots…).
 * We use details[] for goal/card ticker only.
 */
export interface EspnCompetitionDetail {
  clock: { displayValue: string; value?: number };
  scoringPlay: boolean;
  team: {
    id: string;
    abbreviation: string;
    displayName?: string;
    location?: string;
  } | null;
  participants: Array<{
    athlete: {
      id?: string;
      displayName: string;
      shortName?: string;
    };
  }>;
  addedClock?: { displayValue?: string };
  redCard: boolean;
  penaltyKick: boolean;
  ownGoal: boolean;
  shootout?: boolean;
}

/** One player in a match roster (header, bench, or sub). */
export interface EspnRosterEntry {
  active?: boolean;
  starter: boolean;
  jersey: string;
  athlete: {
    id?: string;
    displayName: string;
    shortName?: string;
    fullName?: string;
    lastName?: string;
  };
  position: { abbreviation: string };
  subbedIn: boolean;
  subbedOut: boolean;
  formationPlace?: number;
}

/** One team's roster (home or away) in the summary response. */
export interface EspnRoster {
  homeAway: 'home' | 'away';
  winner?: boolean;
  team: {
    id: string;
    abbreviation: string;
    displayName?: string;
  };
  roster: EspnRosterEntry[];
}

export interface EspnSummaryResponse {
  header: {
    id?: string;
    competitions: Array<{
      id?: string;
      competitors: EspnCompetitor[];
      status: EspnStatus;
      details: EspnCompetitionDetail[];
    }>;
  };
  rosters?: EspnRoster[];
  keyEvents?: unknown[]; // play-by-play; not consumed yet
}

// ---------------------------------------------------------------------------
// Normalised output — source-agnostic; used by all adapters.
// ---------------------------------------------------------------------------

export type MatchStatus = 'scheduled' | 'live' | 'ht' | 'ft' | 'postponed';

/** Canonical match score/status update — adapter output type. */
export interface NormalizedMatchUpdate {
  /** Source event/match ID (ESPN id, FD id, WCJ id as string). */
  sourceEventId: string;
  kickoffUtc: Date;
  homeFifa: string; // 3-letter FIFA code
  awayFifa: string;
  status: MatchStatus;
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreHt: number | null;
  awayScoreHt: number | null;
  homePens: number | null;
  awayPens: number | null;
}
