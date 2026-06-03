import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../../src/lib/db/schema.js';
import { teams } from '../../src/lib/db/schema.js';
import type { DrizzleDb } from '../../src/lib/db/db.module.js';

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema }) as DrizzleDb;

// REST Countries v3.1 `translations` returns 3-letter language keys. Map them
// to the 2-letter codes we store in name_i18n. `en` comes from name.common.
const LANG_MAP: Record<string, string> = {
  ara: 'ar',
  ces: 'cs',
  cym: 'cy',
  deu: 'de',
  est: 'et',
  fin: 'fi',
  fra: 'fr',
  hrv: 'hr',
  hun: 'hu',
  ind: 'id',
  ita: 'it',
  jpn: 'ja',
  kor: 'ko',
  nld: 'nl',
  per: 'fa',
  pol: 'pl',
  por: 'pt',
  rus: 'ru',
  slk: 'sk',
  spa: 'es',
  srp: 'sr',
  swe: 'sv',
  tur: 'tr',
  urd: 'ur',
  zho: 'zh',
};

// Hard-coded overrides for codes not supported by REST Countries in the
// standard iso2 form we use (flag-icons regional codes). These only have
// en/tr available; other languages fall back gracefully.
const OVERRIDES: Record<string, Record<string, string>> = {
  'gb-eng': { en: 'England', tr: 'İngiltere' },
  'gb-sct': { en: 'Scotland', tr: 'İskoçya' },
};

// --- Wikidata enrichment (step 2) ------------------------------------------
// REST Countries doesn't cover several participating nations' own languages
// (notably Norwegian nb/nn and Uzbek uz), and the regional England/Scotland
// entries only carry en/tr. Wikidata has country labels in hundreds of
// languages, so we merge in the union of the 48 nations' official/major
// languages. We use the EntityData JSON endpoint (no query-service rate
// limits): https://www.wikidata.org/wiki/Special:EntityData/{QID}.json

// Team name (as stored in teams.name) → Wikidata QID. The en-label of each
// QID is sanity-checked against this name before writing.
const WIKIDATA_QIDS: Record<string, string> = {
  Algeria: 'Q262',
  Argentina: 'Q414',
  Australia: 'Q408',
  Austria: 'Q40',
  Belgium: 'Q31',
  'Bosnia & Herzegovina': 'Q225',
  Brazil: 'Q155',
  Canada: 'Q16',
  'Cape Verde': 'Q1011',
  Colombia: 'Q739',
  Croatia: 'Q224',
  Curaçao: 'Q25279',
  'Czech Republic': 'Q213',
  'DR Congo': 'Q974',
  Ecuador: 'Q736',
  Egypt: 'Q79',
  England: 'Q21',
  France: 'Q142',
  Germany: 'Q183',
  Ghana: 'Q117',
  Haiti: 'Q790',
  Iran: 'Q794',
  Iraq: 'Q796',
  'Ivory Coast': 'Q1008',
  Japan: 'Q17',
  Jordan: 'Q810',
  Mexico: 'Q96',
  Morocco: 'Q1028',
  Netherlands: 'Q55',
  'New Zealand': 'Q664',
  Norway: 'Q20',
  Panama: 'Q804',
  Paraguay: 'Q733',
  Portugal: 'Q45',
  Qatar: 'Q846',
  'Saudi Arabia': 'Q851',
  Scotland: 'Q22',
  Senegal: 'Q1041',
  'South Africa': 'Q258',
  'South Korea': 'Q884',
  Spain: 'Q29',
  Sweden: 'Q34',
  Switzerland: 'Q39',
  Tunisia: 'Q948',
  Turkey: 'Q43',
  USA: 'Q30',
  Uruguay: 'Q77',
  Uzbekistan: 'Q265',
};

// Union of the 48 participating nations' official / major languages. Only
// these labels are merged from Wikidata (it carries hundreds we don't need).
const WIKIDATA_LANGS = [
  'ar', 'af', 'bs', 'cs', 'de', 'en', 'es', 'fa', 'fr', 'gn', 'hr', 'ht',
  'it', 'ja', 'ko', 'nb', 'nn', 'nl', 'pap', 'pt', 'sr', 'sv', 'tr', 'uz',
] as const;

// Substring the QID's en-label must contain (lowercased) for the write to be
// trusted. Most are derivable from the team name, but a few diverge (the
// regional teams, "Turkey"→"Turkey"/"Türkiye", DR Congo, etc.).
const EN_LABEL_HINTS: Record<string, string> = {
  'Bosnia & Herzegovina': 'bosnia',
  'Cape Verde': 'cape verde',
  'Czech Republic': 'czech',
  'DR Congo': 'congo',
  England: 'england',
  'Ivory Coast': 'ivory coast',
  'New Zealand': 'new zealand',
  'Saudi Arabia': 'saudi arabia',
  Scotland: 'scotland',
  'South Africa': 'south africa',
  'South Korea': 'korea',
  Turkey: 'turkey',
  USA: 'united states',
};

type WikidataEntity = {
  entities?: Record<
    string,
    { labels?: Record<string, { language: string; value: string }> }
  >;
};

async function fetchWikidataLabels(
  teamName: string,
  qid: string,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as WikidataEntity;
    const labels = data.entities?.[qid]?.labels;
    if (!labels) return null;

    // Sanity-check: the en label must look like the team we expect, else skip.
    const enLabel = labels.en?.value?.toLowerCase() ?? '';
    const hint = (EN_LABEL_HINTS[teamName] ?? teamName).toLowerCase();
    if (enLabel && !enLabel.includes(hint)) {
      console.log(
        `  WARN ${teamName} (${qid}): en-label "${labels.en?.value}" doesn't match — skipping`,
      );
      return null;
    }

    const out: Record<string, string> = {};
    for (const code of WIKIDATA_LANGS) {
      const value = labels[code]?.value;
      if (value) out[code] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

type Translation = { official?: string; common?: string };

async function fetchI18n(iso2: string): Promise<Record<string, string> | null> {
  if (OVERRIDES[iso2]) return OVERRIDES[iso2];

  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/alpha/${iso2}?fields=name,translations`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      name: { common: string };
      translations: Record<string, Translation>;
    };

    const out: Record<string, string> = {};
    // English from the canonical common name.
    if (data.name?.common) out.en = data.name.common;

    const translations = data.translations ?? {};
    for (const [iso3, code] of Object.entries(LANG_MAP)) {
      const common = translations[iso3]?.common;
      if (common) out[code] = common;
    }

    // REST Countries doesn't always include `tur` in translations; ensure tr
    // is present (falls back to common name) so we never lose Turkish.
    if (!out.tr) out.tr = data.name?.common ?? out.en;

    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

async function seedI18n(): Promise<void> {
  console.log('Enriching teams.name_i18n with REST Countries (multi-language)…\n');

  const rows = await db
    .select({ id: teams.id, name: teams.name, iso2: teams.iso2, nameI18n: teams.nameI18n })
    .from(teams);

  let updated = 0;

  for (const team of rows) {
    const existing = (team.nameI18n as Record<string, string> | null) ?? {};

    const iso2 = team.iso2;
    if (!iso2) {
      console.log(`  SKIP ${team.name}: no iso2`);
      continue;
    }

    const i18n = await fetchI18n(iso2);
    if (!i18n) {
      console.log(`  WARN ${team.name} (${iso2}): REST Countries returned nothing`);
      continue;
    }

    // Merge: keep any existing keys (esp. en/tr), overwrite/add fetched ones.
    const merged: Record<string, string> = { ...existing, ...i18n };

    await db.execute(sql`
      UPDATE teams
      SET name_i18n = ${JSON.stringify(merged)}::jsonb
      WHERE id = ${team.id}::uuid
    `);
    console.log(`  ${team.name} → ${Object.keys(merged).length} langs (tr:${merged.tr} en:${merged.en})`);
    updated++;

    // Polite delay (REST Countries is free, no strict limit but be kind)
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(`\n✓ REST Countries pass: ${updated} teams updated.`);

  // --- Wikidata pass: merge participating nations' own languages -----------
  console.log('\nEnriching with Wikidata (nb/nn, uz, af, gn, ht, pap, bs, …)…\n');

  // Re-read so we merge on top of the REST-Countries result, not the stale row.
  const fresh = await db
    .select({ id: teams.id, name: teams.name, nameI18n: teams.nameI18n })
    .from(teams);

  let wdUpdated = 0;

  for (const team of fresh) {
    const qid = WIKIDATA_QIDS[team.name];
    if (!qid) {
      console.log(`  SKIP ${team.name}: no Wikidata QID mapped`);
      continue;
    }

    const labels = await fetchWikidataLabels(team.name, qid);
    if (!labels) {
      console.log(`  WARN ${team.name} (${qid}): no usable Wikidata labels`);
      await new Promise((r) => setTimeout(r, 150));
      continue;
    }

    const existing = (team.nameI18n as Record<string, string> | null) ?? {};
    // Merge: keep existing keys (en/tr + REST languages), add Wikidata langs.
    // Existing keys win over Wikidata to preserve our canonical en/tr.
    const merged: Record<string, string> = { ...labels, ...existing };

    await db.execute(sql`
      UPDATE teams
      SET name_i18n = ${JSON.stringify(merged)}::jsonb
      WHERE id = ${team.id}::uuid
    `);
    const added = Object.keys(labels).filter((k) => !(k in existing));
    console.log(
      `  ${team.name} → ${Object.keys(merged).length} langs (+${added.length} from Wikidata: ${added.join(',') || '—'})`,
    );
    wdUpdated++;

    // Polite gap — Wikidata EntityData is cached/CDN-served but be courteous.
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n✓ Wikidata pass: ${wdUpdated} teams updated.`);
  console.log(`\n✓ i18n complete.`);
}

seedI18n()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
