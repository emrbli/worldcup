"""
Fetch squad/players from TheSportsDB for each WC 2026 team.
Free tier (key '3') returns a sample squad (~name/position/club) per national
team. Resolves the TheSportsDB team id by searching for each team first.

Idempotent: re-running refreshes each team's TheSportsDB players (delete+insert).

Usage: python players.py [--dry-run]
"""
import sys
import time
import json
from base import get_db, polite_get, log

TSDB_SEARCH  = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t={name}'
TSDB_PLAYERS = 'https://www.thesportsdb.com/api/v1/json/3/lookup_all_players.php?id={team_id}'

# FIFA code → TheSportsDB search name (where our name won't match TSDB's).
# NB: do NOT override USA → "United States" (that returns only youth teams);
# raw "USA" resolves the senior side (idTeam 134514).
NAME_OVERRIDES: dict[str, str] = {
    'BIH': 'Bosnia and Herzegovina',
    'CUW': 'Curacao',
    'KOR': 'South Korea',
    'CIV': 'Ivory Coast',
    'COD': 'DR Congo',
    'CPV': 'Cape Verde',
}


def pick_national_team(teams: list[dict], search_name: str) -> dict | None:
    """Choose the senior national (Soccer) team from search results.

    The senior World Cup side is reliably tagged strLeague == 'FIFA World Cup'
    (this excludes U17/U20/U23/women's entries that share the country name).
    Fall back to an exact name match, then first Soccer, then first.
    """
    if not teams:
        return None
    soccer = [t for t in teams if (t.get('strSport') == 'Soccer')]
    senior = [t for t in soccer if (t.get('strLeague') == 'FIFA World Cup')]
    exact = [
        t for t in soccer
        if (t.get('strTeam') or '').strip().lower() == search_name.strip().lower()
    ]
    return (senior or exact or soccer or teams)[0]


def fetch_players() -> None:
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        log.info('DRY RUN — no DB writes')

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT id, name, fifa_code FROM teams ORDER BY name')
        teams = cur.fetchall()

        # Resume: skip teams that already have TheSportsDB players (free-tier
        # 429s mean a run may only cover part of the field — re-run fills gaps).
        cur.execute("SELECT DISTINCT team_id FROM players WHERE source_ids ? 'thesportsdb'")
        done = {str(r[0]) for r in cur.fetchall()}
        todo = [t for t in teams if str(t[0]) not in done]
        log.info(f'Teams: {len(teams)} total, {len(done)} already done, {len(todo)} to fetch')

        # Slow delay to stay under TheSportsDB free-tier rate limit (avoids 429).
        DELAY = 4.0

        inserted = 0
        teams_with_players = 0
        for (team_id, team_name, fifa_code) in todo:
            search_name = NAME_OVERRIDES.get(fifa_code, team_name)

            # 1. Resolve TheSportsDB team id (pick the national/Soccer team)
            data = polite_get(
                TSDB_SEARCH.format(name=search_name.replace(' ', '%20')), delay=DELAY
            )
            team_row = pick_national_team((data or {}).get('teams') or [], search_name)
            if not team_row:
                log.warning(f'  No TheSportsDB team for {team_name} ({fifa_code})')
                continue
            tsdb_id = team_row.get('idTeam')

            # 2. Fetch players
            pdata = polite_get(TSDB_PLAYERS.format(team_id=tsdb_id), delay=DELAY)
            players = (pdata or {}).get('player') or []
            if not players:
                log.info(f'  No players for {team_name} (normal on free tier)')
                time.sleep(DELAY)
                continue

            # 3. Idempotent refresh: drop this team's prior TheSportsDB rows
            if not dry_run:
                cur.execute(
                    "DELETE FROM players WHERE team_id = %s::uuid AND source_ids ? 'thesportsdb'",
                    (str(team_id),),
                )

            for p in players:
                name     = p.get('strPlayer') or ''
                position = p.get('strPosition') or None
                number   = None  # free tier doesn't expose shirt numbers
                club     = p.get('strTeam') or None
                if not name:
                    continue
                if not dry_run:
                    cur.execute(
                        '''
                        INSERT INTO players (id, team_id, name, position, number, club, source_ids)
                        VALUES (gen_random_uuid(), %s::uuid, %s, %s, %s, %s, %s::jsonb)
                        ''',
                        (str(team_id), name, position, number, club,
                         json.dumps({'thesportsdb': p.get('idPlayer', '')})),
                    )
                inserted += 1

            teams_with_players += 1
            log.info(f'  {team_name}: {len(players)} players')
            time.sleep(DELAY)

        log.info(
            f'Done: {inserted} player rows across {teams_with_players}/{len(teams)} teams'
        )


if __name__ == '__main__':
    fetch_players()
