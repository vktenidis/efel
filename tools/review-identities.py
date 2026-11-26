"""Cross-check roster candidates against stable PESDB IDs and football biographies."""
import argparse
import html
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from media_http import read_url

ROOT = Path(__file__).resolve().parents[1]


def page(url):
    return read_url(url, 4_000_000).decode()


def plain(markup):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', markup)).split())


def review(row):
    card_id, name, position = row[:3]
    base_id = int(card_id[1:]) % (1 << 24)
    reference = 'https://pesdb.net/efootball/?id=' + str(base_id)
    try:
        record = page(reference)
        fields = {key: plain(value) for key, value in re.findall(r'<dt>([^<]+)</dt><dd[^>]*>(.*?)</dd>', record, re.S)}
        if fields.get('Player Name') != name or fields.get('Primary Position') != position:
            return card_id, None, 'catalogue name or position differs'
        wiki = page('https://en.wikipedia.org/wiki/' + quote(name.replace(' ', '_'), safe=''))
        title = re.search(r'<title>(.*?) - Wikipedia</title>', wiki)
        box = re.search(r'<table[^>]*class="infobox[^"]*"[^>]*>.*?</table>', wiki, re.S)
        if not title or html.unescape(title[1]) != name or not box:
            return card_id, None, 'unconfirmed biography'
        bio = plain(box[0])
        birthday = re.search(r'class="bday">(\d{4}-\d{2}-\d{2})<', box[0])
        height = re.search(r'\bHeight\s+(\d\.\d{2})\s*m\b', bio)
        if not birthday or not height or 'Senior career' not in bio:
            return card_id, None, 'missing biographical fields'
        born = date.fromisoformat(birthday[1])
        today = date.today()
        age = today.year-born.year-((today.month,today.day)<(born.month,born.day))
        cm = round(float(height[1])*100)
        country = fields['Nationality']
        if age != int(fields['Age']) or abs(cm-int(fields['Height'].split()[0])) > 2 or not re.search(r'\b'+re.escape(country)+r'\b', bio):
            return card_id, None, 'age, height or country differs'
        return card_id, {'name':name, 'article':name, 'gameRecord':reference, 'position':position,
                         'nationality':country, 'birthDate':born.isoformat(), 'heightCm':cm}, None
    except HTTPError as error:
        return card_id, None, 'HTTP '+str(error.code)
    except (OSError, KeyError, ValueError, IndexError) as error:
        return card_id, None, type(error).__name__


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rosters', required=True, type=Path)
    parser.add_argument('--group', required=True)
    parser.add_argument('--review-log', required=True, type=Path)
    args = parser.parse_args()
    roster = {'s'+str(k).removeprefix('s') for k in json.loads(args.rosters.read_text())[args.group]}
    path = ROOT / 'tools/portrait-identities.json'
    identities = json.loads(path.read_text())
    cards = json.loads((ROOT/'standard.json').read_text())
    jobs = [r for r in cards if r[0] in roster and r[0] not in identities and not r[4]]
    rejected = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        for key, identity, reason in pool.map(review, jobs):
            if identity:
                identities[key] = identity
            else:
                rejected[key] = reason
    path.write_text(json.dumps(identities,ensure_ascii=False,indent=2)+'\n')
    args.review_log.write_text(json.dumps(rejected,indent=2)+'\n')
    print('Reviewed',len(jobs),'matched',len(jobs)-len(rejected),'held',len(rejected))
