import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeTimeline } from './fifa-timeline.normalize.js';
import type { FifaTimelineResponse } from './fifa.types.js';

const loadFixture = (name: string): FifaTimelineResponse =>
  JSON.parse(
    readFileSync(join(__dirname, `../../../test/fixtures/${name}`), 'utf8'),
  ) as FifaTimelineResponse;

describe('normalizeTimeline — real fixture (empty Event[])', () => {
  it('returns [] when Event[] is empty', () => {
    expect(normalizeTimeline(loadFixture('fifa-timeline.json'))).toEqual([]);
  });

  it('returns [] when Event is absent', () => {
    expect(normalizeTimeline({})).toEqual([]);
  });
});

describe('normalizeTimeline — synthetic fixture (provisional Type map)', () => {
  const events = normalizeTimeline(loadFixture('fifa-timeline-sample.json'));

  it('maps all 3 events', () => {
    expect(events.length).toBe(3);
  });

  it('maps a goal (Type 0)', () => {
    const goal = events[0];
    expect(goal.type).toBe('goal');
    expect(goal.minute).toBe(12);
    expect(goal.fifaIdTeam).toBe('43911');
    expect(goal.playerName).toBe('Player One');
    expect(goal.detail.rawType).toBe(0);
  });

  it('maps a yellow card (Type 3)', () => {
    expect(events[1].type).toBe('yellow');
    expect(events[1].minute).toBe(34);
  });

  it('maps a substitution (Type 5)', () => {
    expect(events[2].type).toBe('sub');
    expect(events[2].minute).toBe(60);
  });

  it('unknown Type → other', () => {
    const [e] = normalizeTimeline({
      Event: [{ Type: 999, MatchMinute: "90+2'" }],
    });
    expect(e.type).toBe('other');
    expect(e.minute).toBe(90);
  });
});
