// ---------------------------------------------------------------------------
// FIFA first-party SQUADS (FIFA-first authority for jersey numbers + position).
// Fetches the official squad list from the FIFA first-party API (enrichment).
// Returns the official 26-man WC squad with JerseyNum, PositionLocalized,
// BirthDate, IdPlayer. (No club — FIFA omits it for national-team context;
// club is filled from a secondary source.) Plain fetch + polite retry.
// ---------------------------------------------------------------------------

import type { Localized } from '../../../src/adapters/fifa/fifa.types.js';

const BASE = (process.env.FIFA_API_BASE_URL ?? 'https://api.fifa.com/api/v3').replace(
  /\/+$/,
  '',
);
const SEASON = process.env.FIFA_SEASON_ID ?? '285023';
const COMP = '17';

export interface FifaSquadPlayer {
  idPlayer: string;
  name: string;
  number: number | null;
  position: string | null;
  dob: string | null; // 'YYYY-MM-DD'
}

interface RawSquadPlayer {
  IdPlayer?: string;
  PlayerName?: Localized;
  JerseyNum?: number | null;
  PositionLocalized?: Localized;
  BirthDate?: string | null;
}
interface RawSquad {
  Players?: RawSquadPlayer[];
}

function loc(a?: Localized | null): string | null {
  if (!a || a.length === 0) return null;
  return (a.find((e) => e.Locale === 'en-GB') ?? a[0]).Description ?? null;
}

/** "Raul RANGEL" → "Raul Rangel" (FIFA upper-cases surnames). */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase())
    .trim();
}

const delay = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Fetch one team's official FIFA squad. Retries 403/429/5xx with backoff. */
export async function fetchFifaSquad(idTeam: string): Promise<FifaSquadPlayer[]> {
  const url = `${BASE}/teams/${idTeam}/squad?idCompetition=${COMP}&idSeason=${SEASON}&language=en`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      lastErr = err;
      await delay(800 * 2 ** attempt);
      continue;
    }
    if (res.ok) {
      const raw = (await res.json()) as RawSquad;
      return (raw.Players ?? [])
        .filter((p) => p.IdPlayer)
        .map((p) => ({
          idPlayer: p.IdPlayer as string,
          name: titleCase(loc(p.PlayerName) ?? ''),
          number: typeof p.JerseyNum === 'number' ? p.JerseyNum : null,
          position: loc(p.PositionLocalized),
          dob: p.BirthDate ? p.BirthDate.slice(0, 10) : null,
        }));
    }
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      lastErr = new Error(`FIFA squad ${res.status} (${url})`);
      await delay(800 * 2 ** attempt);
      continue;
    }
    throw new Error(`FIFA squad failed: ${res.status} ${res.statusText} (${url})`);
  }
  throw lastErr instanceof Error ? lastErr : new Error(`FIFA squad retries exhausted: ${idTeam}`);
}
