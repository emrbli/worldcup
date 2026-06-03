import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../../src/lib/db/schema.js';
import {
  confederations,
  groups,
  cities,
  venues,
  teams,
  matches,
  standings,
  bracketSlots,
  broadcasts,
  dataSources,
} from '../../src/lib/db/schema.js';
import { CONFEDERATIONS, TEAM_META, GROUND_META, VENUE_CAPACITY } from './sources/static.js';
import {
  fetchOpenfootball,
  normalizeGroups,
  normalizeGroundNames,
  normalizeMatches,
} from './sources/openfootball.js';
import {
  fetchFifaCalendar,
  fetchFifaWatch,
  extractTeamFifaIds,
} from './sources/fifa.js';
import { mapCalendar } from '../../src/adapters/fifa/fifa-calendar.normalize.js';
import { normalizeWatch } from '../../src/adapters/fifa/fifa-watch.normalize.js';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function count(table: { getSQL: () => unknown }, label: string): Promise<number> {
  // Using raw sql to count any table
  const res = await db.execute(sql`SELECT count(*)::int AS n FROM ${sql.raw(`"${label}"`)}`) as { rows: { n: number }[] };
  return res.rows[0]?.n ?? 0;
}

async function countTable(tableName: string): Promise<number> {
  const res = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${tableName}"`)) as { rows: { n: number }[] };
  return res.rows[0]?.n ?? 0;
}

function log(msg: string): void {
  process.stdout.write(`  ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Seeders
// ---------------------------------------------------------------------------

async function seedConfederations(): Promise<void> {
  await db.insert(confederations)
    .values(CONFEDERATIONS.map((c) => ({ code: c.code, name: c.name })))
    .onConflictDoNothing();
  log(`confederations: ${await countTable('confederations')}`);
}

async function seedDataSources(): Promise<void> {
  await db.insert(dataSources)
    .values([
      { key: 'openfootball',  baseUrl: 'https://github.com/openfootball/worldcup.json', type: 'static', enabled: true, priority: 1 },
      { key: 'espn',          baseUrl: 'https://site.api.espn.com',                     type: 'api',    enabled: true, priority: 2 },
      { key: 'worldcupjson',  baseUrl: 'https://worldcupjson.net',                      type: 'api',    enabled: true, priority: 3 },
      { key: 'football-data', baseUrl: 'https://api.football-data.org/v4',              type: 'api',    enabled: true, priority: 4 },
      // FIFA first-party — secondary/enrichment, high number = low priority (last in chain).
      { key: 'fifa',          baseUrl: 'https://api.fifa.com/api/v3',                   type: 'api',    enabled: true, priority: 9 },
    ])
    .onConflictDoNothing();
  log(`data_sources: ${await countTable('data_sources')}`);
}

async function seedGroups(raw: Awaited<ReturnType<typeof fetchOpenfootball>>): Promise<Map<string, string>> {
  const ofGroups = normalizeGroups(raw);
  // groups has unique constraint on letter → onConflictDoNothing is safe
  for (const g of ofGroups) {
    await db.insert(groups)
      .values({ letter: g.letter, name: g.name })
      .onConflictDoNothing();
  }
  // Build letter → uuid map
  const rows = await db.select({ id: groups.id, letter: groups.letter }).from(groups);
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.letter) map.set(r.letter, r.id);
  }
  log(`groups: ${map.size}`);
  return map;
}

async function seedCitiesAndVenues(
  raw: Awaited<ReturnType<typeof fetchOpenfootball>>,
): Promise<Map<string, string>> {
  const groundNames = normalizeGroundNames(raw);
  const venueMap = new Map<string, string>(); // groundName → venue uuid

  // Check if already seeded (no unique constraint — skip if data exists)
  const existingVenues = await db.select({ id: venues.id, name: venues.name }).from(venues);
  if (existingVenues.length > 0) {
    for (const v of existingVenues) {
      // Reverse map: venue name → id (ground names match venue names set below)
      const groundEntry = Object.entries(GROUND_META).find(([, meta]) => meta.venueName === v.name);
      if (groundEntry) venueMap.set(groundEntry[0], v.id);
    }
    log(`cities: ${await countTable('cities')} (skipped — already seeded)`);
    log(`venues: ${venueMap.size} (skipped — already seeded)`);
    return venueMap;
  }

  for (const ground of groundNames) {
    const meta = GROUND_META[ground];
    if (!meta) {
      log(`  WARN: no metadata for ground "${ground}" — skipping`);
      continue;
    }

    // City
    const [city] = await db.insert(cities)
      .values({
        name: meta.cityName,
        country: meta.country,
        timezone: meta.timezone,
        lat: meta.lat,
        lng: meta.lng,
      })
      .returning({ id: cities.id });

    // Venue
    const [venue] = await db.insert(venues)
      .values({
        name: meta.venueName,
        fifaName: meta.venueName,
        cityId: city.id,
        country: meta.country,
        lat: meta.lat,
        lng: meta.lng,
        sourceIds: { openfootball: ground },
      })
      .returning({ id: venues.id });

    venueMap.set(ground, venue.id);
  }

  log(`cities: ${await countTable('cities')}`);
  log(`venues: ${venueMap.size}`);
  return venueMap;
}

async function seedTeams(
  raw: Awaited<ReturnType<typeof fetchOpenfootball>>,
  groupMap: Map<string, string>,
): Promise<Map<string, string>> {
  const teamMap = new Map<string, string>(); // teamName → uuid

  // Check if already seeded
  const existing = await db.select({ id: teams.id, name: teams.name }).from(teams);
  if (existing.length > 0) {
    for (const t of existing) {
      if (t.name) teamMap.set(t.name, t.id);
    }
    log(`teams: ${teamMap.size} (skipped — already seeded)`);
    return teamMap;
  }

  // Extract unique teams from group-phase matches
  const groupMatches = normalizeMatches(raw).filter((m) => m.stage === 'group');
  const teamNames = new Set<string>();
  for (const m of groupMatches) {
    if (m.team1Name) teamNames.add(m.team1Name);
    if (m.team2Name) teamNames.add(m.team2Name);
  }

  // Determine group per team (first match where team appears)
  const teamGroup = new Map<string, string>();
  for (const m of groupMatches) {
    if (m.team1Name && m.groupLetter && !teamGroup.has(m.team1Name)) teamGroup.set(m.team1Name, m.groupLetter);
    if (m.team2Name && m.groupLetter && !teamGroup.has(m.team2Name)) teamGroup.set(m.team2Name, m.groupLetter);
  }

  for (const name of [...teamNames].sort()) {
    const meta = TEAM_META[name];
    const groupLetter = teamGroup.get(name);
    const groupId = groupLetter ? groupMap.get(groupLetter) : undefined;

    const [team] = await db.insert(teams)
      .values({
        name,
        fifaCode: meta?.fifaCode ?? null,
        iso2: meta?.iso2 ?? null,
        confederation: meta?.confederation ?? null,
        groupId: groupId ?? null,
        isHost: ['Mexico', 'USA', 'Canada'].includes(name),
        sourceIds: { openfootball: name },
        nameI18n: {},
      })
      .returning({ id: teams.id });

    teamMap.set(name, team.id);
  }

  log(`teams: ${teamMap.size}`);
  return teamMap;
}

async function seedMatches(
  raw: Awaited<ReturnType<typeof fetchOpenfootball>>,
  groupMap: Map<string, string>,
  teamMap: Map<string, string>,
  venueMap: Map<string, string>,
): Promise<void> {
  const existing = await countTable('matches');
  if (existing > 0) {
    log(`matches: ${existing} (skipped — already seeded)`);
    return;
  }

  const normalised = normalizeMatches(raw);
  for (const m of normalised) {
    await db.insert(matches).values({
      matchNumber: m.matchNumber,
      stage: m.stage,
      groupId: m.groupLetter ? (groupMap.get(m.groupLetter) ?? null) : null,
      matchday: m.matchday,
      homeTeamId: m.team1Name ? (teamMap.get(m.team1Name) ?? null) : null,
      awayTeamId: m.team2Name ? (teamMap.get(m.team2Name) ?? null) : null,
      homePlaceholder: m.homePlaceholder,
      awayPlaceholder: m.awayPlaceholder,
      venueId: venueMap.get(m.groundName) ?? null,
      kickoffUtc: m.kickoffUtc,
      status: 'scheduled',
      sourceIds: m.matchNumber >= 73
        ? { openfootball: String(m.matchNumber) }
        : { openfootball: `group-${m.matchNumber}` },
    });
  }

  log(`matches: ${await countTable('matches')}`);
}

async function seedStandings(): Promise<void> {
  const existing = await countTable('standings');
  if (existing > 0) {
    log(`standings: ${existing} (skipped — already seeded)`);
    return;
  }
  const allTeams = await db.select({ id: teams.id, groupId: teams.groupId }).from(teams);
  for (const team of allTeams) {
    if (!team.groupId) continue;
    await db.insert(standings)
      .values({ groupId: team.groupId, teamId: team.id })
      .onConflictDoNothing();
  }
  log(`standings: ${await countTable('standings')}`);
}

// ---------------------------------------------------------------------------
// FIFA enrichment (secondary — master plan §6/§8). STATIC seed: fetched once,
// written to Postgres, never a runtime dependency. Network-tolerant: on any
// FIFA fetch failure we log + skip (the core seed stays valid).
// ---------------------------------------------------------------------------

/** Fill venues.capacity from the curated static map (FIFA API returns null). */
async function enrichVenues(): Promise<void> {
  let n = 0;
  for (const [venueName, capacity] of Object.entries(VENUE_CAPACITY)) {
    await db.update(venues).set({ capacity }).where(eq(venues.name, venueName));
    n++;
  }
  log(`venue capacities: ${n} set`);
}

/** Merge {fifa: <id>} into existing source_ids on matches/teams/venues. */
async function enrichFifaSourceIds(): Promise<void> {
  let cal;
  try {
    cal = await fetchFifaCalendar();
  } catch (err) {
    log(`fifa source_ids: SKIPPED (calendar fetch failed: ${String(err)})`);
    return;
  }

  const mappings = mapCalendar(cal);

  // matches: match_number → IdMatch
  let mUpd = 0;
  for (const mp of mappings) {
    await db
      .update(matches)
      .set({
        sourceIds: sql`coalesce(${matches.sourceIds}, '{}'::jsonb) || ${JSON.stringify({ fifa: mp.idMatch })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(matches.matchNumber, mp.matchNumber));
    mUpd++;
  }

  // teams: fifa_code → IdTeam
  let tUpd = 0;
  for (const [code, idTeam] of extractTeamFifaIds(cal)) {
    await db
      .update(teams)
      .set({
        sourceIds: sql`coalesce(${teams.sourceIds}, '{}'::jsonb) || ${JSON.stringify({ fifa: idTeam })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(teams.fifaCode, code));
    tUpd++;
  }

  // venues: resolved via match_number → venue_id, stamped with IdStadium
  const matchRows = await db
    .select({ matchNumber: matches.matchNumber, venueId: matches.venueId })
    .from(matches);
  const venueByMatchNo = new Map<number, string>();
  for (const r of matchRows) {
    if (r.matchNumber && r.venueId) venueByMatchNo.set(r.matchNumber, r.venueId);
  }
  const venueFifa = new Map<string, string>(); // venueId → IdStadium
  for (const mp of mappings) {
    if (!mp.idStadium) continue;
    const vid = venueByMatchNo.get(mp.matchNumber);
    if (vid && !venueFifa.has(vid)) venueFifa.set(vid, mp.idStadium);
  }
  let vUpd = 0;
  for (const [vid, idStadium] of venueFifa) {
    await db
      .update(venues)
      .set({
        sourceIds: sql`coalesce(${venues.sourceIds}, '{}'::jsonb) || ${JSON.stringify({ fifa: idStadium })}::jsonb`,
      })
      .where(eq(venues.id, vid));
    vUpd++;
  }

  log(`fifa source_ids: matches=${mUpd} teams=${tUpd} venues=${vUpd}`);
}

/** Seed broadcasts from FIFA /watch (per-market TV/stream listings). */
async function seedBroadcasts(): Promise<void> {
  const existing = await countTable('broadcasts');
  if (existing > 0) {
    log(`broadcasts: ${existing} (skipped — already seeded)`);
    return;
  }

  let watch;
  try {
    watch = await fetchFifaWatch();
  } catch (err) {
    log(`broadcasts: SKIPPED (watch fetch failed: ${String(err)})`);
    return;
  }

  // Map FIFA IdMatch → our match id via the source_ids.fifa just stamped above.
  const matchRows = await db
    .select({ id: matches.id, sourceIds: matches.sourceIds })
    .from(matches);
  const matchByFifa = new Map<string, string>();
  for (const r of matchRows) {
    const f = r.sourceIds?.fifa;
    if (f) matchByFifa.set(f, r.id);
  }

  // Dedupe by (matchId, market, channel) — the table's unique key.
  const seen = new Set<string>();
  const values: (typeof broadcasts.$inferInsert)[] = [];
  for (const b of normalizeWatch(watch)) {
    const matchId = matchByFifa.get(b.idMatch) ?? null;
    const key = `${matchId ?? 'null'}|${b.market}|${b.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    values.push({
      matchId,
      scope: 'match',
      market: b.market,
      channel: b.channel,
      kind: b.kind,
      url: b.url,
      language: b.language,
      logoUrl: b.logoUrl,
      sourceIds: b.idChannel ? { fifa: b.idChannel } : {},
    });
  }

  const CHUNK = 1000;
  for (let i = 0; i < values.length; i += CHUNK) {
    await db
      .insert(broadcasts)
      .values(values.slice(i, i + CHUNK))
      .onConflictDoNothing();
  }

  log(`broadcasts: ${await countTable('broadcasts')}`);
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

async function verify(): Promise<void> {
  const [tc, gc, mc, vc] = await Promise.all([
    countTable('teams'),
    countTable('groups'),
    countTable('matches'),
    countTable('venues'),
  ]);
  const ok = (n: number, expected: number, label: string): string =>
    `${label}: ${n} ${n === expected ? '✓' : `✗ (expected ${expected})`}`;

  console.log('\n  Verification:');
  console.log(`    ${ok(tc, 48, 'teams')}`);
  console.log(`    ${ok(gc, 12, 'groups')}`);
  console.log(`    ${ok(mc, 104, 'matches')}`);
  console.log(`    ${ok(vc, 16, 'venues')}`);

  if (tc !== 48 || gc !== 12 || mc !== 104 || vc !== 16) {
    process.exitCode = 1;
    console.error('\n  ✗ Seed verification failed — counts do not match expected values.');
  } else {
    console.log('\n  ✓ All counts match. Seed complete.');
  }
}

async function seedBracketSlots(): Promise<void> {
  const existing = await countTable('bracket_slots');
  if (existing > 0) {
    log(`bracket_slots: ${existing} (skipped — already seeded)`);
    return;
  }
  // Derive bracket from knockout matches already in DB
  const knockouts = await db
    .select({ id: matches.id, stage: matches.stage, matchNumber: matches.matchNumber,
              homePlaceholder: matches.homePlaceholder, awayPlaceholder: matches.awayPlaceholder,
              homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
    .from(matches)
    .where(sql`${matches.stage} != 'group'`);

  for (const m of knockouts) {
    await db.insert(bracketSlots).values({
      round: m.stage,
      position: m.matchNumber,
      matchId: m.id,
      homeSource: m.homePlaceholder ?? null,
      awaySource: m.awayPlaceholder ?? null,
    }).onConflictDoNothing();
  }
  log(`bracket_slots: ${await countTable('bracket_slots')}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('Seeding worldcup database…\n');

  console.log('→ Fetching openfootball 2026 JSON…');
  const raw = await fetchOpenfootball();
  console.log('  Fetched.\n');

  console.log('→ Static data');
  await seedConfederations();
  await seedDataSources();

  console.log('\n→ Tournament structure');
  const groupMap  = await seedGroups(raw);
  const venueMap  = await seedCitiesAndVenues(raw);
  const teamMap   = await seedTeams(raw, groupMap);

  console.log('\n→ Matches');
  await seedMatches(raw, groupMap, teamMap, venueMap);

  console.log('\n→ Standings (initial zeroes)');
  await seedStandings();

  console.log('\n→ Bracket slots');
  await seedBracketSlots();

  console.log('\n→ Venue capacities');
  await enrichVenues();

  console.log('\n→ FIFA enrichment (secondary)');
  await enrichFifaSourceIds();
  await seedBroadcasts();

  await verify();
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
