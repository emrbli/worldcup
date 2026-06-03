import {
  LiveScoreService,
  pairKey,
  resolveTarget,
} from './live-score.service.js';
import type { CanonicalMatch, MatchLookup } from './live-score.service.js';
import type { LiveScorePort } from '../../domain/live-score.port.js';

// ---------------------------------------------------------------------------
// Minimal mock helpers — no DB, no network
// ---------------------------------------------------------------------------

function makeAdapter(
  name: string,
  priority: number,
  result: [] | Error,
): jest.Mocked<LiveScorePort> {
  return {
    name,
    priority,
    fetchUpdates: jest.fn().mockImplementation(() => {
      if (result instanceof Error) return Promise.reject(result);
      return Promise.resolve(result);
    }),
  };
}

/** Returns an object that is awaitable AND supports further chaining. */
function thenable(value: unknown[] = []) {
  const obj: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(value).then(resolve),
    catch: (reject: (e: unknown) => unknown) =>
      Promise.resolve(value).catch(reject),
  };
  // chain methods return themselves (awaitable)
  const chain = () => thenable(value);
  obj['where'] = jest.fn(chain);
  obj['orderBy'] = jest.fn(chain);
  obj['from'] = jest.fn(chain);
  return obj;
}

function makeDb() {
  return {
    select: jest.fn(() => thenable([])),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

function makeService(adapters: LiveScorePort[], db = makeDb()) {
  const emitter = { emit: jest.fn() };
  const service = new LiveScoreService(db as never, adapters, emitter as never);
  return { service, db, emitter };
}

// ---------------------------------------------------------------------------
// pairKey helper
// ---------------------------------------------------------------------------

describe('pairKey', () => {
  it('produces a stable order-independent key', () => {
    expect(pairKey('MEX', 'RSA')).toBe('MEX-RSA');
    expect(pairKey('RSA', 'MEX')).toBe('MEX-RSA');
  });
  it('same teams → same key regardless of order', () => {
    expect(pairKey('ARG', 'BRA')).toBe(pairKey('BRA', 'ARG'));
  });
});

// ---------------------------------------------------------------------------
// resolveTarget — matching decision (id → pair → kickoff)
// ---------------------------------------------------------------------------

describe('resolveTarget', () => {
  const kickoff = new Date('2026-06-28T19:00:00Z');

  const groupMatch: CanonicalMatch = {
    id: 'group-1',
    homeTeamId: 'mex',
    awayTeamId: 'rsa',
    homeFifa: 'MEX',
    awayFifa: 'RSA',
    espnEventId: null,
    groupId: 'group-a',
    kickoffUtc: new Date('2026-06-11T19:00:00Z'),
  };
  const stampedMatch: CanonicalMatch = {
    id: 'stamped-1',
    homeTeamId: 'arg',
    awayTeamId: 'bra',
    homeFifa: 'ARG',
    awayFifa: 'BRA',
    espnEventId: '999',
    groupId: null,
    kickoffUtc: new Date('2026-06-29T19:00:00Z'),
  };
  const knockoutSlot: CanonicalMatch = {
    id: 'r32-1',
    homeTeamId: null,
    awayTeamId: null,
    homeFifa: null,
    awayFifa: null,
    espnEventId: null,
    groupId: null,
    kickoffUtc: kickoff,
  };

  function buildLookup(matches: CanonicalMatch[]): MatchLookup {
    const lookup: MatchLookup = {
      byEspnId: new Map(),
      byPair: new Map(),
      byKickoff: new Map(),
    };
    for (const m of matches) {
      if (m.espnEventId) lookup.byEspnId.set(m.espnEventId, m);
      if (m.homeFifa && m.awayFifa)
        lookup.byPair.set(pairKey(m.homeFifa, m.awayFifa), m);
      if ((!m.homeTeamId || !m.awayTeamId) && m.kickoffUtc) {
        const key = m.kickoffUtc.toISOString();
        const list = lookup.byKickoff.get(key) ?? [];
        list.push(m);
        lookup.byKickoff.set(key, list);
      }
    }
    return lookup;
  }

  it('matches by ESPN id first (highest priority)', () => {
    const lookup = buildLookup([stampedMatch]);
    const res = resolveTarget(
      {
        sourceEventId: '999',
        homeFifa: 'ARG',
        awayFifa: 'BRA',
        kickoffUtc: stampedMatch.kickoffUtc!,
      },
      lookup,
    );
    expect(res.kind).toBe('id');
    if (res.kind === 'id') expect(res.match.id).toBe('stamped-1');
  });

  it('matches group match by FIFA pair (order-independent)', () => {
    const lookup = buildLookup([groupMatch]);
    const res = resolveTarget(
      {
        sourceEventId: '111',
        homeFifa: 'RSA',
        awayFifa: 'MEX',
        kickoffUtc: groupMatch.kickoffUtc!,
      },
      lookup,
    );
    expect(res.kind).toBe('pair');
    if (res.kind === 'pair') expect(res.match.id).toBe('group-1');
  });

  it('resolves an unresolved knockout slot by kickoff timestamp', () => {
    const lookup = buildLookup([knockoutSlot]);
    const res = resolveTarget(
      {
        sourceEventId: '760500',
        homeFifa: 'FRA',
        awayFifa: 'ENG',
        kickoffUtc: kickoff,
      },
      lookup,
    );
    expect(res.kind).toBe('kickoff');
    if (res.kind === 'kickoff') expect(res.match.id).toBe('r32-1');
  });

  it('returns ambiguous when two unresolved slots share a kickoff time', () => {
    const slot2: CanonicalMatch = { ...knockoutSlot, id: 'r32-2' };
    const lookup = buildLookup([knockoutSlot, slot2]);
    const res = resolveTarget(
      {
        sourceEventId: '760500',
        homeFifa: 'FRA',
        awayFifa: 'ENG',
        kickoffUtc: kickoff,
      },
      lookup,
    );
    expect(res.kind).toBe('ambiguous');
    if (res.kind === 'ambiguous') expect(res.count).toBe(2);
  });

  it('returns none when nothing matches', () => {
    const lookup = buildLookup([groupMatch]);
    const res = resolveTarget(
      {
        sourceEventId: 'x',
        homeFifa: 'JPN',
        awayFifa: 'GER',
        kickoffUtc: new Date('2026-07-01T19:00:00Z'),
      },
      lookup,
    );
    expect(res.kind).toBe('none');
  });

  it('prefers an already-stamped knockout match by id over kickoff fallback', () => {
    // Once a knockout slot has been resolved + stamped, it matches by id, not kickoff
    const resolved: CanonicalMatch = {
      ...knockoutSlot,
      id: 'r32-resolved',
      homeTeamId: 'fra',
      awayTeamId: 'eng',
      homeFifa: 'FRA',
      awayFifa: 'ENG',
      espnEventId: '760500',
    };
    const lookup = buildLookup([resolved]);
    const res = resolveTarget(
      {
        sourceEventId: '760500',
        homeFifa: 'FRA',
        awayFifa: 'ENG',
        kickoffUtc: kickoff,
      },
      lookup,
    );
    expect(res.kind).toBe('id');
  });
});

// ---------------------------------------------------------------------------
// Adapter chain fallback
// ---------------------------------------------------------------------------

describe('LiveScoreService — adapter chain fallback', () => {
  it('primary succeeds → secondary never called', async () => {
    const a1 = makeAdapter('espn', 1, []);
    const a2 = makeAdapter('worldcupjson', 2, []);
    const { service } = makeService([a1, a2]);

    await service.syncDate(new Date());

    expect(a1.fetchUpdates).toHaveBeenCalledTimes(1);
    expect(a2.fetchUpdates).not.toHaveBeenCalled();
  });

  it('primary throws → falls back to secondary', async () => {
    const a1 = makeAdapter('espn', 1, new Error('ESPN down'));
    const a2 = makeAdapter('worldcupjson', 2, []);
    const { service } = makeService([a1, a2]);

    await service.syncDate(new Date());

    expect(a1.fetchUpdates).toHaveBeenCalledTimes(1);
    expect(a2.fetchUpdates).toHaveBeenCalledTimes(1);
  });

  it('primary+secondary throw → falls back to tertiary', async () => {
    const a1 = makeAdapter('espn', 1, new Error('ESPN down'));
    const a2 = makeAdapter('worldcupjson', 2, new Error('WCJ down'));
    const a3 = makeAdapter('football-data', 3, []);
    const { service } = makeService([a1, a2, a3]);

    await service.syncDate(new Date());

    expect(a3.fetchUpdates).toHaveBeenCalledTimes(1);
  });

  it('all adapters fail → syncDate throws', async () => {
    const a1 = makeAdapter('espn', 1, new Error('ESPN down'));
    const a2 = makeAdapter('worldcupjson', 2, new Error('WCJ down'));
    const { service } = makeService([a1, a2]);

    await expect(service.syncDate(new Date())).rejects.toThrow(
      'All live-score adapters failed',
    );
  });

  it('respects priority order regardless of insertion order', async () => {
    const calls: string[] = [];
    const a3: LiveScorePort = {
      name: 'fd',
      priority: 3,
      fetchUpdates: jest.fn(() => {
        calls.push('fd');
        return Promise.resolve([]);
      }),
    };
    const a1: LiveScorePort = {
      name: 'espn',
      priority: 1,
      fetchUpdates: jest.fn(() => {
        calls.push('espn');
        return Promise.resolve([]);
      }),
    };
    const a2: LiveScorePort = {
      name: 'wcj',
      priority: 2,
      fetchUpdates: jest.fn(() => {
        calls.push('wcj');
        return Promise.resolve([]);
      }),
    };
    const { service } = makeService([a3, a1, a2]); // inserted out of order

    await service.syncDate(new Date());

    expect(calls[0]).toBe('espn'); // priority 1 goes first
    expect(a2.fetchUpdates as jest.Mock).not.toHaveBeenCalled(); // stops after first success
  });
});

// ---------------------------------------------------------------------------
// Empty updates
// ---------------------------------------------------------------------------

describe('LiveScoreService — empty updates', () => {
  it('returns fetched=0 when no matches on the day', async () => {
    const a1 = makeAdapter('espn', 1, []);
    const { service } = makeService([a1]);

    const result = await service.syncDate(new Date());

    expect(result.fetched).toBe(0);
    expect(result.matched).toBe(0);
    expect(result.updated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sync_log
// ---------------------------------------------------------------------------

describe('LiveScoreService — sync_log', () => {
  it('writes sync_log on success', async () => {
    const a1 = makeAdapter('espn', 1, []);
    const { service, db } = makeService([a1]);

    await service.syncDate(new Date());

    expect(db.execute).toHaveBeenCalled();
  });

  it('writes sync_log with error when all adapters fail', async () => {
    const a1 = makeAdapter('espn', 1, new Error('ESPN down'));
    const a2 = makeAdapter('wcj', 2, new Error('WCJ down'));
    const { service, db } = makeService([a1, a2]);

    await expect(service.syncDate(new Date())).rejects.toThrow();
    expect(db.execute).toHaveBeenCalled();
  });
});
