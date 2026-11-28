"""Report source and card-version coverage without treating estimates as verified prices."""
import collections
import json
from pathlib import Path
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1]
cards = {row[0]: row for row in json.loads((root / 'standard.json').read_text(encoding='utf-8'))}
quotes = json.loads((root / 'assets/standard-prices.json').read_text(encoding='utf-8'))
counts = collections.Counter()
sources = collections.Counter()
for card_id, quote in quotes.items():
    row = cards.get(card_id)
    if row is None:
        counts['not_in_catalogue'] += 1
        continue
    sources[urlsplit(quote.get('source', '')).hostname or 'unknown'] += 1
    if quote.get('name') != row[1] or quote.get('position') != row[2]:
        counts['name_or_position_mismatch'] += 1
    elif quote.get('sourceOVR') != row[3]:
        counts['different_base_ovr'] += 1
    else:
        counts['matching_catalogue_base_ovr'] += 1
print(json.dumps({'catalogue_cards':len(cards),'third_party_quotes':len(quotes),
  'without_quote':sum(card_id not in quotes for card_id in cards),
  'comparison':dict(counts),'source_domains':dict(sources),
  'note':'A matching OVR alone does not prove official provenance or identical card version.'},ensure_ascii=False,indent=2))
