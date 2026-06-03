import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeStandings } from './fifa-standings.normalize.js';
import type { FifaStandingResponse } from './fifa.types.js';

const loadFixture = (name: string): FifaStandingResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as FifaStandingResponse;

describe('normalizeStandings — real fixture', () => {
  const rows = normalizeStandings(loadFixture('fifa-standings.json'));

  it('one row per result', () => {
    expect(rows.length).toBe(4);
  });

  it('maps Mexico row (rank 1)', () => {
    const mex = rows.find((r) => r.fifaCode === 'MEX');
    expect(mex).toMatchObject({
      idGroup: '289275',
      idTeam: '43911',
      played: 0,
      points: 0,
      rank: 1,
      gd: 0,
    });
  });

  it('preserves positions', () => {
    expect(rows.map((r) => r.rank).sort()).toEqual([1, 2, 3, 4]);
  });

  it('returns [] for missing Results', () => {
    expect(normalizeStandings({})).toEqual([]);
  });
});
