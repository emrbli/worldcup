import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeWatch } from './fifa-watch.normalize.js';
import type { FifaWatchResponse } from './fifa.types.js';

const loadFixture = (name: string): FifaWatchResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as FifaWatchResponse;

describe('normalizeWatch — real fixture', () => {
  const rows = normalizeWatch(loadFixture('fifa-watch.json'));

  it('flattens country × match × source into rows', () => {
    // AFG: 3 + 3, ALB: 1 + 1, ALG: 3 + 3 = 14
    expect(rows.length).toBe(14);
  });

  it('uses ISO alpha-2 as market', () => {
    expect(rows.some((r) => r.market === 'AF')).toBe(true);
    expect(rows.some((r) => r.market === 'AL')).toBe(true);
  });

  it('maps an AFG row fully', () => {
    const row = rows.find((r) => r.market === 'AF' && r.idChannel === '912');
    expect(row).toMatchObject({
      idMatch: '400021443',
      channel: 'AWCC Sports Portal',
      kind: 'stream',
      url: 'https://sports.afghan-wireless.com/',
      language: 'English',
      logoUrl: 'https://extranets.fifa.com/TvStationPhotos/912.png',
    });
  });

  it('returns [] for missing Results', () => {
    expect(normalizeWatch({})).toEqual([]);
  });

  it('defaults kind to tv when no urls', () => {
    const rows = normalizeWatch({
      Results: [
        {
          IdCountryIso3166Alpha2: 'TR',
          Matches: [
            { IdMatch: '1', Sources: [{ Name: 'TRT', Language: 'Turkish' }] },
          ],
        },
      ],
    });
    expect(rows[0].kind).toBe('tv');
    expect(rows[0].url).toBeNull();
  });
});
