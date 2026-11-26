#!/usr/bin/env python3
"""Import reviewed Wikimedia portraits. Requires Pillow, network access and curated identities."""
import argparse
import html
import io
import json
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'assets/media.json'
USER_AGENT = 'Mozilla/5.0 EFEL media maintenance (https://github.com/vktenidis/efel)'
VARIANT_BLOCK = 1 << 24
LICENSE = re.compile(r'https://creativecommons\.org/(?:licenses/by(?:-sa)?/[1234]\.[05]|publicdomain/zero/1\.0)/?')


def read_url(url, limit=25_000_000):
    with urlopen(Request(url, headers={'User-Agent': USER_AGENT}), timeout=18) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('remote file exceeds size limit')
    return data


def metadata(filename):
    params = urlencode({'action': 'query', 'titles': 'File:' + filename, 'prop': 'imageinfo',
                        'iiprop': 'url|extmetadata', 'format': 'json', 'redirects': 1})
    data = json.loads(read_url('https://commons.wikimedia.org/w/api.php?' + params))
    page = next(iter(data['query']['pages'].values()))
    return page['imageinfo'][0]


def article_photo(title):
    url = 'https://en.wikipedia.org/wiki/' + quote(title.replace(' ', '_'), safe='')
    article = read_url(url).decode()
    if not re.search(r'\b(?:footballer|soccer player)\b', article, re.I):
        raise ValueError('article does not describe a footballer')
    match = re.search(r'<meta property="og:image" content="([^"]+)"', article)
    path = urlparse(html.unescape(match[1])).path if match else ''
    source = re.fullmatch(r'/wikipedia/commons/(?:thumb/)?[a-f0-9]/[a-f0-9]{2}/([^/]+)(?:/[^/]+)?', path)
    if not source or not re.search(r'\.(jpg|jpeg|png|webp)$', source[1], re.I):
        raise ValueError('no Commons photograph in the article')
    return unquote(source[1])


def import_photo(card_id, identity, name, fallback):
    filename = identity.get('commonsFile') or article_photo(identity['article'])
    info = metadata(filename)
    fields = {key: value['value'] for key, value in info['extmetadata'].items()}
    license_url = fields.get('LicenseUrl', '').replace('http:', 'https:', 1).removesuffix('/deed.en').rstrip('/') + '/'
    if not LICENSE.fullmatch(license_url) or fields.get('Restrictions', '') not in {'', 'personality'}:
        raise ValueError('license or usage restrictions require review')
    author = html.unescape(re.sub(r'<[^>]+>', '', fields.get('Artist', ''))).strip()
    if not author or author.lower() in {'unknown', 'anonymous'}:
        raise ValueError('missing creator')
    image_url = urlparse(info['url'])
    if image_url.hostname != 'upload.wikimedia.org' or not image_url.path.startswith('/wikipedia/commons/'):
        raise ValueError('unexpected asset host')
    src = 'https://upload.wikimedia.org' + image_url.path
    try:
        raw = read_url(src)
    except Exception:
        if not fallback:
            raise
        raw = read_url(info['url'])
    with Image.open(io.BytesIO(raw)) as opened:
        image = ImageOps.exif_transpose(opened).convert('RGB')
        image.thumbnail((420, 480), Image.Resampling.LANCZOS)
        path = f'assets/players/{card_id}.webp'
        (ROOT / path).parent.mkdir(exist_ok=True)
        image.save(ROOT / path, 'WEBP', quality=86, method=5)
    return {'name': name, 'path': path, 'commonsFile': filename, 'author': author, 'license': license_url,
            'source': info['descriptionurl'], 'changes': 'Resized and converted to WebP. Display crop.',
            'identity': identity.get('article', filename), 'restrictions': fields.get('Restrictions', '')}


def report(cards, media, previous, rosters, failures):
    ids = {row[0] for row in cards}
    portrait = set(media['players'])
    artwork = {row[0] for row in cards if len(row) > 4 and row[4]}
    key = lambda value: int(value[1:]) % VARIANT_BLOCK
    identities = {key(value) for value in ids}
    names = {}
    for row in cards:
        names.setdefault(key(row[0]), set()).add(row[1])
    groups = {'catalogue': ids, **rosters}
    return {'groups': {label: {'cards': len(values), 'artwork': len(artwork & values),
                               'portraits_before_mapped': len(previous & values), 'portraits_after': len(portrait & values),
                               'artwork_or_portrait': len((portrait | artwork) & values),
                               'missing_portrait': len(values - portrait)}
                       for label, values in groups.items()},
            'estimated_unique_by_base_id': len(identities),
            'base_ids_with_multiple_name_spellings': sum(len(group) > 1 for group in names.values()),
            'estimated_unique_with_portrait': len({key(value) for value in portrait}),
            'failed_candidates': failures}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rosters', type=Path, help='JSON object of group names and lists of player card IDs')
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--limit', type=int, help='Maximum new or failed identities to request in this run')
    parser.add_argument('--coverage-only', action='store_true', help='Summarize the current manifest without downloading')
    args = parser.parse_args()
    cards = json.loads((ROOT / 'standard.json').read_text())
    by_id = {row[0]: row for row in cards}
    media = json.loads(MANIFEST.read_text())
    identities = json.loads((ROOT / 'tools/portrait-identities.json').read_text())
    previous = {key for key, identity in identities.items() if identity.get('commonsFile')}
    rosters = {group: {'s' + str(key).removeprefix('s') for key in ids}
               for group, ids in (json.loads(args.rosters.read_text()) if args.rosters else {}).items()}
    owned = set().union(*rosters.values())
    previous_report = json.loads(args.report.read_text()) if args.report.exists() else {}
    failures = previous_report.get('failed_candidates', {})
    if not args.coverage_only:
        approved = {key: photo for key, photo in media['players'].items()
                    if key in identities and photo.get('path') and (ROOT / photo['path']).is_file()
                    and photo['name'] == identities[key]['name'] == by_id[key][1]}
        jobs = sorted(((key, item) for key, item in identities.items() if key not in approved), key=lambda pair: (pair[0] not in owned, -by_id[pair[0]][3], pair[0]))
        def run(job):
            key, item = job
            row = by_id[key]
            if item['name'] != row[1]:
                return key, None, 'catalogue identity changed'
            try:
                return key, import_photo(key, item, row[1], key in previous), None
            except (OSError, ValueError, KeyError, StopIteration, TypeError) as error:
                return key, None, str(error)
        with ThreadPoolExecutor(max_workers=2) as pool:
            for key, photo, error in pool.map(run, jobs[:args.limit]):
                if error:
                    failures[key] = error
                else:
                    failures.pop(key, None)
                    approved[key] = photo
        # Special cards encode a version in the high bits. Require the same base ID AND exact name.
        indexed = {(int(key[1:]) % VARIANT_BLOCK, photo['name']): photo for key, photo in approved.items()}
        media['players'] = {key: indexed[(int(key[1:]) % VARIANT_BLOCK, row[1])]
                            for key, row in by_id.items() if (int(key[1:]) % VARIANT_BLOCK, row[1]) in indexed}
        MANIFEST.write_text(json.dumps(media, ensure_ascii=False, indent=2) + '\n')
    result = report(cards, media, previous, rosters, failures)
    args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
