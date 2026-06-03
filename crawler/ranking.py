"""
Populate teams.fifa_ranking for the 48 FIFA World Cup 2026 teams.

SOURCE — FIFA/Coca-Cola Men's World Ranking, official release of 01 April 2026
(the most recent release at the time of writing; next update 11 June 2026).
Primary URL: https://inside.fifa.com/fifa-world-ranking/men
Cross-checked against ESPN's published top-50 for the same release
(https://www.espn.com/soccer/story/_/id/46664763/fifa-mens-top-50-world-rankings)
and a full top-90 table (https://www.whereig.com/football/fifa-world-rankings.html).

Why a sourced STATIC snapshot (not a live HTTP call):
  FIFA's ranking page is a Next.js app whose table rows are fetched client-side;
  there is no row data in the static HTML / __NEXT_DATA__ blob. The undocumented
  JSON endpoint
    https://inside.fifa.com/api/ranking-overview?locale=en&dateId=id<NNNNN>
  IS reachable with plain requests and returns all 211 teams, BUT it requires an
  opaque per-release `dateId` and — as of this writing — only exposed releases up
  to 19 Jan 2026 (id14993); the 01 Apr 2026 release was not yet served there.
  Rather than ship a stale ranking or brute-force opaque ids at runtime, we embed
  the verified 01 Apr 2026 figures below. The (now stale) Jan-19 dateId is recorded
  in FIFA_API_DATEID for reference / future re-checks.

  All 48 WC-2026 teams fall within the top 85 of this release, so every team gets a
  ranking. The map is keyed by OUR DB fifa_code (which differs from FIFA's own
  3-letter codes for several teams, e.g. ALG/TUR/KSA/RSA/KOR/CIV/COD/CPV/NED/GER/POR),
  so no code translation is needed.

Idempotent: each run runs `UPDATE teams SET fifa_ranking = %s WHERE fifa_code = %s`,
so re-running simply overwrites with the same values. Safe to run repeatedly.

Fail-soft: if the DB can't be reached the underlying get_db() raises; otherwise this
script never crashes a pipeline — unmatched codes are logged and we still exit 0.

Usage: python ranking.py [--dry-run]
"""
import sys
from base import get_db, log

# Reference only: FIFA dateId for the latest release the live JSON endpoint served
# (19 Jan 2026). Re-check higher ids periodically for the April/June releases:
#   https://inside.fifa.com/api/ranking-overview?locale=en&dateId=id14993
FIFA_API_DATEID = "id14993"

# FIFA/Coca-Cola Men's World Ranking — official release 01 April 2026.
# Keyed by our DB fifa_code. Value = official world rank position.
RANKINGS: dict[str, int] = {
    "FRA": 1,    # France
    "ESP": 2,    # Spain
    "ARG": 3,    # Argentina
    "ENG": 4,    # England
    "POR": 5,    # Portugal
    "BRA": 6,    # Brazil
    "NED": 7,    # Netherlands
    "MAR": 8,    # Morocco
    "BEL": 9,    # Belgium
    "GER": 10,   # Germany
    "CRO": 11,   # Croatia
    "COL": 13,   # Colombia
    "SEN": 14,   # Senegal
    "MEX": 15,   # Mexico
    "USA": 16,   # USA
    "URU": 17,   # Uruguay
    "JPN": 18,   # Japan
    "SUI": 19,   # Switzerland
    "IRN": 21,   # IR Iran
    "TUR": 22,   # Türkiye
    "ECU": 23,   # Ecuador
    "AUT": 24,   # Austria
    "KOR": 25,   # Korea Republic (South Korea)
    "AUS": 27,   # Australia
    "ALG": 28,   # Algeria
    "EGY": 29,   # Egypt
    "CAN": 30,   # Canada
    "NOR": 31,   # Norway
    "PAN": 33,   # Panama
    "CIV": 34,   # Côte d'Ivoire (Ivory Coast)
    "SWE": 38,   # Sweden
    "PAR": 40,   # Paraguay
    "CZE": 41,   # Czechia (Czech Republic)
    "SCO": 43,   # Scotland
    "TUN": 44,   # Tunisia
    "COD": 46,   # Congo DR
    "UZB": 50,   # Uzbekistan
    "QAT": 55,   # Qatar
    "IRQ": 57,   # Iraq
    "RSA": 60,   # South Africa
    "KSA": 61,   # Saudi Arabia
    "JOR": 63,   # Jordan
    "BIH": 65,   # Bosnia and Herzegovina
    "CPV": 69,   # Cabo Verde (Cape Verde)
    "GHA": 74,   # Ghana
    "CUW": 82,   # Curaçao
    "HAI": 83,   # Haiti
    "NZL": 85,   # New Zealand
}


def update_rankings() -> None:
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        log.info("DRY RUN — no DB writes")

    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT fifa_code FROM teams")
            db_codes = {r[0] for r in cur.fetchall()}

            matched = 0
            for code, rank in RANKINGS.items():
                if code not in db_codes:
                    log.warning(f"  fifa_code {code} not found in teams table — skipping")
                    continue
                if not dry_run:
                    cur.execute(
                        "UPDATE teams SET fifa_ranking = %s WHERE fifa_code = %s",
                        (rank, code),
                    )
                else:
                    log.info(f"  Would set {code} -> {rank}")
                matched += 1

            # Report any DB team we did not cover (should be none for the 48).
            missing = sorted(db_codes - set(RANKINGS))
            if missing:
                log.warning(f"Teams left without a ranking: {missing}")

            log.info(
                f"Done: set fifa_ranking for {matched}/{len(db_codes)} teams "
                f"(FIFA Men's Ranking, 01 April 2026 release)"
            )
    except Exception as e:
        # Fail-soft: never crash a pipeline on a transient DB/source issue.
        log.warning(f"ranking update failed: {e}")
        sys.exit(0)


if __name__ == "__main__":
    update_rankings()
