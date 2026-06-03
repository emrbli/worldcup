import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../../src/lib/db/schema.js';
import {
  teams,
  cities,
  venues,
  teamProfiles,
  cityGuides,
  fanZones,
  visaInfo,
  historicalMatchups,
  news,
  odds,
} from '../../src/lib/db/schema.js';
import type { DrizzleDb } from '../../src/lib/db/db.module.js';

// wc26-mcp embedded data (MIT licensed)
// The package exports field doesn't expose data/* subpaths, so we resolve
// the package root and require the data files via absolute path.
import { createRequire } from 'module';
import { resolve, dirname } from 'path';

const _require = createRequire(import.meta.url);
const pkgRoot = dirname(_require.resolve('wc26-mcp'));  // → .../dist
const dataDir = resolve(pkgRoot, 'data');

/* eslint-disable @typescript-eslint/no-require-imports */
const { teamProfiles: wpTeamProfiles } = _require(resolve(dataDir, 'team-profiles.js')) as { teamProfiles: unknown[] };
const { cityGuides: wpCityGuides } = _require(resolve(dataDir, 'city-guides.js')) as { cityGuides: unknown[] };
const { fanZones: wpFanZones } = _require(resolve(dataDir, 'fan-zones.js')) as { fanZones: unknown[] };
const { visaInfo: wpVisaInfo } = _require(resolve(dataDir, 'visa-info.js')) as { visaInfo: unknown[] };
const { historicalMatchups: wpH2H } = _require(resolve(dataDir, 'historical-matchups.js')) as { historicalMatchups: unknown[] };
const { news: wpNews } = _require(resolve(dataDir, 'news.js')) as { news: unknown[] };
const wpOdds = _require(resolve(dataDir, 'odds.js')) as { odds: Record<string, unknown> };
/* eslint-enable @typescript-eslint/no-require-imports */

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema }) as DrizzleDb;

// ---------------------------------------------------------------------------
// Helper: count a table
// ---------------------------------------------------------------------------
async function countTable(tableName: string): Promise<number> {
  const res = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${tableName}"`)) as { rows: { n: number }[] };
  return res.rows[0]?.n ?? 0;
}

function log(msg: string): void { process.stdout.write(`  ${msg}\n`); }

// ---------------------------------------------------------------------------
// wc26-mcp venue_id → our venues.id mapping
// ---------------------------------------------------------------------------
const VENUE_ID_MAP: Record<string, string> = {
  metlife:       'MetLife Stadium',
  sofi:          'SoFi Stadium',
  att:           'AT&T Stadium',
  hard_rock:     'Hard Rock Stadium',
  mercedes_benz: 'Mercedes-Benz Stadium',
  gillette:      'Gillette Stadium',
  nrg:           'NRG Stadium',
  arrowhead:     'Arrowhead Stadium',
  lincoln:       'Lincoln Financial Field',
  levis:         "Levi's Stadium",
  lumen:         'Lumen Field',
  azteca:        'Estadio Azteca',
  akron:         'Estadio Akron',
  bbva:          'Estadio BBVA',
  bmo:           'BMO Field',
  bc_place:      'BC Place',
};

// ---------------------------------------------------------------------------
// 1. Team profiles
// ---------------------------------------------------------------------------
async function seedTeamProfiles(): Promise<void> {
  const existing = await countTable('team_profiles');
  if (existing > 0) { log(`team_profiles: ${existing} (skipped)`); return; }

  const teamRows = await db.select({ id: teams.id, fifaCode: teams.fifaCode }).from(teams);
  const teamByCode = new Map(teamRows.filter(t => t.fifaCode).map(t => [t.fifaCode!.toLowerCase(), t.id]));

  let inserted = 0;
  for (const tp of wpTeamProfiles as any[]) {
    const teamId = teamByCode.get(tp.team_id?.toLowerCase());
    if (!teamId) { log(`  WARN: no team for team_id=${tp.team_id}`); continue; }
    await db.insert(teamProfiles).values({
      teamId,
      coach: tp.coach ?? null,
      style: tp.playing_style ?? null,
      keyPlayers: tp.key_players ?? [],
      wcHistory: tp.world_cup_history ?? null,
      qualifyingSummary: tp.qualifying_summary ?? null,
    }).onConflictDoNothing();
    inserted++;
  }
  log(`team_profiles: ${inserted} inserted`);
}

// ---------------------------------------------------------------------------
// 2. City guides
// ---------------------------------------------------------------------------
async function seedCityGuides(venueToCity: Map<string, string>): Promise<void> {
  const existing = await countTable('city_guides');
  if (existing > 0) { log(`city_guides: ${existing} (skipped)`); return; }

  let inserted = 0;
  for (const cg of wpCityGuides as any[]) {
    const cityId = venueToCity.get(cg.venue_id);
    if (!cityId) { log(`  WARN: no city for venue_id=${cg.venue_id}`); continue; }
    await db.insert(cityGuides).values({
      cityId,
      sourceVenueId: cg.venue_id,
      highlights: cg.highlights ?? [],
      gettingThere: cg.getting_there ?? {},
      foodAndDrink: cg.food_and_drink ?? {},
      thingsToDo: cg.things_to_do ?? [],
      localTips: cg.local_tips ?? [],
    }).onConflictDoNothing();
    inserted++;
  }
  log(`city_guides: ${inserted} inserted`);
}

// ---------------------------------------------------------------------------
// 3. Fan zones
// ---------------------------------------------------------------------------
async function seedFanZones(venueToCity: Map<string, string>, venueByName: Map<string, string>): Promise<void> {
  const existing = await countTable('fan_zones');
  if (existing > 0) { log(`fan_zones: ${existing} (skipped)`); return; }

  let inserted = 0;
  for (const fz of wpFanZones as any[]) {
    const cityId = venueToCity.get(fz.venue_id) ?? null;
    const venueId = fz.venue_id ? (venueByName.get(VENUE_ID_MAP[fz.venue_id]) ?? null) : null;
    const coords = fz.coordinates;
    await db.insert(fanZones).values({
      cityId,
      venueId,
      name: fz.name ?? null,
      address: fz.address ?? null,
      capacity: fz.capacity ?? null,
      hours: fz.hours ?? null,
      activities: fz.activities ?? [],
      transportation: fz.transportation ?? null,
      freeEntry: fz.free_entry ?? true,
      lat: coords?.lat ? String(coords.lat) : null,
      lng: coords?.lng ? String(coords.lng) : null,
      sourceId: fz.id ?? null,
    }).onConflictDoNothing();
    inserted++;
  }
  log(`fan_zones: ${inserted} inserted`);
}

// ---------------------------------------------------------------------------
// 4. Visa info
// ---------------------------------------------------------------------------
async function seedVisaInfo(): Promise<void> {
  const existing = await countTable('visa_info');
  if (existing > 0) { log(`visa_info: ${existing} (skipped)`); return; }

  const teamRows = await db.select({ id: teams.id, fifaCode: teams.fifaCode }).from(teams);
  const teamByCode = new Map(teamRows.filter(t => t.fifaCode).map(t => [t.fifaCode!.toLowerCase(), t.id]));

  let inserted = 0;
  for (const vi of wpVisaInfo as any[]) {
    const teamId = teamByCode.get(vi.team_id?.toLowerCase()) ?? null;
    await db.insert(visaInfo).values({
      teamId,
      nationality: vi.nationality ?? null,
      passportCountry: vi.passport_country ?? null,
      entryRequirements: vi.entry_requirements ?? {},
    }).onConflictDoNothing();
    inserted++;
  }
  log(`visa_info: ${inserted} inserted`);
}

// ---------------------------------------------------------------------------
// 5. Historical matchups (H2H)
// ---------------------------------------------------------------------------
async function seedH2H(): Promise<void> {
  const existing = await countTable('historical_matchups');
  if (existing > 0) { log(`historical_matchups: ${existing} (skipped)`); return; }

  const teamRows = await db.select({ id: teams.id, fifaCode: teams.fifaCode }).from(teams);
  const teamByCode = new Map(teamRows.filter(t => t.fifaCode).map(t => [t.fifaCode!.toLowerCase(), t.id]));

  let inserted = 0;
  for (const h2h of wpH2H as any[]) {
    // Normalise order: team_a < team_b (by FIFA code alphabetically)
    const [codeA, codeB] = [h2h.team_a.toLowerCase(), h2h.team_b.toLowerCase()].sort();
    const teamAId = teamByCode.get(codeA) ?? null;
    const teamBId = teamByCode.get(codeB) ?? null;

    // Swap wins/goals if we reordered
    const swapped = codeA !== h2h.team_a.toLowerCase();
    await db.insert(historicalMatchups).values({
      teamAId,
      teamBId,
      totalMatches: h2h.total_matches ?? 0,
      teamAWins: swapped ? h2h.team_b_wins : h2h.team_a_wins,
      draws: h2h.draws ?? 0,
      teamBWins: swapped ? h2h.team_a_wins : h2h.team_b_wins,
      totalGoalsTeamA: swapped ? h2h.total_goals_team_b : h2h.total_goals_team_a,
      totalGoalsTeamB: swapped ? h2h.total_goals_team_a : h2h.total_goals_team_b,
      summary: h2h.summary ?? null,
      aggregate: { meetings: h2h.meetings ?? [] },
    }).onConflictDoNothing();
    inserted++;
  }
  log(`historical_matchups: ${inserted} inserted`);
}

// ---------------------------------------------------------------------------
// 6. News
// ---------------------------------------------------------------------------
async function seedNews(): Promise<void> {
  const existing = await countTable('news');
  if (existing > 0) { log(`news: ${existing} (skipped)`); return; }

  let inserted = 0;
  for (const n of wpNews as any[]) {
    await db.insert(news).values({
      title: n.title ?? null,
      url: n.url ?? null,
      source: n.source ?? 'wc26-mcp',
      summary: n.summary ?? null,
      publishedAt: n.date ? new Date(n.date) : null,
      categories: n.categories ?? [],
      relatedTeams: n.related_teams ?? [],
      sourceId: n.id ?? null,
    }).onConflictDoNothing();
    inserted++;
  }
  log(`news: ${inserted} inserted`);
}

// ---------------------------------------------------------------------------
// 7. Odds (tournament-level)
// ---------------------------------------------------------------------------
async function seedOdds(): Promise<void> {
  const existing = await countTable('odds');
  if (existing > 0) { log(`odds: ${existing} (skipped)`); return; }

  const tournamentOdds = (wpOdds as any).tournamentOdds as any;
  if (!tournamentOdds?.tournament_winner) { log('odds: no data'); return; }

  let inserted = 0;
  for (const entry of tournamentOdds.tournament_winner) {
    await db.insert(odds).values({
      scope: 'tournament',
      matchId: null,
      market: 'tournament_winner',
      selection: entry.team_id,
      value: entry.odds,
      impliedProbability: entry.implied_probability,
      bookmaker: 'aggregated',
      source: 'wc26-mcp',
    }).onConflictDoNothing();
    inserted++;
  }
  log(`odds (tournament): ${inserted} inserted`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('Seeding wc26-mcp content data…\n');

  // Build venue lookup maps
  const venueRows = await db
    .select({ id: venues.id, name: venues.name, cityId: venues.cityId })
    .from(venues);

  // wc26 venue_id → our city uuid
  const venueToCity = new Map<string, string>();
  // venue display name → our venue uuid
  const venueByName = new Map<string, string>();

  for (const v of venueRows) {
    if (v.name) venueByName.set(v.name, v.id);
    if (v.cityId) {
      const wc26Id = Object.entries(VENUE_ID_MAP).find(([, name]) => name === v.name)?.[0];
      if (wc26Id) venueToCity.set(wc26Id, v.cityId);
    }
  }

  await seedTeamProfiles();
  await seedCityGuides(venueToCity);
  await seedFanZones(venueToCity, venueByName);
  await seedVisaInfo();
  await seedH2H();
  await seedNews();
  await seedOdds();

  console.log('\n✓ wc26-mcp content seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => { console.error(err); process.exit(1); });
