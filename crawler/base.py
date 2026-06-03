"""Shared DB connection and logging utilities for all crawler scripts."""
import os
import sys
import time
import logging
from contextlib import contextmanager

import psycopg2
from dotenv import load_dotenv

# Load .env from repo root (one level up from crawler/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S',
)

log = logging.getLogger('crawler')


@contextmanager
def get_db():
    """Context manager for a psycopg2 connection. Auto-commits on exit."""
    url = os.environ.get('DATABASE_URL')
    if not url:
        log.error('DATABASE_URL is not set')
        sys.exit(1)
    conn = psycopg2.connect(url)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def polite_get(url: str, delay: float = 1.0, retries: int = 3) -> dict | list | None:
    """HTTP GET with retry + polite delay. Returns parsed JSON or None."""
    import requests
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=15, headers={'User-Agent': 'worldcup-backend/1.0 (non-commercial)'})
            r.raise_for_status()
            return r.json()
        except Exception as e:
            log.warning(f'GET {url} attempt {attempt + 1}/{retries} failed: {e}')
            time.sleep(delay * (attempt + 1))
    return None
