"""
Fetch team logos from TheSportsDB (free tier, no auth required).
Writes logo_url to teams.logo_url for each WC 2026 team.

Usage: python thesportsdb.py [--dry-run]
"""
import sys
import time
import logging
from base import get_db, polite_get, log

TSDB_SEARCH = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t={name}'
TSDB_LEAGUE = 'https://www.thesportsdb.com/api/v1/json/3/lookup_all_teams.php?id=4429'

# FIFA code → TheSportsDB team name overrides (where search might not match)
NAME_OVERRIDES: dict[str, str] = {
    'USA':  'United States',
    'KOR':  'South Korea',
    'CIV':  'Ivory Coast',
    'COD':  'DR Congo',
    'CPV':  'Cape Verde',
}


def fetch_logos() -> None:
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        log.info('DRY RUN — no DB writes')

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            'SELECT id, name, fifa_code FROM teams WHERE logo_url IS NULL OR logo_url = \'\' ORDER BY name'
        )
        rows = cur.fetchall()
        log.info(f'Teams without logo: {len(rows)}')

        updated = 0
        for (team_id, team_name, fifa_code) in rows:
            search_name = NAME_OVERRIDES.get(fifa_code, team_name)
            data = polite_get(TSDB_SEARCH.format(name=search_name.replace(' ', '%20')), delay=1.5)
            if not data or not data.get('teams'):
                log.warning(f'  No TheSportsDB match for {team_name} ({fifa_code})')
                continue

            # Pick first result
            team_data = data['teams'][0]
            logo_url = team_data.get('strTeamBadge') or team_data.get('strBadge')
            if not logo_url:
                log.warning(f'  No badge for {team_name}')
                continue

            log.info(f'  {team_name} → {logo_url[:60]}')
            if not dry_run:
                cur.execute(
                    'UPDATE teams SET logo_url = %s WHERE id = %s::uuid',
                    (logo_url, str(team_id)),
                )
            updated += 1
            time.sleep(1.0)  # polite delay

        log.info(f'Done: {updated}/{len(rows)} logo_url updated')


if __name__ == '__main__':
    fetch_logos()
