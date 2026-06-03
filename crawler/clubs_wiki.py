"""
Fill players.club from Wikipedia "2026 FIFA World Cup squads".

FIFA squad lists lack club affiliation; Wikipedia publishes one squad table
per team with columns: No. | Pos. | Player | Date of birth | Caps | (Goals) | Club.

Strategy:
  1. Fetch the page with crawl4ai (user requirement) -> raw HTML.
  2. Parse each team section: heading text -> our team, table rows -> (No, name, club).
  3. Match Wikipedia rows to our players PRIMARILY by (team, jersey number),
     since players.number is populated 1..26 and aligns with Wikipedia's "No.".
     Fallback: normalized surname match if number missing/unmatched.
  4. UPDATE players SET club=%s WHERE id=%s.

Idempotent (re-run overwrites club). Fail-soft: a team table that can't be
parsed logs a WARN and is skipped; the script never crashes on one bad section.
Honest: if the page/squads aren't published, nothing is fabricated.

Usage: python clubs_wiki.py [--dry-run]
"""
import sys
import re
import asyncio
import unicodedata

from base import get_db, log

WIKI_URL = 'https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads'

# Wikipedia section heading -> our teams.name (only where they differ).
# Most headings match our names exactly; list only the exceptions.
HEADING_TO_TEAM = {
    'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
    'Curacao': 'Curaçao',
    'United States': 'USA',
    'United States of America': 'USA',
    'South Korea': 'South Korea',
    'Korea Republic': 'South Korea',
    'DR Congo': 'DR Congo',
    "Côte d'Ivoire": 'Ivory Coast',
    'Cote d\'Ivoire': 'Ivory Coast',
    'Türkiye': 'Turkey',
    'Turkiye': 'Turkey',
}


def strip_accents(s: str) -> str:
    return ''.join(
        c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c)
    )


def norm_name(s: str) -> str:
    """Lowercase, de-accented, alnum-only token list of a player name."""
    s = strip_accents(s).lower()
    s = re.sub(r'[^a-z0-9 ]', ' ', s)
    return ' '.join(s.split())


def norm_heading(s: str) -> str:
    s = re.sub(r'\[.*?\]', '', s)          # drop footnote markers
    s = re.sub(r'\(.*?\)', '', s)          # drop "(Group A)" etc.
    return ' '.join(s.split()).strip()


async def fetch_html() -> str | None:
    """Fetch the squads page with crawl4ai; return raw HTML or None."""
    from crawl4ai import AsyncWebCrawler
    try:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=WIKI_URL)
            if not getattr(result, 'success', True):
                log.error(f'crawl4ai fetch failed: {getattr(result, "error_message", "?")}')
                return None
            return result.html or result.cleaned_html
    except Exception as e:
        log.error(f'crawl4ai fetch raised: {e}')
        return None


def parse_squads(html: str) -> dict[str, list[dict]]:
    """Return {heading_text: [{'no': int|None, 'name': str, 'club': str}, ...]}."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'lxml')
    squads: dict[str, list[dict]] = {}

    # Each squad table is a wikitable; the nearest preceding heading names the team.
    # (Search the whole soup: on current Wikipedia HTML the tables are not direct
    # descendants of div.mw-parser-output as parsed.)
    for table in soup.find_all('table'):
        cls = table.get('class') or []
        if 'wikitable' not in cls:
            continue

        # Header row -> column index map.
        header_cells = None
        for tr in table.find_all('tr'):
            ths = tr.find_all('th')
            if ths and any('player' in th.get_text(' ', strip=True).lower() for th in ths):
                header_cells = ths
                break
        if not header_cells:
            continue
        col = {}
        for i, th in enumerate(header_cells):
            t = th.get_text(' ', strip=True).lower()
            if t.startswith('no'):
                col['no'] = i
            elif t.startswith('player'):
                col['player'] = i
            elif t.startswith('club'):
                col['club'] = i
        if 'player' not in col or 'club' not in col:
            continue

        # Find the team heading preceding this table.
        heading = None
        node = table
        while node is not None:
            node = node.find_previous(['h2', 'h3', 'h4'])
            if node is None:
                break
            span = node.find('span', class_='mw-headline')
            txt = (span.get_text(' ', strip=True) if span else node.get_text(' ', strip=True))
            txt = norm_heading(txt)
            if txt and txt.lower() not in (
                'contents', 'references', 'notes', 'statistics',
                'see also', 'external links', 'squads',
            ):
                heading = txt
                break
        if not heading:
            continue

        rows = []
        for tr in table.find_all('tr'):
            cells = tr.find_all(['td', 'th'])
            if len(cells) <= max(col.values()):
                continue
            # Skip the header row itself.
            if tr.find_all('th') and not tr.find_all('td'):
                continue

            def cell_text(idx):
                return cells[idx].get_text(' ', strip=True) if idx < len(cells) else ''

            no = None
            if 'no' in col:
                m = re.search(r'\d+', cell_text(col['no']))
                no = int(m.group()) if m else None

            name = cell_text(col['player'])
            name = re.sub(r'\(.*?\)', '', name)  # strip "(captain)" etc.
            name = re.sub(r'\[.*?\]', '', name).strip()

            club_cell = cells[col['club']] if col['club'] < len(cells) else None
            club = ''
            if club_cell is not None:
                # The cell holds a flag (an <a> wrapping an <img>, no text) plus
                # the club link. Prefer the last non-empty <a> text; otherwise
                # fall back to the cell's plain text (the flag is an image).
                link_texts = [
                    a.get_text(' ', strip=True) for a in club_cell.find_all('a')
                ]
                link_texts = [t for t in link_texts if t]
                club = link_texts[-1] if link_texts else club_cell.get_text(' ', strip=True)
                club = re.sub(r'\[.*?\]', '', club).strip()

            if not name or not club:
                continue
            rows.append({'no': no, 'name': name, 'club': club})

        if rows:
            squads.setdefault(heading, [])
            # Some teams have GK/DF/MF/FW split tables under one heading; merge.
            squads[heading].extend(rows)

    return squads


def resolve_team(heading: str, db_teams: dict[str, str]) -> str | None:
    """Map a Wikipedia heading to a teams.id (db_teams: lowercased name -> id)."""
    mapped = HEADING_TO_TEAM.get(heading, heading)
    if mapped.lower() in db_teams:
        return db_teams[mapped.lower()]
    # Try de-accented compare against all team names.
    h = strip_accents(mapped).lower()
    for name_lc, tid in db_teams.items():
        if strip_accents(name_lc) == h:
            return tid
    return None


def match_players(rows, players):
    """Yield (player_id, club) matches.

    players: list of (id, name, number). Match by number first, then surname.
    """
    by_number = {p[2]: p for p in players if p[2] is not None}
    by_surname = {}
    for p in players:
        toks = norm_name(p[1]).split()
        if toks:
            by_surname.setdefault(toks[-1], []).append(p)

    used = set()
    matched = []
    unmatched_rows = []
    for r in rows:
        p = None
        if r['no'] is not None and r['no'] in by_number:
            cand = by_number[r['no']]
            if cand[0] not in used:
                p = cand
        if p is None:
            unmatched_rows.append(r)
            continue
        used.add(p[0])
        matched.append((p[0], r['club']))

    # Fallback for rows whose number didn't match: surname.
    for r in unmatched_rows:
        toks = norm_name(r['name']).split()
        if not toks:
            continue
        cands = [c for c in by_surname.get(toks[-1], []) if c[0] not in used]
        if len(cands) == 1:
            used.add(cands[0][0])
            matched.append((cands[0][0], r['club']))
    return matched


def main() -> None:
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        log.info('DRY RUN — no DB writes')

    html = asyncio.run(fetch_html())
    if not html:
        log.error('Could not fetch the Wikipedia squads page — leaving club NULL. '
                  'No clubs fabricated.')
        sys.exit(1)

    squads = parse_squads(html)
    if not squads:
        log.error('No squad tables parsed from the page. Squads may not be published '
                  'yet — leaving club NULL. No clubs fabricated.')
        sys.exit(1)
    log.info(f'Parsed {len(squads)} squad section(s) from Wikipedia')

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id, name FROM teams')
        db_teams = {name.lower(): str(tid) for (tid, name) in cur.fetchall()}

        total_updated = 0
        teams_done = 0
        teams_missing = []

        # Iterate teams via the squad headings we parsed.
        resolved_team_ids = set()
        for heading, rows in squads.items():
            tid = resolve_team(heading, db_teams)
            if tid is None:
                log.warning(f'  Heading "{heading}" did not map to any DB team — skipped')
                continue
            resolved_team_ids.add(tid)

            cur.execute(
                'SELECT id, name, number FROM players WHERE team_id = %s::uuid',
                (tid,),
            )
            players = [(str(r[0]), r[1], r[2]) for r in cur.fetchall()]
            if not players:
                log.warning(f'  No DB players for "{heading}" — skipped')
                continue

            matched = match_players(rows, players)
            if not matched:
                log.warning(f'  "{heading}": {len(rows)} wiki rows but 0 matched players')
                continue

            for (pid, club) in matched:
                if not dry_run:
                    cur.execute('UPDATE players SET club = %s WHERE id = %s::uuid',
                                (club, pid))
            total_updated += len(matched)
            teams_done += 1
            log.info(f'  {heading}: matched {len(matched)}/{len(rows)} rows')

        # Report teams we never matched any squad for.
        for name_lc, tid in db_teams.items():
            if tid not in resolved_team_ids:
                teams_missing.append(name_lc)

        log.info(
            f'Done: {total_updated} player clubs set across {teams_done} teams'
            + (f'; no Wikipedia squad matched for {len(teams_missing)} teams: '
               f'{sorted(teams_missing)}' if teams_missing else '')
        )


if __name__ == '__main__':
    main()
