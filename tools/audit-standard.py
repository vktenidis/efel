"""Audit EFEL's checkout. Optionally export records for external card-ID matching."""
import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def audit(export=None):
    cards = json.loads((ROOT / 'standard.json').read_text())
    ratings = json.loads((ROOT / 'assets/verified-ratings.json').read_text())
    with (ROOT / 'supabase/players.csv').open(newline='') as stream:
        seed = {row['id']: row for row in csv.DictReader(stream)}
    assert len(seed) == len(cards) == len({row[0] for row in cards})
    assert set(ratings) <= {row[0] for row in cards}
    groups = defaultdict(list)
    for cid, name, pos, base, idx in cards:
        source = seed[cid[1:]]
        assert (name, pos, base, idx) == (source['name'], source['pos'], int(source['ovr']), int(source['img'])), cid
        ref = ratings.get(cid)
        if ref:
            assert ref['base'] == base and base <= ref['max'] <= 120, cid
            assert ref.get('source') or (idx > 0 and ref.get('artworkIndex') == idx), cid
        groups[(int(cid[1:]) % 16777216, name)].append(cid)

    duplicates = [group for group in groups.values() if len(group) > 1]
    complete = [group for group in duplicates if all(cid in ratings for cid in group)]
    if export:
        with export.open('w', newline='') as stream:
            writer = csv.writer(stream)
            writer.writerow(['card_id', 'catalogue_name', 'position', 'base_ovr', 'verified_max_ovr',
                             'reference_url', 'artwork_index', 'ingame_gp', 'ingame_gp_source'])
            for cid, name, pos, base, idx in cards:
                ref = ratings.get(cid, {})
                writer.writerow([cid, name, pos, base, ref.get('max', ''), ref.get('source', ''),
                                 ref.get('artworkIndex', ''), seed[cid[1:]].get('ingame_gp', ''),
                                 seed[cid[1:]].get('ingame_gp_source', '')])

    return {
        'cards': len(cards),
        'card_ids_with_verified_max': len(ratings),
        'missing_verified_max': len(cards) - len(ratings),
        'seed_efel_price_counts': Counter(row['price'] for row in seed.values()),
        'sourced_card_specific_ingame_gp_prices_in_seed': sum(
            1 for row in seed.values() if row.get('ingame_gp') and row.get('ingame_gp_source')),
        'id_and_name_groups_with_multiple_cards': len(duplicates),
        'groups_with_verified_max_on_every_card': len(complete),
        'eligible_secondary_cards': sum(len(group) - 1 for group in complete),
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', type=Path, help='Write a card-ID matching CSV; empty in-game GP fields require a source.')
    print(json.dumps(audit(parser.parse_args().export), ensure_ascii=False, indent=2))
