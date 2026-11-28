"""Check a bounded list of current Standard prices against public PES Master player pages."""
import argparse
import html
import json
import re
import time
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'assets/standard-prices.json'


def key(name):
    return ''.join(ch for ch in unicodedata.normalize('NFKD', name.casefold()) if ch.isalnum())


def review(row):
    cid, name, position, _, _ = row
    number = int(cid[1:])
    slug = re.sub('[^a-z0-9]+', '-', unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()).strip('-') or 'player'
    url = f'https://www.pesmaster.com/{slug}/efootball-2022/player/{number}/'
    with urlopen(Request(url, headers={'User-Agent': 'EFEL card price review (github.com/vktenidis/efel)'}), timeout=15) as response:
        source = response.geturl()
        page = response.read(2_000_001).decode()
    dest = urlsplit(source)
    if dest.scheme != 'https' or dest.netloc != 'www.pesmaster.com' or not dest.path.endswith(f'/player/{number}/') or len(page)>2_000_000:
        raise ValueError('unexpected source')
    record, _ = json.JSONDecoder().raw_decode(page.split('const player = ', 1)[1].lstrip())
    listed = re.search(r'<td>Price</td>\s*<td>(.*?)</td>', page, re.S)
    if not listed:
        raise ValueError('source has no listed GP price')
    display = html.unescape(re.sub('<[^>]+>', '', listed[1])).strip().replace(',', '')
    pos = re.search(r'<td>Position</td>\s*<td><span[^>]*>([^<]+)</span>', page)
    price = record.get('cost_gp')
    if (record['id'] != number or record['card_type'] != 0 or record.get('fake') != 0
            or key(record['name']) != key(name) or not pos or pos[1] != position or not isinstance(price, int)
            or price <= 0 or display != str(price)):
        raise ValueError('card identity, position, category or price mismatch')
    return dict(name=name, position=position, sourceOVR=record['ovr'], gp=price, source=source, checked=date.today().isoformat())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ids', nargs='+', help='Exact catalogue card IDs')
    args = parser.parse_args()
    cards = {row[0]: row for row in json.loads((ROOT/'standard.json').read_text())}
    prices = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    for cid in dict.fromkeys(args.ids):
        try:
            prices[cid] = review(cards[cid])
            print(cid, prices[cid]['gp'], flush=True)
        except HTTPError as error:
            print(cid, error, flush=True)
            if error.code in (403,429):
                break
        except (ValueError, OSError, IndexError, KeyError) as error:
            print(cid, error, flush=True)
        time.sleep(1)
    OUTPUT.write_text(json.dumps(prices, ensure_ascii=False, indent=2, sort_keys=True)+'\n')


if __name__ == '__main__':
    main()
