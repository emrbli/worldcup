import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeEspnLineups } from './espn-lineups.normalize.js';
import type { EspnSummaryResponse } from './espn.types.js';

const loadFixture = (name: string): EspnSummaryResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as EspnSummaryResponse;

// ---------------------------------------------------------------------------
// normalizeEspnLineups — real completed fixture (IRN vs USA)
// ---------------------------------------------------------------------------

describe('normalizeEspnLineups — real completed fixture', () => {
  const fixture = loadFixture('espn-summary-completed.json');
  const lineups = normalizeEspnLineups(fixture);

  it('returns 2 lineup results (one per team)', () => {
    expect(lineups.length).toBe(2);
  });

  it('team FIFA codes are extracted', () => {
    const fifas = lineups.map((l) => l.teamFifa);
    expect(fifas).toContain('IRN');
    expect(fifas).toContain('USA');
  });

  it('formation is null (ESPN does not provide it)', () => {
    expect(lineups.every((l) => l.formation === null)).toBe(true);
  });

  it('players array is non-empty', () => {
    expect(lineups.every((l) => l.players.length > 0)).toBe(true);
  });

  it('IRN has 24 players', () => {
    const irn = lineups.find((l) => l.teamFifa === 'IRN');
    expect(irn?.players.length).toBe(24);
  });

  it('starters and non-starters correctly mapped', () => {
    const irn = lineups.find((l) => l.teamFifa === 'IRN');
    const starters = irn?.players.filter((p) => p.starter);
    expect(starters?.length).toBeGreaterThanOrEqual(11);
  });

  it('jersey → number (integer or null)', () => {
    const irn = lineups.find((l) => l.teamFifa === 'IRN');
    const withNumber = irn?.players.filter((p) => p.number !== null);
    expect(withNumber?.length).toBeGreaterThan(0);
    // All numbers should be positive integers
    expect(
      withNumber?.every((p) => typeof p.number === 'number' && p.number > 0),
    ).toBe(true);
  });

  it('position abbreviation extracted', () => {
    const irn = lineups.find((l) => l.teamFifa === 'IRN');
    const withPos = irn?.players.filter((p) => p.position !== null);
    expect(withPos?.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeEspnLineups — pre-game fixture (no rosters yet)
// ---------------------------------------------------------------------------

describe('normalizeEspnLineups — pre-game fixture (no individual roster entries yet)', () => {
  const fixture = loadFixture('espn-summary-760415.json');
  const lineups = normalizeEspnLineups(fixture);

  it('returns 2 entries (teams present but rosters empty pre-game)', () => {
    // ESPN includes team stubs but roster[] is empty before lineup announcement
    expect(lineups.length).toBe(2);
  });

  it('players arrays are empty (not announced yet)', () => {
    expect(lineups.every((l) => l.players.length === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeEspnLineups — edge cases
// ---------------------------------------------------------------------------

describe('normalizeEspnLineups — edge cases', () => {
  it('returns [] for empty summary', () => {
    expect(normalizeEspnLineups({} as EspnSummaryResponse)).toEqual([]);
  });

  it('returns [] when rosters is empty array', () => {
    expect(
      normalizeEspnLineups({
        header: { competitions: [] },
        rosters: [],
      }),
    ).toEqual([]);
  });

  it('handles missing jersey gracefully', () => {
    const summary: EspnSummaryResponse = {
      header: { competitions: [] },
      rosters: [
        {
          homeAway: 'home',
          team: { id: '1', abbreviation: 'MEX' },
          roster: [
            {
              starter: true,
              jersey: '',
              position: { abbreviation: 'GK' },
              athlete: { displayName: 'Test GK' },
              subbedIn: false,
              subbedOut: false,
            },
          ],
        },
      ],
    };
    const [lineup] = normalizeEspnLineups(summary);
    expect(lineup.players[0].number).toBeNull();
    expect(lineup.players[0].name).toBe('Test GK');
  });
});
