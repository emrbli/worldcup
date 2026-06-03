# Data Attribution

The dataset bundled with and produced by **worldcup-backend** is **derived** from a number
of public sources. We are grateful to each of these projects and providers. The aggregated
data is provided **as-is** for educational and non-commercial purposes. Users are
responsible for respecting each source's Terms of Service and license when reusing data.

## Sources

### openfootball
- **Provides:** canonical backbone — teams, groups, fixtures, venues, schedule.
- **License / posture:** public domain / Creative Commons (open data). Used as the
  canonical ID source.
- https://github.com/openfootball

### ESPN (hidden / undocumented API)
- **Provides:** live scores, match summaries, lineups/rosters.
- **License / posture:** undocumented first-party API. Used **respectfully and at low
  volume**, never as a hard runtime dependency. No bulk scraping.
- https://www.espn.com

### worldcupjson.net
- **Provides:** supplementary fixtures and live score data (fallback chain).
- **License / posture:** public JSON dataset; used as a fallback source.
- https://worldcupjson.net

### football-data.org
- **Provides:** match metadata, officials/referees, score fallback.
- **License / posture:** free tier (rate-limited, 10 req/min). **Attribution required.**
  Used as a lower-priority fallback.
- https://www.football-data.org

### REST Countries
- **Provides:** multilingual country names and metadata for i18n.
- **License / posture:** open data API.
- https://restcountries.com

### Wikidata
- **Provides:** structured entity data (identifiers, relationships, metadata).
- **License / posture:** **CC0** (public domain dedication).
- https://www.wikidata.org

### Wikipedia
- **Provides:** descriptive text and some imagery/metadata.
- **License / posture:** text is **CC BY-SA**; images carry their own individual licenses.
  Note that CC BY-SA text imposes share-alike obligations and image licensing must be
  checked per file before reuse.
- https://www.wikipedia.org

### wc26-mcp
- **Provides:** supplementary content (editorial / structured content).
- **License / posture:** npm package, **MIT** licensed.
- https://www.npmjs.com/package/wc26-mcp

### FIFA first-party data (enrichment only)
- **Provides:** optional enrichment fields (e.g. squads/metadata).
- **License / posture:** first-party data used **only as enrichment**, never a runtime
  dependency. No endpoints are documented or shipped in this repository. See
  [DISCLAIMER.md](./DISCLAIMER.md). This project is **not** affiliated with or endorsed
  by FIFA.

## General terms

- All data is **derived** and provided **AS-IS**, without warranty of any kind.
- This project has **non-commercial / educational intent**.
- You **must respect each upstream source's Terms of Service and license** when using or
  redistributing data obtained through this project.
