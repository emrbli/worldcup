import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mapFdStatus,
  normalizeFdScoreboard,
} from './football-data-score.normalize.js';
import { normalizeOfficials } from './football-data-officials.normalize.js';
import type { FDMatchesResponse, FDReferee } from './football-data.types.js';

const loadFixture = (name: string): FDMatchesResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as FDMatchesResponse;

// ---------------------------------------------------------------------------
// mapFdStatus
// ---------------------------------------------------------------------------

describe('mapFdStatus', () => {
  it('SCHEDULED → scheduled', () =>
    expect(mapFdStatus('SCHEDULED')).toBe('scheduled'));
  it('TIMED → scheduled', () => expect(mapFdStatus('TIMED')).toBe('scheduled'));
  it('IN_PLAY → live', () => expect(mapFdStatus('IN_PLAY')).toBe('live'));
  it('PAUSED → ht (half-time break)', () =>
    expect(mapFdStatus('PAUSED')).toBe('ht'));
  it('FINISHED → ft', () => expect(mapFdStatus('FINISHED')).toBe('ft'));
  it('AWARDED → ft (walkover)', () =>
    expect(mapFdStatus('AWARDED')).toBe('ft'));
  it('SUSPENDED → postponed', () =>
    expect(mapFdStatus('SUSPENDED')).toBe('postponed'));
  it('POSTPONED → postponed', () =>
    expect(mapFdStatus('POSTPONED')).toBe('postponed'));
  it('CANCELLED → postponed', () =>
    expect(mapFdStatus('CANCELLED')).toBe('postponed'));
  it('unknown → scheduled (safe default)', () =>
    expect(mapFdStatus('UNKNOWN_FUTURE')).toBe('scheduled'));
});

// ---------------------------------------------------------------------------
// normalizeFdScoreboard — synthetic fixture
// ---------------------------------------------------------------------------

describe('normalizeFdScoreboard — synthetic fixture', () => {
  const fixture = loadFixture('football-data-matches.json');
  const updates = normalizeFdScoreboard(fixture);

  it('returns 6 updates', () => {
    expect(updates.length).toBe(6);
  });

  it('TIMED match → scheduled, scores null', () => {
    const timed = updates[0];
    expect(timed.status).toBe('scheduled');
    expect(timed.homeScore).toBeNull();
    expect(timed.awayScore).toBeNull();
  });

  it('IN_PLAY match → live, scores from fullTime', () => {
    const live = updates.find((u) => u.status === 'live');
    expect(live).toBeDefined();
    expect(live?.homeScore).toBe(1);
    expect(live?.awayScore).toBe(0);
    expect(live?.minute).toBe(34);
  });

  it('PAUSED match → ht', () => {
    const ht = updates.find((u) => u.status === 'ht');
    expect(ht).toBeDefined();
    expect(ht?.homeScore).toBe(1);
    expect(ht?.awayScore).toBe(1);
  });

  it('FINISHED match → ft, final scores', () => {
    const ft = updates.find((u) => u.status === 'ft');
    expect(ft).toBeDefined();
    expect(ft?.homeScore).toBe(3);
    expect(ft?.awayScore).toBe(1);
    expect(ft?.homeScoreHt).toBe(2);
    expect(ft?.awayScoreHt).toBe(0);
  });

  it('POSTPONED match → postponed, scores null', () => {
    const postponed = updates.find((u) => u.status === 'postponed');
    expect(postponed).toBeDefined();
    expect(postponed?.homeScore).toBeNull();
  });

  it('tla maps to homeFifa/awayFifa', () => {
    // tla is the 3-letter FIFA code on every match
    expect(updates.every((u) => u.homeFifa.length === 3)).toBe(true);
    expect(updates.every((u) => u.awayFifa.length === 3)).toBe(true);
  });

  it('sourceEventId is a string', () => {
    expect(typeof updates[0].sourceEventId).toBe('string');
  });

  it('kickoffUtc is a valid Date', () => {
    expect(updates[0].kickoffUtc).toBeInstanceOf(Date);
    expect(Number.isNaN(updates[0].kickoffUtc.getTime())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeFdScoreboard — date filter
// ---------------------------------------------------------------------------

describe('normalizeFdScoreboard — date filter', () => {
  const fixture = loadFixture('football-data-matches.json');

  it('filters to matches on the given UTC date', () => {
    // All 2026 WC matches — pick the first match's date
    if (fixture.matches.length === 0) return;
    const firstDate = new Date(
      fixture.matches[0].utcDate.slice(0, 10) + 'T00:00:00Z',
    );
    const filtered = normalizeFdScoreboard(fixture, firstDate);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });

  it('returns [] when no matches on the given date', () => {
    const far = new Date('2030-01-01T00:00:00Z');
    expect(normalizeFdScoreboard(fixture, far)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeFdScoreboard — edge cases
// ---------------------------------------------------------------------------

describe('normalizeFdScoreboard — edge cases', () => {
  it('returns [] for empty matches[]', () => {
    expect(normalizeFdScoreboard({ matches: [] })).toEqual([]);
  });

  it('handles null fullTime scores (pre-game IN_PLAY edge case)', () => {
    const raw: FDMatchesResponse = {
      matches: [
        {
          id: 1,
          utcDate: '2026-06-11T19:00:00Z',
          status: 'IN_PLAY',
          homeTeam: { id: 1, name: 'Mexico', tla: 'MEX' },
          awayTeam: { id: 2, name: 'South Africa', tla: 'RSA' },
          score: {
            winner: null,
            duration: 'REGULAR',
            fullTime: { home: null, away: null },
            halfTime: { home: null, away: null },
          },
          referees: [],
        },
      ],
    };
    const [u] = normalizeFdScoreboard(raw);
    expect(u?.status).toBe('live');
    expect(u?.homeScore).toBeNull();
    expect(u?.awayScore).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeOfficials
// ---------------------------------------------------------------------------

describe('normalizeOfficials', () => {
  const fullCrew: FDReferee[] = [
    { id: 1, name: 'Tobias Stieler', type: 'REFEREE', nationality: 'Germany' },
    {
      id: 2,
      name: 'Mark Borsch',
      type: 'ASSISTANT_REFEREE_N1',
      nationality: 'Germany',
    },
    {
      id: 3,
      name: 'Stefan Lupp',
      type: 'ASSISTANT_REFEREE_N2',
      nationality: 'Germany',
    },
    {
      id: 4,
      name: 'Francois Letexier',
      type: 'FOURTH_OFFICIAL',
      nationality: 'France',
    },
    {
      id: 5,
      name: 'Pol van Boekel',
      type: 'VIDEO_ASSISTANT_REFEREE_N1',
      nationality: 'Netherlands',
    },
    {
      id: 6,
      name: 'Tomasz Kwiatkowski',
      type: 'VIDEO_ASSISTANT_REFEREE_N2',
      nationality: 'Poland',
    },
  ];

  it('maps full crew correctly', () => {
    const o = normalizeOfficials(fullCrew);
    expect(o.referee).toBe('Tobias Stieler');
    expect(o.assistants).toEqual(['Mark Borsch', 'Stefan Lupp']);
    expect(o.fourth).toBe('Francois Letexier');
    expect(o.var).toBe('Pol van Boekel');
  });

  it('returns {} for empty referees array', () => {
    expect(normalizeOfficials([])).toEqual({});
  });

  it('missing FOURTH_OFFICIAL → fourth is undefined', () => {
    const partial: FDReferee[] = [
      {
        id: 1,
        name: 'Facundo Tello',
        type: 'REFEREE',
        nationality: 'Argentina',
      },
    ];
    const o = normalizeOfficials(partial);
    expect(o.referee).toBe('Facundo Tello');
    expect(o.fourth).toBeUndefined();
    expect(o.assistants).toBeUndefined();
  });

  it('null nationality is ignored (only name is stored)', () => {
    const refs: FDReferee[] = [
      { id: 1, name: 'Test Referee', type: 'REFEREE', nationality: null },
    ];
    const o = normalizeOfficials(refs);
    expect(o.referee).toBe('Test Referee');
  });

  it('unknown type is silently skipped', () => {
    const refs: FDReferee[] = [
      { id: 1, name: 'Main Ref', type: 'REFEREE', nationality: 'DE' },
      { id: 2, name: 'Mystery', type: 'UNKNOWN_ROLE', nationality: null },
    ];
    const o = normalizeOfficials(refs);
    expect(o.referee).toBe('Main Ref');
    expect(Object.keys(o)).toEqual(['referee']);
  });

  it('order-independent: N2 before REFEREE still works', () => {
    const outOfOrder: FDReferee[] = [
      {
        id: 3,
        name: 'Asst 2',
        type: 'ASSISTANT_REFEREE_N2',
        nationality: null,
      },
      { id: 1, name: 'Main', type: 'REFEREE', nationality: null },
      {
        id: 2,
        name: 'Asst 1',
        type: 'ASSISTANT_REFEREE_N1',
        nationality: null,
      },
    ];
    const o = normalizeOfficials(outOfOrder);
    expect(o.referee).toBe('Main');
    // assistants are appended in encounter order (N2 then N1 here)
    expect(o.assistants).toEqual(['Asst 2', 'Asst 1']);
  });

  it('real fixture: finished match with full crew', () => {
    const fixture = JSON.parse(
      readFileSync(
        join(__dirname, '../../../test/fixtures/football-data-matches.json'),
        'utf8',
      ),
    ) as FDMatchesResponse;
    const finished = fixture.matches.find((m) => m.status === 'FINISHED');
    expect(finished).toBeDefined();
    const o = normalizeOfficials(finished!.referees);
    expect(o.referee).toBe('Tobias Stieler');
    expect(o.assistants?.length).toBe(2);
    expect(o.fourth).toBe('Francois Letexier');
    expect(o.var).toBe('Pol van Boekel');
  });
});
