import { localized } from './fifa-calendar.normalize.js';
import type {
  FifaLiveResponse,
  FifaLiveTeam,
  OfficialsJson,
} from './fifa.types.js';

export interface FifaLineup {
  fifaIdTeam: string;
  formation: string | null;
  players: unknown[];
}

export interface FifaLiveNormalized {
  lineups: FifaLineup[];
  officials: OfficialsJson;
}

function normalizeTeam(
  team: FifaLiveTeam | null | undefined,
): FifaLineup | null {
  if (!team || !team.IdTeam) return null;
  return {
    fifaIdTeam: team.IdTeam,
    formation: typeof team.Tactics === 'string' ? team.Tactics : null,
    players: Array.isArray(team.Players) ? team.Players : [],
  };
}

/**
 * Map FIFA Officials[] into the canonical OfficialsJson shape.
 * OfficialType (provisional): 1=referee, 2/3=assistants, 4=fourth, 5/6=VAR.
 */
function normalizeOfficials(raw: FifaLiveResponse): OfficialsJson {
  const officials = raw.Officials;
  if (!Array.isArray(officials) || officials.length === 0) return {};

  const out: OfficialsJson = {};
  const assistants: string[] = [];

  for (const o of officials) {
    const name = localized(o.Name);
    if (!name) continue;
    switch (o.OfficialType) {
      case 1:
        out.referee = name;
        break;
      case 2:
      case 3:
        assistants.push(name);
        break;
      case 4:
        out.fourth = name;
        break;
      case 5:
      case 6:
        out.var = name;
        break;
      default:
        break;
    }
  }

  if (assistants.length > 0) out.assistants = assistants;
  return out;
}

/**
 * Pure transform: FIFA live JSON → lineups + officials.
 * The real fixture is `null` (no live match) → returns empty structures.
 * Tolerant of partial payloads when a match is live.
 */
export function normalizeLive(
  raw: FifaLiveResponse | null,
): FifaLiveNormalized {
  if (!raw) return { lineups: [], officials: {} };

  const lineups: FifaLineup[] = [];
  const home = normalizeTeam(raw.HomeTeam);
  const away = normalizeTeam(raw.AwayTeam);
  if (home) lineups.push(home);
  if (away) lineups.push(away);

  return { lineups, officials: normalizeOfficials(raw) };
}
