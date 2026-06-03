import type { FDReferee } from './football-data.types.js';
import { FD_REFEREE_TYPE } from './football-data.types.js';
import type { OfficialsJson } from './football-data.types.js';

/**
 * Normalize football-data.org referees[] into our canonical officials JSON.
 *
 * Returns an empty object when referees is empty or has no recognisable roles
 * (officials are typically assigned ~48h before kickoff).
 */
export function normalizeOfficials(referees: FDReferee[]): OfficialsJson {
  if (!referees || referees.length === 0) return {};

  const officials: OfficialsJson = {};
  const assistants: string[] = [];

  for (const ref of referees) {
    switch (ref.type) {
      case FD_REFEREE_TYPE.REFEREE:
        officials.referee = ref.name;
        break;
      case FD_REFEREE_TYPE.ASSISTANT_REFEREE_N1:
      case FD_REFEREE_TYPE.ASSISTANT_REFEREE_N2:
        assistants.push(ref.name);
        break;
      case FD_REFEREE_TYPE.FOURTH_OFFICIAL:
        officials.fourth = ref.name;
        break;
      case FD_REFEREE_TYPE.VIDEO_ASSISTANT_REFEREE_N1:
        officials.var = ref.name;
        break;
      case FD_REFEREE_TYPE.VIDEO_ASSISTANT_REFEREE_N2:
        // second VAR official — not stored separately; ignore
        break;
      default:
        // unknown role — silently skip (forward-compatible)
        break;
    }
  }

  if (assistants.length > 0) officials.assistants = assistants;
  return officials;
}
