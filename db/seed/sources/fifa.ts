// ---------------------------------------------------------------------------
// FIFA first-party seed source (secondary / enrichment — see master plan §6).
//
// STATIC seed only (master plan §8 A): fetched ONCE, written to Postgres, never
// a runtime dependency. Provides:
//   • calendar  → source_ids.fifa mapping onto existing matches/teams/venues
//   • watch     → broadcasts table (per-market TV/stream listings)
//
// Plain fetch (no Nest DI) so the standalone seed script can use it directly.
// ---------------------------------------------------------------------------

import type {
  FifaCalendarResponse,
  FifaWatchResponse,
} from '../../../src/adapters/fifa/fifa.types.js';

const BASE = (process.env.FIFA_API_BASE_URL ?? 'https://api.fifa.com/api/v3').replace(
  /\/+$/,
  '',
);
const SEASON = process.env.FIFA_SEASON_ID ?? '285023';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`FIFA fetch failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json() as Promise<T>;
}

/** Full calendar (all 104 matches) — carries every FIFA id + stadium. */
export async function fetchFifaCalendar(): Promise<FifaCalendarResponse> {
  return getJson(
    `${BASE}/calendar/matches?idSeason=${SEASON}&count=500&language=en`,
  );
}

/** Broadcasters per market (large payload — ~90 countries). */
export async function fetchFifaWatch(): Promise<FifaWatchResponse> {
  return getJson(`${BASE}/watch/season/${SEASON}?language=en`);
}

/** FIFA team code (Abbreviation) → IdTeam, extracted from calendar matches. */
export function extractTeamFifaIds(raw: FifaCalendarResponse): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of raw.Results ?? []) {
    for (const t of [m.Home, m.Away]) {
      if (t?.Abbreviation && t.IdTeam) map.set(t.Abbreviation, t.IdTeam);
    }
  }
  return map;
}
