# Python Crawler Worker

AYRI (separate) Python worker for data NOT available in wc26-mcp.
Runs isolated from the Node.js backend; writes directly to Postgres.

## Setup

```bash
pip install -r requirements.txt
crawl4ai-setup   # install Playwright Chromium (only if JS-render needed)
```

Requires `.env` in the repo root with `DATABASE_URL`.

## Scripts

| Script | Source | Frequency |
|---|---|---|
| `python thesportsdb.py` | TheSportsDB (JSON, free) | Once |
| `python players.py` | TheSportsDB (JSON, free) | Once |
| `python news.py` | BBC/Guardian RSS | Every 6h |

## Important constraints (CLAUDE.md §4)

- **DO NOT** scrape Sofascore, FotMob, or Flashscore — ToS prohibits it
- All sources here use JSON APIs or RSS (no JS-render needed)
- `crawl4ai` is available if JS-render ever becomes necessary
- Always respect `robots.txt`, add delay between requests
- Data fetched once is written to Postgres; no runtime scraping

## VPS systemd timer (news.py example)

```ini
# /etc/systemd/system/worldcup-news.service
[Unit]
Description=Worldcup news RSS crawler

[Service]
WorkingDirectory=/opt/worldcup/crawler
ExecStart=/usr/bin/python3 news.py
EnvironmentFile=/opt/worldcup/.env

# /etc/systemd/system/worldcup-news.timer
[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
Persistent=true
```
