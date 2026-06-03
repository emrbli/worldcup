import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeTopScorers } from './fifa-leaders.normalize.js';
import type { FifaTopScorersResponse } from './fifa.types.js';

const loadFixture = (name: string): FifaTopScorersResponse | null =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as FifaTopScorersResponse | null;

describe('normalizeTopScorers — real fixture (null)', () => {
  it('null → []', () => {
    expect(normalizeTopScorers(loadFixture('fifa-topscorers.json'))).toEqual(
      [],
    );
  });

  it('missing Results → []', () => {
    expect(normalizeTopScorers({})).toEqual([]);
  });
});

describe('normalizeTopScorers — tolerant when present', () => {
  it('maps leader rows', () => {
    const raw: FifaTopScorersResponse = {
      Results: [
        {
          Rank: 1,
          Value: 5,
          IdPlayer: 'P1',
          IdTeam: '43911',
          PlayerName: [{ Locale: 'en-GB', Description: 'Striker One' }],
          TeamName: [{ Locale: 'en-GB', Description: 'Mexico' }],
        },
      ],
    };
    expect(normalizeTopScorers(raw)).toEqual([
      {
        category: 'topscorers',
        scope: 'player',
        rank: 1,
        value: 5,
        playerName: 'Striker One',
        teamName: 'Mexico',
        idPlayer: 'P1',
        idTeam: '43911',
      },
    ]);
  });
});
