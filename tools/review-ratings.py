"""Import PESDB's MAX Overall only for an exact standard card and base-rating match."""
import argparse
import html
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = {row[0]: row for row in json.loads((ROOT / 'standard.json').read_text())}
OUTPUT = ROOT / 'assets' / 'verified-ratings.json'


def check(card):
    card_id, name, position, overall = card[:4]
    url = 'https://pesdb.net/efootball/?id=' + card_id[1:]
    with urlopen(Request(url, headers={'User-Agent': 'EFEL card reference check/1.0'}), timeout=15) as response:
        page = response.read().decode()
    canonical = re.search(r'<link rel="canonical" href="(https://pesdb.net/efootball/players/[\w%-]+)">', page)
    if not canonical or not canonical[1].endswith('-' + card_id[1:]):
        raise ValueError('exact card ID unavailable')
    fields = {key: html.unescape(re.sub('<[^>]+>', '', value)).strip()
              for key, value in re.findall(r'<dt>([^<]+)</dt><dd[^>]*>(.*?)</dd>', page, re.S)}
    if (name, position, str(overall), 'Standard') != tuple(fields.get(k) for k in
            ('Player Name', 'Primary Position', 'Overall Rating', 'Card Type')):
        raise ValueError('name, position, base rating or card category differ')
    maximum = int(fields['Max Overall'])
    if not overall <= maximum <= 120:
        raise ValueError('invalid maximum')
    return {'base': overall, 'max': maximum, 'source': canonical[1]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cards', nargs='+', choices=None, help='Exact EFEL card IDs, including s prefix')
    args = parser.parse_args()
    records = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    for card_id in dict.fromkeys(args.cards):
        try:
            records[card_id] = check(CATALOGUE[card_id])
            print(card_id, records[card_id]['max'], flush=True)
        except HTTPError as err:
            print(card_id, str(err), flush=True)
            if err.code == 429:
                break
        except (ValueError, KeyError, OSError) as err:
            print(card_id, str(err), flush=True)
        time.sleep(0.4)
    OUTPUT.write_text(json.dumps(records, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
