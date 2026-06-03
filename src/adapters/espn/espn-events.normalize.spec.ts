import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  mapEventType,
  parseEventMinute,
  normalizeEspnEvents,
} from './espn-events.normalize.js';
import type {
  EspnSummaryResponse,
  EspnCompetitionDetail,
} from './espn.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loadFixture = (name: string): EspnSummaryResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as EspnSummaryResponse;

function makeDetail(
  overrides: Partial<EspnCompetitionDetail> = {},
): EspnCompetitionDetail {
  return {
    clock: { displayValue: "38'" },
    scoringPlay: false,
    team: { id: '1', abbreviation: 'MEX', displayName: 'Mexico' },
    participants: [{ athlete: { displayName: 'Test Player' } }],
    redCard: false,
    penaltyKick: false,
    ownGoal: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mapEventType
// ---------------------------------------------------------------------------

describe('mapEventType', () => {
  it('ownGoal=true → own_goal (highest priority)', () => {
    expect(mapEventType(makeDetail({ ownGoal: true, scoringPlay: true }))).toBe(
      'own_goal',
    );
  });
  it('penaltyKick=true → penalty', () => {
    expect(
      mapEventType(makeDetail({ penaltyKick: true, scoringPlay: true })),
    ).toBe('penalty');
  });
  it('scoringPlay=true → goal', () => {
    expect(mapEventType(makeDetail({ scoringPlay: true }))).toBe('goal');
  });
  it('redCard=true → red', () => {
    expect(mapEventType(makeDetail({ redCard: true }))).toBe('red');
  });
  it('default → yellow (e.g. yellow card detail with no flags)', () => {
    expect(mapEventType(makeDetail())).toBe('yellow');
  });
});

// ---------------------------------------------------------------------------
// parseEventMinute
// ---------------------------------------------------------------------------

describe('parseEventMinute', () => {
  it("'38'\" → 38", () => expect(parseEventMinute("38'")).toBe(38));
  it("'90+2'\" → 90 (first integer)", () =>
    expect(parseEventMinute("90+2'")).toBe(90));
  it("'0'\" → 0", () => expect(parseEventMinute("0'")).toBe(0));
  it('undefined → null', () => expect(parseEventMinute(undefined)).toBeNull());
  it('empty string → null', () => expect(parseEventMinute('')).toBeNull());
});

// ---------------------------------------------------------------------------
// normalizeEspnEvents — real completed fixture (USA vs IRN)
// ---------------------------------------------------------------------------

describe('normalizeEspnEvents — real completed fixture', () => {
  const fixture = loadFixture('espn-summary-completed.json');
  const events = normalizeEspnEvents(fixture);

  it('extracts at least one event', () => {
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('first event is a goal by Pulisic (USA)', () => {
    const goal = events.find((e) => e.type === 'goal');
    expect(goal).toBeDefined();
    expect(goal?.teamFifa).toBe('USA');
    expect(goal?.playerName).toContain('Pulisic');
    expect(goal?.minute).toBe(38);
  });

  it('all events have teamFifa', () => {
    expect(events.every((e) => e.teamFifa.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeEspnEvents — pre-game fixture (no details yet)
// ---------------------------------------------------------------------------

describe('normalizeEspnEvents — pre-game fixture', () => {
  const fixture = loadFixture('espn-summary-760415.json');

  it('returns [] when details is empty (pre-game)', () => {
    const events = normalizeEspnEvents(fixture);
    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// normalizeEspnEvents — synthetic edge cases
// ---------------------------------------------------------------------------

describe('normalizeEspnEvents — edge cases', () => {
  it('returns [] for empty summary', () => {
    expect(normalizeEspnEvents({} as EspnSummaryResponse)).toEqual([]);
  });

  it('skips details with null team', () => {
    const summary: EspnSummaryResponse = {
      header: {
        competitions: [
          {
            competitors: [],
            status: {
              type: {
                id: '1',
                name: 'STATUS_FULL_TIME',
                state: 'post',
                completed: true,
              },
            },
            details: [
              makeDetail({ team: null }),
              makeDetail({ scoringPlay: true }),
            ],
          },
        ],
      },
    };
    const events = normalizeEspnEvents(summary);
    expect(events.length).toBe(1); // null-team event skipped
    expect(events[0].type).toBe('goal');
  });

  it('handles own goal, penalty, red card', () => {
    const summary: EspnSummaryResponse = {
      header: {
        competitions: [
          {
            competitors: [],
            status: {
              type: {
                id: '1',
                name: 'STATUS_FULL_TIME',
                state: 'post',
                completed: true,
              },
            },
            details: [
              makeDetail({ ownGoal: true }),
              makeDetail({ penaltyKick: true, scoringPlay: true }),
              makeDetail({ redCard: true }),
            ],
          },
        ],
      },
    };
    const events = normalizeEspnEvents(summary);
    expect(events.map((e) => e.type)).toEqual(['own_goal', 'penalty', 'red']);
  });

  it('playerName is null when no participants', () => {
    const summary: EspnSummaryResponse = {
      header: {
        competitions: [
          {
            competitors: [],
            status: {
              type: {
                id: '1',
                name: 'STATUS_FULL_TIME',
                state: 'post',
                completed: true,
              },
            },
            details: [makeDetail({ scoringPlay: true, participants: [] })],
          },
        ],
      },
    };
    const [event] = normalizeEspnEvents(summary);
    expect(event.playerName).toBeNull();
  });
});
