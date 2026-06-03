"""
Fill venues.image_url with a representative stadium photo.

For each of the 16 WC 2026 venues, fetch its English Wikipedia page with
crawl4ai (user requirement) and extract a stadium image URL:
  1. <meta property="og:image"> (a commons/upload.wikimedia.org image), else
  2. the infobox image (table.infobox img -> upload.wikimedia.org src).

UPDATE venues SET image_url=%s WHERE name=%s.

Idempotent (re-run overwrites), fail-soft (a venue that can't be resolved logs
a WARN and is skipped; never crashes), honest (no fabricated URLs).

Usage: python venue_images.py [--dry-run]
"""
import sys
import re
import asyncio

from base import get_db, log

# Our venue name -> English Wikipedia page title (current stadium name).
VENUE_TO_WIKI = {
    'Mercedes-Benz Stadium': 'Mercedes-Benz Stadium',
    'Gillette Stadium': 'Gillette Stadium',
    'AT&T Stadium': 'AT&T Stadium',
    'Estadio Akron': 'Estadio Akron',
    'NRG Stadium': 'NRG Stadium',
    'Arrowhead Stadium': 'Arrowhead Stadium',
    'SoFi Stadium': 'SoFi Stadium',
    'Estadio Azteca': 'Estadio Azteca',          # also branded "Estadio Banorte"
    'Hard Rock Stadium': 'Hard Rock Stadium',
    'Estadio BBVA': 'Estadio BBVA',
    'MetLife Stadium': 'MetLife Stadium',
    'Lincoln Financial Field': 'Lincoln Financial Field',
    "Levi's Stadium": "Levi's Stadium",
    'Lumen Field': 'Lumen Field',
    'BMO Field': 'BMO Field',
    'BC Place': 'BC Place',
}


def _upgrade_thumb(url: str) -> str:
    """Turn an upload thumb URL into the full-size original where easy.

    e.g. .../commons/thumb/a/ab/Foo.jpg/640px-Foo.jpg -> .../commons/a/ab/Foo.jpg
    Leaves non-thumb URLs untouched.
    """
    m = re.match(r'(https?://upload\.wikimedia\.org/wikipedia/[^/]+)/thumb/(.+?)/[^/]+$', url)
    if m:
        return f'{m.group(1)}/{m.group(2)}'
    return url


def extract_image(html: str) -> str | None:
    """Pull a stadium image URL from the page HTML (og:image, then infobox)."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'lxml')

    og = soup.find('meta', property='og:image')
    if og and og.get('content'):
        url = og['content']
        if url.startswith('//'):
            url = 'https:' + url
        if 'upload.wikimedia.org' in url:
            return _upgrade_thumb(url)

    infobox = soup.find('table', class_=re.compile(r'\binfobox\b'))
    if infobox:
        for img in infobox.find_all('img'):
            src = img.get('src') or ''
            if src.startswith('//'):
                src = 'https:' + src
            if 'upload.wikimedia.org' in src and re.search(r'\.(jpe?g|png)', src, re.I):
                # Skip tiny icons/flags.
                w = img.get('width')
                try:
                    if w and int(w) < 80:
                        continue
                except ValueError:
                    pass
                if '/flag' in src.lower() or 'flag_of' in src.lower():
                    continue
                return _upgrade_thumb(src)

    # Last resort: og:image even if non-upload host.
    if og and og.get('content'):
        url = og['content']
        return 'https:' + url if url.startswith('//') else url
    return None


async def fetch_image(title: str) -> str | None:
    """Fetch a Wikipedia page via crawl4ai and extract a stadium image URL."""
    from crawl4ai import AsyncWebCrawler

    url = 'https://en.wikipedia.org/wiki/' + title.replace(' ', '_')
    try:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=url)
            if not getattr(result, 'success', True):
                log.warning(f'  crawl4ai failed for {title}: '
                            f'{getattr(result, "error_message", "?")}')
                return None
            html = result.html or result.cleaned_html
            if not html:
                return None
            return extract_image(html)
    except Exception as e:
        log.warning(f'  crawl4ai raised for {title}: {e}')
        return None


async def gather_images() -> dict[str, str]:
    out = {}
    for venue, title in VENUE_TO_WIKI.items():
        img = await fetch_image(title)
        if img:
            out[venue] = img
            log.info(f'  {venue}: {img}')
        else:
            log.warning(f'  {venue}: no image found (Wikipedia "{title}") — leaving NULL')
    return out


def main() -> None:
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        log.info('DRY RUN — no DB writes')

    images = asyncio.run(gather_images())
    if not images:
        log.error('No venue images resolved — nothing written, nothing fabricated.')
        sys.exit(1)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute('SELECT name FROM venues')
        db_names = {r[0] for r in cur.fetchall()}

        updated = 0
        for venue, url in images.items():
            if venue not in db_names:
                log.warning(f'  Venue "{venue}" not in DB — skipped')
                continue
            if not dry_run:
                cur.execute('UPDATE venues SET image_url = %s WHERE name = %s',
                            (url, venue))
            updated += 1
        log.info(f'Done: set image_url for {updated}/{len(VENUE_TO_WIKI)} venues')


if __name__ == '__main__':
    main()
