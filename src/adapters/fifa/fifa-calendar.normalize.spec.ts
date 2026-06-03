import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  localized,
  mapCalendar,
  mapRound,
  mapStatus,
  normalizeCalendar,
} from './fifa-calendar.normalize.js';
import type { FifaCalendarResponse } from './fifa.types.js';

const loadFixture = (name: string): FifaCalendarResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as FifaCalendarResponse;

const fixture = loadFixture('fifa-calendar.json');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

describe('localized', () => {
  it('picks en-GB description', () => {
    expect(
      localized([
        { Locale: 'fr-FR', Description: 'Mexique' },
        { Locale: 'en-GB', Description: 'Mexico' },
      ]),
    ).toBe('Mexico');
  });
  it('falls back to first when no en-GB', () => {
    expect(localized([{ Locale: 'fr-FR', Description: 'Mexique' }])).toBe(
      'Mexique',
    );
  });
  it('returns null for empty/undefined', () => {
    expect(localized([])).toBeNull();
    expect(localized(undefined)).toBeNull();
  });
});

describe('mapStatus', () => {
  it('1 → scheduled', () => expect(mapStatus(1)).toBe('scheduled'));
  it('3 → live', () => expect(mapStatus(3)).toBe('live'));
  it('10 → ft', () => expect(mapStatus(10)).toBe('ft'));
  it('undefined → scheduled', () =>
    expect(mapStatus(undefined)).toBe('scheduled'));
  it('unknown code → scheduled', () => expect(mapStatus(99)).toBe('scheduled'));
});

describe('mapRound', () => {
  it('group stage', () => expect(mapRound('289273')).toBe('group'));
  it('final stage', () => expect(mapRound('289292')).toBe('final'));
  it('r16 stage', () => expect(mapRound('289288')).toBe('r16'));
  it('unknown → group', () => expect(mapRound('999')).toBe('group'));
  it('undefined → group', () => expect(mapRound(undefined)).toBe('group'));
});

// ---------------------------------------------------------------------------
// normalizeCalendar — real fixture (all scheduled)
// ---------------------------------------------------------------------------

describe('normalizeCalendar — real fixture', () => {
  const updates = normalizeCalendar(fixture);

  it('returns one update per match (all have resolved teams)', () => {
    expect(updates.length).toBe(fixture.Results!.length);
  });

  it('extracts MEX vs RSA codes', () => {
    const mex = updates.find((u) => u.homeFifa === 'MEX');
    expect(mex).toBeDefined();
    expect(mex?.awayFifa).toBe('RSA');
  });

  it('all scheduled pre-tournament', () => {
    expect(updates.every((u) => u.status === 'scheduled')).toBe(true);
  });

  it('scores + minute null pre-game', () => {
    const mex = updates.find((u) => u.homeFifa === 'MEX');
    expect(mex?.homeScore).toBeNull();
    expect(mex?.awayScore).toBeNull();
    expect(mex?.minute).toBeNull();
  });

  it('sourceEventId is IdMatch; kickoffUtc parses to UTC', () => {
    const mex = updates.find((u) => u.homeFifa === 'MEX');
    expect(mex?.sourceEventId).toBe('400021443');
    expect(mex?.kickoffUtc.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });
});

describe('normalizeCalendar — score gating + edge cases', () => {
  it('emits gated scores once status is live', () => {
    const raw: FifaCalendarResponse = {
      Results: [
        {
          IdMatch: '1',
          Date: '2026-06-11T19:00:00Z',
          MatchStatus: 3,
          Home: { Abbreviation: 'MEX' },
          Away: { Abbreviation: 'RSA' },
          HomeTeamScore: 2,
          AwayTeamScore: 1,
        },
      ],
    };
    const [u] = normalizeCalendar(raw);
    expect(u.status).toBe('live');
    expect(u.homeScore).toBe(2);
    expect(u.awayScore).toBe(1);
  });

  it('skips matches without resolved team codes (knockout placeholders)', () => {
    const raw: FifaCalendarResponse = {
      Results: [
        { IdMatch: '1', Date: '2026-07-01T19:00:00Z', Home: {}, Away: {} },
      ],
    };
    expect(normalizeCalendar(raw)).toEqual([]);
  });

  it('returns [] for missing Results', () => {
    expect(normalizeCalendar({})).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapCalendar — seed mapping
// ---------------------------------------------------------------------------

describe('mapCalendar — real fixture', () => {
  const rows = mapCalendar(fixture);

  it('one row per match with a MatchNumber', () => {
    expect(rows.length).toBe(fixture.Results!.length);
  });

  it('maps match 1 → IdMatch + codes + stadium + round', () => {
    const m1 = rows.find((r) => r.matchNumber === 1);
    expect(m1).toBeDefined();
    expect(m1?.idMatch).toBe('400021443');
    expect(m1?.homeFifaCode).toBe('MEX');
    expect(m1?.awayFifaCode).toBe('RSA');
    expect(m1?.idStadium).toBe('400222084');
    expect(m1?.idStage).toBe('289273');
    expect(m1?.round).toBe('group');
    expect(m1?.idGroup).toBe('289275');
  });

  it('returns [] for missing Results', () => {
    expect(mapCalendar({})).toEqual([]);
  });
});
