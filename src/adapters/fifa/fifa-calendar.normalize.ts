import { FIFA_MATCH_STATUS, FIFA_STAGE_ROUND } from './fifa.types.js';
import type {
  FifaCalendarResponse,
  FifaMatch,
  FifaMatchMapping,
  Localized,
  MatchStatus,
  NormalizedMatchUpdate,
} from './fifa.types.js';

/** Extract the en-GB description from a FIFA localized array (fallback: first). */
export function localized(arr: Localized | undefined | null): string | null {
  if (!arr || arr.length === 0) return null;
  const enGb = arr.find((e) => e.Locale === 'en-GB');
  return (enGb ?? arr[0]).Description ?? null;
}

/** Map FIFA's int MatchStatus to canonical MatchStatus (see FIFA_MATCH_STATUS). */
export function mapStatus(raw: number | undefined): MatchStatus {
  if (raw === undefined) return 'scheduled';
  return FIFA_MATCH_STATUS[raw] ?? 'scheduled';
}

/** Map a FIFA IdStage to our canonical round key (default 'group'). */
export function mapRound(idStage: string | undefined): string {
  if (!idStage) return 'group';
  return FIFA_STAGE_ROUND[idStage] ?? 'group';
}

/** Coerce a possibly-null numeric score to number|null. */
function score(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function normalizeMatch(m: FifaMatch): NormalizedMatchUpdate | null {
  if (!m.IdMatch || !m.Date) return null;

  const homeFifa = m.Home?.Abbreviation ?? null;
  const awayFifa = m.Away?.Abbreviation ?? null;
  // Knockout placeholders have no resolved teams yet — skip; the live-score
  // service matches by FIFA code pair, which needs both codes.
  if (!homeFifa || !awayFifa) return null;

  const status = mapStatus(m.MatchStatus);
  // Gate scores: only emit them once the match is not 'scheduled'. FIFA sends
  // null pre-game anyway, but this mirrors ESPN's pre-game gating.
  const live = status !== 'scheduled';

  return {
    sourceEventId: m.IdMatch,
    kickoffUtc: new Date(m.Date),
    homeFifa,
    awayFifa,
    status,
    minute: null, // calendar endpoint carries no playing minute
    homeScore: live ? score(m.HomeTeamScore) : null,
    awayScore: live ? score(m.AwayTeamScore) : null,
    homeScoreHt: null, // calendar carries no half-time detail
    awayScoreHt: null,
    homePens: score(m.HomeTeamPenaltyScore),
    awayPens: score(m.AwayTeamPenaltyScore),
  };
}

/**
 * Pure transform: FIFA calendar JSON → normalised match updates.
 * Mirrors ESPN's NormalizedMatchUpdate construction so live-score.service
 * resolves and applies them identically.
 */
export function normalizeCalendar(
  raw: FifaCalendarResponse,
): NormalizedMatchUpdate[] {
  if (!raw.Results) return [];
  return raw.Results.map(normalizeMatch).filter(
    (u): u is NormalizedMatchUpdate => u !== null,
  );
}

/**
 * Pure transform for the seed: FIFA calendar → per-match mapping rows
 * (matchNumber → IdMatch + FIFA codes + stadium). Includes knockout matches
 * (no resolved teams), so codes may be null.
 */
export function mapCalendar(raw: FifaCalendarResponse): FifaMatchMapping[] {
  if (!raw.Results) return [];
  const rows: FifaMatchMapping[] = [];
  for (const m of raw.Results) {
    if (!m.IdMatch || typeof m.MatchNumber !== 'number') continue;
    rows.push({
      matchNumber: m.MatchNumber,
      idMatch: m.IdMatch,
      idStage: m.IdStage ?? '',
      idGroup: m.IdGroup ?? null,
      round: mapRound(m.IdStage),
      homeFifaCode: m.Home?.Abbreviation ?? null,
      awayFifaCode: m.Away?.Abbreviation ?? null,
      idStadium: m.Stadium?.IdStadium ?? null,
    });
  }
  return rows;
}
