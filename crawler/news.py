"""
Fetch football news from RSS feeds and insert into the news table.
Sources: BBC Sport, The Guardian Football.

Usage: python news.py [--dry-run]
Recommended: run via systemd timer every 6 hours.
"""
import sys
import json
import re
import time
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from base import get_db, log

try:
    import feedparser
except ImportError:
    print('feedparser not installed. Run: pip install feedparser')
    sys.exit(1)

RSS_FEEDS = [
    {
        'name': 'BBC Sport Football',
        'url': 'https://feeds.bbci.co.uk/sport/football/rss.xml',
    },
    {
        'name': 'Guardian Football',
        'url': 'https://www.theguardian.com/football/rss',
    },
]

# Keywords to filter World Cup relevant articles
WC_KEYWORDS = ['world cup', 'fifa', 'wc26', 'wc2026', '2026']

# Our 48 team names for related_teams tagging
TEAM_NAMES = [
    'algeria', 'argentina', 'australia', 'austria', 'belgium', 'bosnia',
    'brazil', 'canada', 'cape verde', 'colombia', 'croatia', 'curaçao',
    'czech', 'dr congo', 'ecuador', 'egypt', 'england', 'france', 'germany',
    'ghana', 'haiti', 'iran', 'iraq', 'ivory coast', 'japan', 'jordan',
    'mexico', 'morocco', 'netherlands', 'new zealand', 'norway', 'panama',
    'paraguay', 'portugal', 'qatar', 'saudi arabia', 'scotland', 'senegal',
    'south africa', 'south korea', 'spain', 'sweden', 'switzerland', 'tunisia',
    'turkey', 'usa', 'united states', 'uruguay', 'uzbekistan',
]


def parse_date(entry) -> datetime | None:
    for field in ('published', 'updated'):
        val = getattr(entry, field, None)
        if val:
            try:
                return parsedate_to_datetime(val).astimezone(timezone.utc)
            except Exception:
                pass
    return None


def is_wc_related(title: str, summary: str) -> bool:
    text = (title + ' ' + summary).lower()
    return any(kw in text for kw in WC_KEYWORDS)


def find_related_teams(title: str, summary: str) -> list[str]:
    text = (title + ' ' + summary).lower()
    return [t for t in TEAM_NAMES if t in text]


def fetch_news() -> None:
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        log.info('DRY RUN — no DB writes')

    inserted = 0
    with get_db() as conn:
        cur = conn.cursor()

        for feed_cfg in RSS_FEEDS:
            log.info(f'Fetching {feed_cfg["name"]}…')
            feed = feedparser.parse(feed_cfg['url'])

            for entry in feed.entries:
                title   = entry.get('title', '')
                url     = entry.get('link', '')
                summary = entry.get('summary', '') or entry.get('description', '')
                # Strip HTML tags from summary
                summary = re.sub(r'<[^>]+>', '', summary)
                pub_date = parse_date(entry)
                guid = entry.get('id') or url

                if not is_wc_related(title, summary):
                    continue

                related = find_related_teams(title, summary)

                if not dry_run:
                    cur.execute(
                        '''
                        INSERT INTO news (id, title, url, source, summary, published_at,
                                          categories, related_teams, source_id)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                        ON CONFLICT DO NOTHING
                        ''',
                        (
                            title, url, feed_cfg['name'],
                            summary[:500] if summary else None,
                            pub_date.isoformat() if pub_date else None,
                            json.dumps(['football', 'world-cup']),
                            json.dumps(related),
                            guid,
                        ),
                    )
                else:
                    log.info(f'  Would insert: {title[:60]}')
                inserted += 1

            time.sleep(1.0)

        log.info(f'Done: {inserted} WC-relevant articles processed')


if __name__ == '__main__':
    fetch_news()
