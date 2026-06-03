import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mapStatus,
  parseMinute,
  normalizeScoreboard,
} from './espn.normalize.js';
import type { EspnScoreboard, EspnStatus } from './espn.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loadFixture = (name: string): EspnScoreboard =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as EspnScoreboard;

const status = (
  name: string,
  state: 'pre' | 'in' | 'post',
  clock?: number,
  displayClock?: string,
): EspnStatus => ({
  clock,
  displayClock,
  type: { id: '1', name, state, completed: state === 'post' },
});

// ---------------------------------------------------------------------------
// mapStatus
// ---------------------------------------------------------------------------

describe('mapStatus', () => {
  describe('scheduled states', () => {
    it('STATUS_SCHEDULED (pre) → scheduled', () => {
      expect(mapStatus(status('STATUS_SCHEDULED', 'pre'))).toBe('scheduled');
    });
    it('STATUS_DELAYED (pre) → scheduled (not live)', () => {
      expect(mapStatus(status('STATUS_DELAYED', 'pre'))).toBe('scheduled');
    });
    it('STATUS_RAIN_DELAY (pre) → scheduled', () => {
      expect(mapStatus(status('STATUS_RAIN_DELAY', 'pre'))).toBe('scheduled');
    });
  });

  describe('live states', () => {
    it('STATUS_IN_PROGRESS (in) → live', () => {
      expect(mapStatus(status('STATUS_IN_PROGRESS', 'in'))).toBe('live');
    });
    it('STATUS_EXTRA_TIME (in) → live', () => {
      expect(mapStatus(status('STATUS_EXTRA_TIME', 'in'))).toBe('live');
    });
    it('STATUS_PENALTY (in) → live (penalty shootout)', () => {
      expect(mapStatus(status('STATUS_PENALTY', 'in'))).toBe('live');
    });
    it('unknown name + state=in → live (forward-compatible)', () => {
      expect(mapStatus(status('STATUS_UNKNOWN_FUTURE', 'in'))).toBe('live');
    });
  });

  describe('halftime', () => {
    it('STATUS_HALFTIME → ht', () => {
      expect(mapStatus(status('STATUS_HALFTIME', 'in'))).toBe('ht');
    });
  });

  describe('finished states', () => {
    it('STATUS_FULL_TIME (post) → ft', () => {
      expect(mapStatus(status('STATUS_FULL_TIME', 'post'))).toBe('ft');
    });
    it('STATUS_FINAL (post) → ft', () => {
      expect(mapStatus(status('STATUS_FINAL', 'post'))).toBe('ft');
    });
  });

  describe('postponed states', () => {
    it('STATUS_POSTPONED → postponed', () => {
      expect(mapStatus(status('STATUS_POSTPONED', 'pre'))).toBe('postponed');
    });
    it('STATUS_ABANDONED (post) → postponed', () => {
      expect(mapStatus(status('STATUS_ABANDONED', 'post'))).toBe('postponed');
    });
    it('STATUS_SUSPENDED (in) → postponed', () => {
      expect(mapStatus(status('STATUS_SUSPENDED', 'in'))).toBe('postponed');
    });
    it('STATUS_CANCELLED → postponed', () => {
      expect(mapStatus(status('STATUS_CANCELLED', 'pre'))).toBe('postponed');
    });
  });
});

// ---------------------------------------------------------------------------
// parseMinute
// ---------------------------------------------------------------------------

describe('parseMinute', () => {
  it('returns null when pre-game', () => {
    expect(parseMinute(status('STATUS_SCHEDULED', 'pre'))).toBeNull();
  });
  it('returns null when post-game', () => {
    expect(parseMinute(status('STATUS_FULL_TIME', 'post'))).toBeNull();
  });
  it("parses displayClock '45'", () => {
    expect(
      parseMinute(status('STATUS_IN_PROGRESS', 'in', undefined, "45'")),
    ).toBe(45);
  });
  it("parses displayClock '90+2'' → 90 (first integer)", () => {
    expect(
      parseMinute(status('STATUS_IN_PROGRESS', 'in', undefined, "90+2'")),
    ).toBe(90);
  });
  it("parses displayClock '0'' → 0", () => {
    expect(
      parseMinute(status('STATUS_IN_PROGRESS', 'in', undefined, "0'")),
    ).toBe(0);
  });
  it('falls back to clock when no displayClock', () => {
    expect(parseMinute(status('STATUS_IN_PROGRESS', 'in', 67.8))).toBe(67);
  });
  it('returns null when both clock and displayClock absent', () => {
    expect(parseMinute(status('STATUS_IN_PROGRESS', 'in'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeScoreboard — pre-game fixture (2026-06-11)
// ---------------------------------------------------------------------------

describe('normalizeScoreboard — pre-game fixture (2026-06-11)', () => {
  const fixture = loadFixture('espn-scoreboard-20260611.json');
  const updates = normalizeScoreboard(fixture);

  it('returns one update per event', () => {
    expect(updates.length).toBe(fixture.events.length);
  });

  it('extracts home/away FIFA codes (MEX @ home, RSA @ away)', () => {
    const mex = updates.find((u) => u.homeFifa === 'MEX');
    expect(mex).toBeDefined();
    expect(mex?.awayFifa).toBe('RSA');
  });

  it('status = scheduled before kick-off', () => {
    expect(updates.every((u) => u.status === 'scheduled')).toBe(true);
  });

  it('scores are null pre-game (ESPN sends "0" but state=pre gates it)', () => {
    const mex = updates.find((u) => u.homeFifa === 'MEX');
    expect(mex?.homeScore).toBeNull();
    expect(mex?.awayScore).toBeNull();
  });

  it('minute is null pre-game', () => {
    expect(updates.every((u) => u.minute === null)).toBe(true);
  });

  it('kickoffUtc is a valid UTC Date', () => {
    const mex = updates.find((u) => u.homeFifa === 'MEX');
    expect(mex?.kickoffUtc.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  it('uses sourceEventId (not espnEventId)', () => {
    const mex = updates.find((u) => u.homeFifa === 'MEX');
    expect(mex?.sourceEventId).toBe('760415');
  });
});

// ---------------------------------------------------------------------------
// normalizeScoreboard — live/ht/ft fixture (synthetic)
// ---------------------------------------------------------------------------

describe('normalizeScoreboard — live/ht/ft states (synthetic fixture)', () => {
  const fixture = loadFixture('espn-scoreboard-live.json');
  // Fixture contains 3 events: live (2-1), ht (1-1), ft (2-1)
  const updates = normalizeScoreboard(fixture);

  it('returns 3 updates', () => {
    expect(updates.length).toBe(3);
  });

  it('live event: status=live, scores populated, minute=67', () => {
    const live = updates.find((u) => u.status === 'live');
    expect(live).toBeDefined();
    expect(live?.homeScore).toBe(2);
    expect(live?.awayScore).toBe(1);
    expect(live?.minute).toBe(67);
  });

  it('ht event: status=ht', () => {
    const ht = updates.find((u) => u.status === 'ht');
    expect(ht).toBeDefined();
    expect(ht?.homeScore).toBe(1);
    expect(ht?.awayScore).toBe(1);
  });

  it('ft event: status=ft, scores final', () => {
    const ft = updates.find((u) => u.status === 'ft');
    expect(ft).toBeDefined();
    expect(ft?.homeScore).toBe(2);
    expect(ft?.awayScore).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// normalizeScoreboard — edge cases
// ---------------------------------------------------------------------------

describe('normalizeScoreboard — edge cases', () => {
  it('returns [] for empty events', () => {
    expect(normalizeScoreboard({ events: [] })).toEqual([]);
  });

  it('returns [] when events key is undefined', () => {
    expect(normalizeScoreboard({} as EspnScoreboard)).toEqual([]);
  });

  it('skips events with no competitions', () => {
    const raw: EspnScoreboard = {
      events: [
        {
          id: 'x',
          date: '2026-06-11T19:00Z',
          status: {
            type: {
              id: '1',
              name: 'STATUS_SCHEDULED',
              state: 'pre',
              completed: false,
            },
          },
          competitions: [],
        },
      ],
    };
    expect(normalizeScoreboard(raw)).toEqual([]);
  });

  it('skips events with only one competitor', () => {
    const raw: EspnScoreboard = {
      events: [
        {
          id: 'x',
          date: '2026-06-11T19:00Z',
          status: {
            type: {
              id: '1',
              name: 'STATUS_SCHEDULED',
              state: 'pre',
              completed: false,
            },
          },
          competitions: [
            {
              id: 'x',
              competitors: [
                {
                  id: '1',
                  homeAway: 'home',
                  team: { id: '1', abbreviation: 'MEX', displayName: 'Mexico' },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(normalizeScoreboard(raw)).toEqual([]);
  });

  it('handles missing score field gracefully during live game', () => {
    const raw: EspnScoreboard = {
      events: [
        {
          id: '999',
          date: '2026-06-11T19:00Z',
          status: {
            displayClock: "23'",
            type: {
              id: '2',
              name: 'STATUS_IN_PROGRESS',
              state: 'in',
              completed: false,
            },
          },
          competitions: [
            {
              id: '999',
              competitors: [
                {
                  id: '1',
                  homeAway: 'home',
                  team: { id: '1', abbreviation: 'MEX', displayName: 'Mexico' },
                },
                {
                  id: '2',
                  homeAway: 'away',
                  team: {
                    id: '2',
                    abbreviation: 'RSA',
                    displayName: 'South Africa',
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    const [u] = normalizeScoreboard(raw);
    expect(u?.homeScore).toBeNull();
    expect(u?.awayScore).toBeNull();
    expect(u?.status).toBe('live');
    expect(u?.minute).toBe(23);
  });
});
