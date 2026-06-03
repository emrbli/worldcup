import type {
  FifaBroadcastRow,
  FifaWatchResponse,
  FifaWatchSource,
} from './fifa.types.js';

/** Pick the best stream/tv URL from a source. */
function pickUrl(s: FifaWatchSource): string | null {
  return s.Url || s.TvChannelUrl || null;
}

/**
 * 'stream' when the source exposes a watch URL, else 'tv' (best-effort).
 * FIFA does not flag this explicitly; default 'tv'.
 */
function pickKind(s: FifaWatchSource): 'tv' | 'stream' {
  return s.Url || s.TvChannelUrl ? 'stream' : 'tv';
}

/**
 * Pure transform: FIFA watch JSON → flat broadcaster rows
 * (country × match × source).
 */
export function normalizeWatch(raw: FifaWatchResponse): FifaBroadcastRow[] {
  if (!raw.Results) return [];
  const rows: FifaBroadcastRow[] = [];

  for (const country of raw.Results) {
    const market = country.IdCountryIso3166Alpha2 || country.IdCountry || '';
    for (const match of country.Matches ?? []) {
      const idMatch = match.IdMatch;
      if (!idMatch) continue;
      for (const source of match.Sources ?? []) {
        rows.push({
          idMatch,
          market,
          channel: source.Name ?? '',
          kind: pickKind(source),
          url: pickUrl(source),
          language: source.Language ?? null,
          logoUrl: source.Logo ?? null,
          idChannel: source.IdChannel ?? null,
        });
      }
    }
  }

  return rows;
}
