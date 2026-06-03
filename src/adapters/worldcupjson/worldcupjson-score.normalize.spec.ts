import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mapWcjStatus,
  normalizeWcjScoreboard,
} from './worldcupjson-score.normalize.js';
import type { WCJMatchesResponse } from './worldcupjson.types.js';

const loadFixture = (name: string): WCJMatchesResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as WCJMatchesResponse;

// ---------------------------------------------------------------------------
// mapWcjStatus
// ---------------------------------------------------------------------------

describe('mapWcjStatus', () => {
  it('"future" → scheduled', () =>
    expect(mapWcjStatus('future')).toBe('scheduled'));
  it('"in_progress" → live', () =>
    expect(mapWcjStatus('in_progress')).toBe('live'));
  it('"completed" → ft', () => expect(mapWcjStatus('completed')).toBe('ft'));
  it('unknown value → scheduled (forward-compatible)', () => {
    expect(mapWcjStatus('unknown_future_status')).toBe('scheduled');
  });
});

// ---------------------------------------------------------------------------
// normalizeWcjScoreboard — real fixture (2022 WC data, all completed)
// ---------------------------------------------------------------------------

describe('normalizeWcjScoreboard — real matches fixture', () => {
  const fixture = loadFixture('worldcupjson-matches.json');
  const updates = normalizeWcjScoreboard(fixture);

  it('returns one update per match', () => {
    expect(updates.length).toBe(fixture.length);
  });

  it('all statuses are "ft" (2022 WC completed)', () => {
    expect(updates.every((u) => u.status === 'ft')).toBe(true);
  });

  it('home_team_country maps to homeFifa', () => {
    const qat = updates.find((u) => u.homeFifa === 'QAT');
    expect(qat).toBeDefined();
  });

  it('kickoffUtc is a valid Date', () => {
    expect(updates[0].kickoffUtc).toBeInstanceOf(Date);
    expect(Number.isNaN(updates[0].kickoffUtc.getTime())).toBe(false);
  });

  it('sourceEventId is a string', () => {
    expect(typeof updates[0].sourceEventId).toBe('string');
  });

  it('minute is null (worldcupjson does not expose live minute)', () => {
    expect(updates.every((u) => u.minute === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeWcjScoreboard — synthetic live/future/completed fixture
// ---------------------------------------------------------------------------

describe('normalizeWcjScoreboard — synthetic fixture (completed + future + live)', () => {
  const fixture = loadFixture('worldcupjson-match-live.json');
  const updates = normalizeWcjScoreboard(fixture);

  it('returns 3 updates', () => {
    expect(updates.length).toBe(3);
  });

  it('completed match: status=ft, scores populated', () => {
    const completed = updates.find((u) => u.status === 'ft');
    expect(completed).toBeDefined();
    // QAT vs ECU: QAT 0-2 ECU (2022 opener)
    expect(completed?.homeScore).not.toBeUndefined();
  });

  it('future match: status=scheduled, scores null', () => {
    const future = updates.find((u) => u.status === 'scheduled');
    expect(future).toBeDefined();
    expect(future?.homeFifa).toBe('MEX');
    expect(future?.homeScore).toBeNull();
    expect(future?.awayScore).toBeNull();
  });

  it('live match: status=live, scores from goals field', () => {
    const live = updates.find((u) => u.status === 'live');
    expect(live).toBeDefined();
    expect(live?.homeFifa).toBe('ARG');
    expect(live?.awayFifa).toBe('BRA');
    expect(live?.homeScore).toBe(1);
    expect(live?.awayScore).toBe(0);
    expect(live?.minute).toBeNull(); // worldcupjson has no minute
  });
});

// ---------------------------------------------------------------------------
// normalizeWcjScoreboard — date filter
// ---------------------------------------------------------------------------

describe('normalizeWcjScoreboard — date filter', () => {
  const fixture = loadFixture('worldcupjson-match-live.json');

  it('filters to only matches on the given UTC date', () => {
    const june11 = new Date('2026-06-11T00:00:00Z');
    const updates = normalizeWcjScoreboard(fixture, june11);
    // synthetic fixture has MEX vs RSA on 2026-06-11
    expect(updates.length).toBe(1);
    expect(updates[0].homeFifa).toBe('MEX');
  });

  it('returns [] when no matches on given date', () => {
    const farFuture = new Date('2030-01-01T00:00:00Z');
    expect(normalizeWcjScoreboard(fixture, farFuture)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeWcjScoreboard — edge cases
// ---------------------------------------------------------------------------

describe('normalizeWcjScoreboard — edge cases', () => {
  it('returns [] for empty array', () => {
    expect(normalizeWcjScoreboard([])).toEqual([]);
  });

  it('handles null goals for in_progress match gracefully', () => {
    const raw: WCJMatchesResponse = [
      {
        id: 1,
        venue: 'Test',
        location: 'Test',
        status: 'in_progress',
        attendance: null,
        stage_name: 'Group',
        home_team_country: 'MEX',
        away_team_country: 'RSA',
        datetime: '2026-06-11T19:00:00Z',
        winner: null,
        winner_code: null,
        home_team: {
          country: 'MEX',
          name: 'Mexico',
          goals: null,
          penalties: null,
        },
        away_team: {
          country: 'RSA',
          name: 'South Africa',
          goals: null,
          penalties: null,
        },
        last_checked_at: null,
        last_changed_at: null,
      },
    ];
    const [u] = normalizeWcjScoreboard(raw);
    expect(u?.status).toBe('live');
    expect(u?.homeScore).toBeNull(); // null goals → null score
  });
});
