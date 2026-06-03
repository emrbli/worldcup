import type {
  FifaStanding,
  FifaStandingResponse,
  FifaStandingRow,
} from './fifa.types.js';

function num(value: number | undefined): number {
  return typeof value === 'number' ? value : 0;
}

function normalizeRow(s: FifaStanding): FifaStandingRow {
  return {
    idGroup: s.IdGroup ?? null,
    fifaCode: s.Team?.Abbreviation ?? null,
    idTeam: s.IdTeam ?? s.Team?.IdTeam ?? null,
    played: num(s.Played),
    won: num(s.Won),
    drawn: num(s.Drawn),
    lost: num(s.Lost),
    gf: num(s.For),
    ga: num(s.Against),
    gd: num(s.GoalsDiference),
    points: num(s.Points),
    rank: num(s.Position),
  };
}

/** Pure transform: FIFA standing JSON → standings rows. */
export function normalizeStandings(
  raw: FifaStandingResponse,
): FifaStandingRow[] {
  if (!raw.Results) return [];
  return raw.Results.map(normalizeRow);
}
