"""Audit every exported row and inspect the actual SQLite notes inside both Anki files."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import tempfile
import zipfile
from collections import Counter
from contextlib import closing
from html.parser import HTMLParser
from pathlib import Path

from validate_sections import answer_in_text, book_reference_pages, correction_notes


def digest(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


class PlainText(HTMLParser):
    blocks = {'p', 'h1', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'div', 'section', 'details', 'summary', 'br', 'hr'}

    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in self.blocks:
            self.parts.append(' ')

    def handle_endtag(self, tag):
        if tag in self.blocks:
            self.parts.append(' ')


def text(html: str) -> str:
    parser = PlainText()
    parser.feed(html)
    return re.sub(r'\s+', ' ', ''.join(parser.parts)).strip()


def ordered(values: list[str], rendered: str, identity: str) -> None:
    position = 0
    for value in values:
        normalized = re.sub(r'\s+', ' ', value).strip()
        found = rendered.find(normalized, position)
        require(found >= 0, f'Anki correspondence mismatch: {identity}: {normalized[:80]}')
        position = found + len(normalized)


def audit(catalog: dict, sources: Path, library: Path) -> dict:
    manifest = json.loads((library / 'manifest.json').read_text())
    require(manifest['review_status'] == 'cross-reviewed', 'Draft library cannot be released')
    source_hashes = {}
    all_cards = {}
    groups = []
    topic_occurrences = 0
    blocks = 0

    def provenance(card: dict, topics: list[dict]) -> None:
        expected = sorted({page for topic in topics for page in book_reference_pages(topic)})
        actual = sorted({page for source in card['sources'] if source['label'] == catalog['book']['filename'] for page in source.get('pages', [])})
        require(actual == expected, f'Source page correspondence mismatch: {card["id"]}')
        expected_urls = {s['url'] for topic in topics for s in topic.get('external_sources', [])}
        require({s['url'] for s in card['sources'] if s.get('url')} == expected_urls, f'External source correspondence mismatch: {card["id"]}')
    for expected in catalog['sections']:
        section = json.loads((sources / f'{expected["id"]}.json').read_text())
        source_hashes[section['id']] = digest(section)
        exported = json.loads((library / f'sections/{expected["id"]}.json').read_text())
        cards = {card['id']: card for card in exported['cards']}
        require(len(cards) == len(exported['cards']), 'Duplicate card identities')
        expected_ids = set()
        for block in section['blocks']:
            groups.append({'id': block['id'], 'title': block['title'], 'section_id': section['id'], 'problem': block['common_problem']})
            blocks += 1
            topic_occurrences += len(block['topics'])
            eje_id = f'eje/{block["id"]}'
            mother_id = f'madre/1/{block["id"]}'
            expected_ids.update([eje_id, mother_id])
            require(eje_id in cards and mother_id in cards, f'Missing block correspondence: {block["id"]}')
            eje = cards[eje_id]
            provenance(eje, block['topics'])
            provenance(cards[mother_id], block['topics'])
            require([r['text'] for r in eje['front']] == [t['pattern'] for t in block['topics']], f'Case correspondence mismatch: {eje_id}')
            require([r['title'] for r in eje['back']] == [t.get('answer_name', t['name']) for t in block['topics']], f'Diagnosis correspondence mismatch: {eje_id}')
            require([r['action'] for r in eje['back']] == [t['initial_action'] for t in block['topics']], f'Action correspondence mismatch: {eje_id}')
            for field, source_field in [('text', 'mechanism'), ('discriminator', 'key_discriminator'), ('reason', 'action_reason'), ('limits', 'limits')]:
                require([r[field] for r in eje['back']] == [t[source_field] for t in block['topics']], f'{field} correspondence mismatch: {eje_id}')
            require(cards[mother_id]['front'][0]['text'] == block['mother']['cue'] and cards[mother_id]['back'][0]['title'] == block['mother']['answer'], f'Mother pattern correspondence mismatch: {mother_id}')
            require(cards[mother_id].get('corrections', []) == [f'{t.get("answer_name", t["name"])}: {note}' for t in block['topics'] for note in correction_notes(t)], f'Mother correction correspondence mismatch: {mother_id}')
            for row, topic in zip(eje['back'], block['topics']):
                require(row.get('corrections', []) == correction_notes(topic), f'Case correction correspondence mismatch: {topic["id"]}')
                pages = sorted({p for s in row['sources'] if s['label'] == catalog['book']['filename'] for p in s.get('pages', [])})
                require(pages == book_reference_pages(topic), f'Case source correspondence mismatch: {topic["id"]}')
            for topic in block['topics']:
                tid = topic['id']
                expected_ids.update(f'madre/{level}/{tid}' for level in [2, 3, 4])
                for level in [2, 3, 4]:
                    require(f'madre/{level}/{tid}' in cards, f'Missing topic correspondence: {tid} N{level}')
                    current = cards[f'madre/{level}/{tid}']
                    provenance(current, [topic])
                    require(current.get('corrections', []) == correction_notes(topic), f'Correction correspondence mismatch: {tid} N{level}')
                recognition = cards[f'madre/2/{tid}']
                causal = cards[f'madre/3/{tid}']
                management = cards[f'madre/4/{tid}']
                require(recognition['front'][0]['text'] == topic['pattern'] and recognition['back'][0]['title'] == topic.get('answer_name', topic['name']), f'Recognition correspondence mismatch: {tid}')
                require(recognition['back'][0]['text'] == topic['mechanism'] and recognition['back'][0]['discriminator'] == topic['key_discriminator'], f'Recognition explanation correspondence mismatch: {tid}')
                require([r['text'] for r in causal['front']] == [f['mechanism'] for f in topic['findings']] and [r['text'] for r in causal['back']] == [f['finding'] for f in topic['findings']], f'Mechanism correspondence mismatch: {tid}')
                require([r['text'] for r in management['back']] == [topic['initial_action']] + [m['action'] for m in topic['modifiers']], f'Management correspondence mismatch: {tid}')
                require([r['text'] for r in management['front'][1:]] == [m['factor'] for m in topic['modifiers']], f'Modifier correspondence mismatch: {tid}')
                require(management['context'] == topic['pattern'], f'Management case correspondence mismatch: {tid}')
                require([r['reason'] for r in management['back']] == [topic['action_reason']] + [m['reason'] for m in topic['modifiers']], f'Management reason correspondence mismatch: {tid}')
        require(set(cards) == expected_ids, f'Unexpected card correspondence: {section["id"]}')
        all_cards.update(cards)
    require(manifest['content_sha256'] == digest(source_hashes), 'Exported content hash mismatch')
    require(manifest.get('groups') == groups, 'Clinical group correspondence mismatch')
    counts = Counter(c['family'] for c in all_cards.values())
    require(counts['eje'] == blocks and counts['madre'] == blocks + 3 * topic_occurrences, 'Family count mismatch')
    require(manifest['counts']['cards'] == len(all_cards), 'Manifest card count mismatch')
    planner = manifest.get('planner', {})
    require(planner.get('url') == 'index.json', 'Missing study planner index')
    index_path = library / 'index.json'
    require(hashlib.sha256(index_path.read_bytes()).hexdigest() == planner.get('sha256'), 'Study index checksum mismatch')
    index = json.loads(index_path.read_text())
    require(index['content_sha256'] == manifest['content_sha256'], 'Study index content mismatch')
    require([c['id'] for c in index['cards']] == list(all_cards), 'Study index coverage mismatch')
    require(planner['cards'] == len(all_cards), 'Study index count mismatch')
    for order, card in enumerate(index['cards']):
        require(card['order'] == order and 15 <= card['review_seconds'] < card['new_seconds'], f'Invalid study cost: {card["id"]}')
    notes = 0
    for download in manifest['downloads']:
        family = download['family']
        package = library / download['url']
        require(hashlib.sha256(package.read_bytes()).hexdigest() == download['sha256'], 'Package checksum mismatch')
        require(package.stat().st_size == download['bytes'], 'Package byte count mismatch')
        expected_ids = {identity for identity, c in all_cards.items() if c['family'] == family}
        with tempfile.TemporaryDirectory() as temporary, zipfile.ZipFile(package) as archive:
            dbpath = Path(temporary) / 'collection.anki2'
            dbpath.write_bytes(archive.read('collection.anki2'))
            with closing(sqlite3.connect(f'file:{dbpath}?mode=ro', uri=True)) as db:
                require(db.execute('pragma integrity_check').fetchone()[0] == 'ok', 'Anki database integrity failed')
                rows = db.execute('select guid, flds from notes').fetchall()
                require(len(rows) == len(expected_ids) == download['cards'], 'Anki note count mismatch')
                require(db.execute('select count(*) from cards').fetchone()[0] == len(rows), 'Anki card count mismatch')
                require(len({r[0] for r in rows}) == len(rows), 'Duplicate Anki GUID')
                exported_ids = set()
                for _, fields in rows:
                    identity, front, back = fields.split('\x1f')
                    require(identity in expected_ids and identity not in exported_ids, f'Unexpected Anki identity: {identity}')
                    exported_ids.add(identity)
                    card = all_cards[identity]
                    ordered([r['text'] for r in card['front']], text(front), identity)
                    ordered([value for r in card['back'] for value in [r.get(field, '') for field in ['title', 'text', 'discriminator', 'action', 'reason', 'limits']] + r.get('corrections', []) if value] + card.get('corrections', []), text(back), identity)
                    if card['level'] in [0, 2]:
                        for answer in card['back']:
                            require(not answer_in_text(answer['title'], text(front)), f'Answer leaked on recognition front: {identity}')
                    require(catalog['book']['filename'] not in front, f'Source leaked on front: {identity}')
                require(exported_ids == expected_ids, 'Anki coverage mismatch')
                notes += len(rows)
    require(len(manifest['downloads']) == 2 and {d['family'] for d in manifest['downloads']} == {'eje', 'madre'}, 'Both complete downloads are required')
    require(notes == len(all_cards), 'Combined Anki count mismatch')
    referenced = {p for card in all_cards.values() for source in card['sources'] if source['label'] == catalog['book']['filename'] for p in source.get('pages', [])}
    require(referenced == set(range(1, catalog['book']['pages'] + 1)), 'Complete book reference coverage mismatch')
    return {'content_sha256': manifest['content_sha256'], 'sections': len(source_hashes), 'blocks': blocks, 'topic_occurrences': topic_occurrences, 'cards': len(all_cards), 'anki_notes': notes, 'book_pages_referenced': len(referenced), 'families': dict(counts), 'review_status': manifest['review_status']}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=Path('content/curriculum.json'))
    parser.add_argument('--sources', type=Path, default=Path('content/sections'))
    parser.add_argument('--library', type=Path, default=Path('app/public/study'))
    parser.add_argument('--report', type=Path, default=Path('output/full-book/release-audit.json'))
    args = parser.parse_args()
    report = audit(json.loads(args.catalog.read_text()), args.sources, args.library)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
