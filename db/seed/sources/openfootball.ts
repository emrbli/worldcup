const URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

// ---------------------------------------------------------------------------
// Raw JSON types
// ---------------------------------------------------------------------------

interface RawMatch {
  round: string;
  num?: number;      // only knockout matches have a num
  date: string;      // "2026-06-11"
  time: string;      // "13:00 UTC-6"
  team1: string;
  team2: string;
  group?: string;    // "Group A" — absent in knockout rounds
  ground: string;
}

interface RawData {
  name: string;
  matches: RawMatch[];
}

// ---------------------------------------------------------------------------
// Normalised output types
// ---------------------------------------------------------------------------

export interface OFGroup {
  letter: string;   // "A"
  name: string;     // "Group A"
}

export interface OFMatch {
  matchNumber: number;
  stage: string;
  groupLetter: string | null;
  matchday: number | null;
  team1Name: string | null;    // null for knockout placeholders
  team2Name: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  groundName: string;
  kickoffUtc: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_MAP: Record<string, string> = {
  'Round of 32':           'r32',
  'Round of 16':           'r16',
  'Quarter-final':         'qf',
  'Semi-final':            'sf',
  'Final':                 'final',
  'Match for third place': 'third',
};

function parseKickoffUtc(date: string, time: string): Date {
  // time format: "HH:MM UTC±N"  e.g. "13:00 UTC-6"
  const m = time.match(/^(\d{2}):(\d{2})\s+UTC([+-])(\d+)$/);
  if (!m) throw new Error(`Cannot parse time: "${time}"`);
  const [, hh, mm, sign, offsetStr] = m;
  const localMinutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);
  const offsetMinutes = parseInt(offsetStr, 10) * 60 * (sign === '-' ? -1 : 1);
  // UTC = local - offset  ("UTC-6" means offset=-6, UTC = local + 6)
  const utcMinutes = localMinutes - offsetMinutes;
  const [y, mo, d] = date.split('-').map(Number);
  const base = Date.UTC(y, mo - 1, d, 0, 0, 0);
  return new Date(base + utcMinutes * 60_000);
}

function isKnownTeam(name: string): boolean {
  // Knockout placeholders look like "2A", "1E", "3A/B/C/D/F", "W73" etc.
  return /^[A-Za-zÀ-ÿ &'()/]+$/.test(name) && name.length > 3;
}

// ---------------------------------------------------------------------------
// Fetch + normalize
// ---------------------------------------------------------------------------

export async function fetchOpenfootball(): Promise<RawData> {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`openfootball fetch failed: ${res.status}`);
  return res.json() as Promise<RawData>;
}

export function normalizeGroups(raw: RawData): OFGroup[] {
  const seen = new Set<string>();
  const groups: OFGroup[] = [];
  for (const m of raw.matches) {
    if (!m.group || seen.has(m.group)) continue;
    seen.add(m.group);
    const letter = m.group.replace('Group ', '');
    groups.push({ letter, name: m.group });
  }
  return groups.sort((a, b) => a.letter.localeCompare(b.letter));
}

export function normalizeGroundNames(raw: RawData): string[] {
  return [...new Set(raw.matches.map((m) => m.ground))].sort();
}

export function normalizeMatches(raw: RawData): OFMatch[] {
  const groupMatches = raw.matches.filter((m) => m.group);
  const koMatches = raw.matches.filter((m) => !m.group);

  // Sort group matches chronologically and assign match numbers 1-72
  const sortedGroup = [...groupMatches].sort((a, b) => {
    const da = parseKickoffUtc(a.date, a.time);
    const db = parseKickoffUtc(b.date, b.time);
    return da.getTime() - db.getTime();
  });

  const result: OFMatch[] = [];

  sortedGroup.forEach((m, i) => {
    const roundNum = parseInt(m.round.replace('Matchday ', ''), 10);
    result.push({
      matchNumber: i + 1,
      stage: 'group',
      groupLetter: m.group!.replace('Group ', ''),
      matchday: isNaN(roundNum) ? null : roundNum,
      team1Name: m.team1,
      team2Name: m.team2,
      homePlaceholder: null,
      awayPlaceholder: null,
      groundName: m.ground,
      kickoffUtc: parseKickoffUtc(m.date, m.time),
    });
  });

  for (const m of koMatches) {
    const stage = STAGE_MAP[m.round] ?? m.round.toLowerCase();
    const t1Known = isKnownTeam(m.team1);
    const t2Known = isKnownTeam(m.team2);
    result.push({
      matchNumber: m.num!,
      stage,
      groupLetter: null,
      matchday: null,
      team1Name: t1Known ? m.team1 : null,
      team2Name: t2Known ? m.team2 : null,
      homePlaceholder: t1Known ? null : m.team1,
      awayPlaceholder: t2Known ? null : m.team2,
      groundName: m.ground,
      kickoffUtc: parseKickoffUtc(m.date, m.time),
    });
  }

  return result.sort((a, b) => a.matchNumber - b.matchNumber);
}
