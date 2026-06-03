import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeLive } from './fifa-live.normalize.js';
import type { FifaLiveResponse } from './fifa.types.js';

const loadFixture = (name: string): FifaLiveResponse | null =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as FifaLiveResponse | null;

describe('normalizeLive — real fixture (null)', () => {
  it('null → empty lineups + officials', () => {
    expect(normalizeLive(loadFixture('fifa-live.json'))).toEqual({
      lineups: [],
      officials: {},
    });
  });
});

describe('normalizeLive — tolerant when present', () => {
  it('maps lineups and officials', () => {
    const raw: FifaLiveResponse = {
      HomeTeam: {
        IdTeam: '43911',
        Tactics: '4-3-3',
        Players: [{ IdPlayer: 'P1' }],
      },
      AwayTeam: { IdTeam: '43883', Tactics: null, Players: [] },
      Officials: [
        {
          OfficialType: 1,
          Name: [{ Locale: 'en-GB', Description: 'Ref One' }],
        },
        {
          OfficialType: 2,
          Name: [{ Locale: 'en-GB', Description: 'Assist A' }],
        },
        {
          OfficialType: 3,
          Name: [{ Locale: 'en-GB', Description: 'Assist B' }],
        },
        {
          OfficialType: 4,
          Name: [{ Locale: 'en-GB', Description: 'Fourth' }],
        },
        { OfficialType: 5, Name: [{ Locale: 'en-GB', Description: 'VAR' }] },
      ],
    };
    const out = normalizeLive(raw);
    expect(out.lineups).toEqual([
      {
        fifaIdTeam: '43911',
        formation: '4-3-3',
        players: [{ IdPlayer: 'P1' }],
      },
      { fifaIdTeam: '43883', formation: null, players: [] },
    ]);
    expect(out.officials).toEqual({
      referee: 'Ref One',
      assistants: ['Assist A', 'Assist B'],
      fourth: 'Fourth',
      var: 'VAR',
    });
  });

  it('handles empty officials gracefully', () => {
    const out = normalizeLive({ HomeTeam: { IdTeam: '1' }, Officials: [] });
    expect(out.officials).toEqual({});
    expect(out.lineups).toHaveLength(1);
  });
});
