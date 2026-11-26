"""Bounded media fetches with per-origin cooldown for offline catalogue maintenance."""
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from threading import Lock
from time import monotonic
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

_retry_at = {}
_lock = Lock()


def read_url(url, limit=25_000_000):
    origin = urlsplit(url).netloc
    with _lock:
        if monotonic() < _retry_at.get(origin, 0):
            raise OSError('rate-limited by ' + origin + '; retry on a later run')
    request = Request(url, headers={'User-Agent': 'Mozilla/5.0 (EFEL media maintenance; https://github.com/vktenidis/efel)'})
    try:
        with urlopen(request, timeout=18) as response:
            data = response.read(limit + 1)
    except HTTPError as error:
        if error.code == 429:
            value = error.headers.get('Retry-After', '')
            delay = 300
            if value.isdigit():
                delay = int(value)
            elif value:
                try:
                    delay = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
                except (TypeError, ValueError, OverflowError):
                    pass
            with _lock:
                _retry_at[origin] = max(_retry_at.get(origin, 0), monotonic() + max(1, delay))
        raise
    if len(data) > limit:
        raise ValueError('remote file exceeds size limit')
    return data
