// ---------------------------------------------------------------------------
// FIFA first-party data (enrichment) typings (see master plan §6).
// Locale: en-GB. Localized strings come as arrays: [{Locale, Description}].
// Only fields we consume are modelled; unknown fields are tolerated.
//
// FIFA is a *secondary / enrichment* source (priority 3). It is NOT the score
// authority — ESPN (1°) / worldcupjson (2°) own live scores. We use FIFA for
// calendar mapping, broadcasters, standings, timelines and leaders enrichment.
// ---------------------------------------------------------------------------

import type { MatchStatus, NormalizedMatchUpdate } from '../espn/espn.types.js';
import type { OfficialsJson } from '../football-data/football-data.types.js';

export type { MatchStatus, NormalizedMatchUpdate, OfficialsJson };

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** A FIFA localized string entry. */
export interface FifaLocalized {
  Locale: string;
  Description: string;
}

/** Helper alias: a FIFA localized field is an array of {Locale, Description}. */
export type Localized = FifaLocalized[];

// ---------------------------------------------------------------------------
// calendar/matches  →  { Results: FifaMatch[] }
// ---------------------------------------------------------------------------

export interface FifaStadium {
  IdStadium?: string;
  Name?: Localized;
  IdCity?: string;
  CityName?: Localized;
  IdCountry?: string;
}

export interface FifaMatchTeam {
  IdTeam?: string;
  /** FIFA 3-letter code, e.g. "MEX". */
  Abbreviation?: string;
  TeamName?: Localized;
  IdCountry?: string;
  Score?: number | null;
  PictureUrl?: string;
}

export interface FifaMatch {
  IdCompetition?: string;
  IdSeason?: string;
  IdStage?: string;
  IdGroup?: string | null;
  IdMatch: string;
  /** 1..104 */
  MatchNumber?: number;
  /** int — see FIFA_MATCH_STATUS (all probed = 1 = scheduled). */
  MatchStatus?: number;
  /** UTC ISO. */
  Date?: string;
  LocalDate?: string;
  StageName?: Localized;
  GroupName?: Localized;
  /** Knockout placeholders, e.g. "A1", "2A", "W101". */
  PlaceHolderA?: string | null;
  PlaceHolderB?: string | null;
  Home?: FifaMatchTeam | null;
  Away?: FifaMatchTeam | null;
  HomeTeamScore?: number | null;
  AwayTeamScore?: number | null;
  HomeTeamPenaltyScore?: number | null;
  AwayTeamPenaltyScore?: number | null;
  Stadium?: FifaStadium | null;
  Officials?: unknown[];
  Winner?: string | null;
}

export interface FifaCalendarResponse {
  Results?: FifaMatch[];
  ContinuationToken?: string | null;
  ContinuationHash?: string | null;
}

// ---------------------------------------------------------------------------
// Standings response  →  { Results: FifaStanding[] }
// ---------------------------------------------------------------------------

export interface FifaStandingTeam {
  IdTeam?: string;
  Abbreviation?: string;
  Name?: Localized;
}

export interface FifaStanding {
  IdGroup?: string | null;
  IdTeam?: string;
  Played?: number;
  Won?: number;
  Drawn?: number;
  Lost?: number;
  For?: number;
  Against?: number;
  GoalsDiference?: number; // (sic — FIFA's spelling)
  Points?: number;
  Position?: number;
  Team?: FifaStandingTeam | null;
}

export interface FifaStandingResponse {
  Results?: FifaStanding[];
}

// ---------------------------------------------------------------------------
// Broadcast listings response  →  { Results: FifaWatchCountry[] }
// ---------------------------------------------------------------------------

export interface FifaWatchSource {
  IdChannel?: string;
  Name?: string;
  Logo?: string;
  TvChannelUrl?: string;
  Url?: string;
  IOsUrl?: string;
  AndroidUrl?: string;
  Language?: string;
}

export interface FifaWatchMatch {
  IdMatch?: string;
  Date?: string;
  Sources?: FifaWatchSource[];
}

export interface FifaWatchCountry {
  IdCountry?: string;
  /** ISO 3166 alpha-2 market code, e.g. "AF". */
  IdCountryIso3166Alpha2?: string;
  CountryName?: Localized;
  Matches?: FifaWatchMatch[];
}

export interface FifaWatchResponse {
  Results?: FifaWatchCountry[];
}

// ---------------------------------------------------------------------------
// timelines/.../{idMatch}  →  { IdMatch, IdStage, Event: FifaEvent[] }
// Event[] is EMPTY pre-tournament. Shape below is provisional/synthetic.
// ---------------------------------------------------------------------------

export interface FifaEvent {
  Type?: number;
  /** e.g. "12'". */
  MatchMinute?: string;
  IdPlayer?: string;
  PlayerName?: Localized;
  IdTeam?: string;
  EventDescription?: Localized;
}

export interface FifaTimelineResponse {
  IdMatch?: string;
  IdStage?: string;
  Event?: FifaEvent[];
}

// ---------------------------------------------------------------------------
// live/football/.../{idMatch}  →  FifaLive | null (null when no live match)
// ---------------------------------------------------------------------------

export interface FifaLivePlayer {
  IdPlayer?: string;
  PlayerName?: Localized;
  ShirtNumber?: number;
  [key: string]: unknown;
}

export interface FifaLiveTeam {
  IdTeam?: string;
  Tactics?: string | null;
  Players?: FifaLivePlayer[];
  [key: string]: unknown;
}

export interface FifaLiveOfficial {
  IdOfficial?: string;
  Name?: Localized;
  OfficialType?: number; // 1=referee, 2/3=assistants, 4=fourth, 5/6=VAR (provisional)
}

export interface FifaLiveResponse {
  HomeTeam?: FifaLiveTeam | null;
  AwayTeam?: FifaLiveTeam | null;
  Officials?: FifaLiveOfficial[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// topseasonplayerstatistics/.../topscorers  →  { Results: FifaLeader[] } | null
// ---------------------------------------------------------------------------

export interface FifaLeaderPlayer {
  IdPlayer?: string;
  PlayerName?: Localized;
  Name?: Localized;
}

export interface FifaLeader {
  Rank?: number;
  Value?: number;
  IdPlayer?: string;
  IdTeam?: string;
  PlayerName?: Localized;
  TeamName?: Localized;
  Player?: FifaLeaderPlayer | null;
}

export interface FifaTopScorersResponse {
  Results?: FifaLeader[];
}

// ---------------------------------------------------------------------------
// teams/{idTeam}  →  FifaTeam
// ---------------------------------------------------------------------------

export interface FifaTeam {
  IdTeam?: string;
  IdConfederation?: string;
  Name?: Localized;
  Abbreviation?: string;
  IdCountry?: string;
  FoundationYear?: number;
  City?: string;
  PictureUrl?: string;
}

// ---------------------------------------------------------------------------
// Status / stage maps
// ---------------------------------------------------------------------------

/**
 * PROVISIONAL FIFA MatchStatus (int) → canonical MatchStatus.
 * All probed matches are MatchStatus=1 (scheduled). The live/ft codes below are
 * a best-effort guess and have NOT been observed. FIFA is a priority-3
 * enrichment source, NOT the score authority, so a wrong guess here cannot
 * corrupt canonical scores (ESPN/worldcupjson win). Revisit once a real
 * live/played match is observed.
 */
export const FIFA_MATCH_STATUS: Record<number, MatchStatus> = {
  0: 'scheduled',
  1: 'scheduled',
  3: 'live',
  4: 'live',
  7: 'live',
  8: 'ft',
  10: 'ft',
  12: 'ft',
};

/** FIFA IdStage → canonical round key. */
export const FIFA_STAGE_ROUND: Record<string, string> = {
  '289273': 'group', // First Stage
  '289287': 'r32',
  '289288': 'r16',
  '289289': 'qf',
  '289290': 'sf',
  '289291': 'third',
  '289292': 'final',
};

// ---------------------------------------------------------------------------
// Domain output types (adapter results)
// ---------------------------------------------------------------------------

/** Seed mapping row: ties FIFA's IdMatch/codes/stadium to a match number. */
export interface FifaMatchMapping {
  matchNumber: number;
  idMatch: string;
  idStage: string;
  idGroup: string | null;
  round: string;
  homeFifaCode: string | null;
  awayFifaCode: string | null;
  idStadium: string | null;
}

/** One broadcaster row (country × match × channel). */
export interface FifaBroadcastRow {
  idMatch: string;
  market: string;
  channel: string;
  kind: 'tv' | 'stream';
  url: string | null;
  language: string | null;
  logoUrl: string | null;
  idChannel: string | null;
}

/** One group-standings row. */
export interface FifaStandingRow {
  idGroup: string | null;
  fifaCode: string | null;
  idTeam: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number;
}

/** One leaderboard row (e.g. top scorer). */
export interface FifaLeaderRow {
  category: 'topscorers';
  scope: 'player';
  rank: number | null;
  value: number | null;
  playerName: string | null;
  teamName: string | null;
  idPlayer: string | null;
  idTeam: string | null;
}
