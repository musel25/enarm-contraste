"""Compile reviewed clinical content into matching web cards and two Anki packages."""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import shutil
import sys
import tempfile
from collections import Counter
from pathlib import Path

import genanki

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_sections import validate


def content_hash(value: dict) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def answer_name(topic: dict) -> str:
    return topic.get('answer_name', topic['name'])


def references(topics: list[dict], book_name: str) -> list[dict]:
    pages = sorted({item['page'] for topic in topics for item in topic.get('evidence', [])})
    result = [{'label': book_name, 'pages': pages}] if pages else []
    urls = set()
    for topic in topics:
        for source in topic.get('external_sources', []):
            if source['url'] not in urls:
                result.append({'label': source['label'], 'url': source['url']})
                urls.add(source['url'])
    return result


def compile_section(section: dict, book_name: str) -> dict:
    cards = []
    for block in section['blocks']:
        topics = block['topics']
        base = {'section_id': section['id'], 'block_id': block['id']}
        all_sources = references(topics, book_name)
        cards.append({**base, 'id': f'eje/{block["id"]}', 'family': 'eje', 'level': 0,
                      'prompt': '¿Qué diagnóstico corresponde a cada caso?', 'context': block['common_problem'],
                      'front': [{'text': t['pattern'], 'highlight': t['key_discriminator']} for t in topics],
                      'back': [{'topic_id': t['id'], 'title': answer_name(t), 'text': t['mechanism'], 'discriminator': t['key_discriminator'], 'action': t['initial_action'], 'reason': t['action_reason'], 'limits': t['limits'], 'sources': references([t], book_name)} for t in topics], 'sources': all_sources})
        mother = block['mother']
        cards.append({**base, 'id': f'madre/1/{block["id"]}', 'family': 'madre', 'level': 1,
                      'prompt': '¿Qué patrón organiza este problema?', 'context': '',
                      'front': [{'text': mother['cue']}],
                      'back': [{'title': mother['answer'], 'text': mother['explanation']}], 'sources': all_sources})
        for topic in topics:
            sources = references([topic], book_name)
            topic_base = {**base, 'topic_id': topic['id']}
            cards.append({**topic_base, 'id': f'madre/2/{topic["id"]}', 'family': 'madre', 'level': 2,
                          'prompt': '¿Qué diagnóstico o concepto explica este caso?', 'context': '',
                          'front': [{'text': topic['pattern'], 'highlight': topic['key_discriminator']}],
                          'back': [{'title': answer_name(topic), 'text': topic['mechanism'], 'discriminator': topic['key_discriminator'], 'limits': topic['limits']}], 'sources': sources})
            cards.append({**topic_base, 'id': f'madre/3/{topic["id"]}', 'family': 'madre', 'level': 3,
                          'prompt': '¿Qué hallazgo produce cada mecanismo?', 'context': answer_name(topic),
                          'front': [{'text': finding['mechanism']} for finding in topic['findings']],
                          'back': [{'title': '', 'text': finding['finding']} for finding in topic['findings']], 'sources': sources})
            cards.append({**topic_base, 'id': f'madre/4/{topic["id"]}', 'family': 'madre', 'level': 4,
                          'prompt': '¿Qué haces primero y cómo cambia la decisión?', 'context': topic['pattern'],
                          'front': [{'text': 'Elige la primera acción para el caso.'}] + [{'text': modifier['factor']} for modifier in topic['modifiers']],
                          'back': [{'title': 'Primera decisión', 'text': topic['initial_action'], 'reason': topic['action_reason'], 'limits': topic['limits']}] + [{'title': modifier['factor'], 'text': modifier['action'], 'reason': modifier['reason']} for modifier in topic['modifiers']], 'sources': sources})
    return {'id': section['id'], 'title': section['title'], 'blocks': [{'id': b['id'], 'title': b['title'], 'topics': len(b['topics'])} for b in section['blocks']], 'cards': cards}


def escaped(value: str) -> str:
    return html.escape(value, quote=True)


def marked(text: str, highlight: str | None = None) -> str:
    if highlight and highlight in text:
        before, after = text.split(highlight, 1)
        return f'{escaped(before)}<mark>{escaped(highlight)}</mark>{escaped(after)}'
    return escaped(text)


def render_front(card: dict) -> str:
    context = f'<p class="context">{escaped(card["context"])}</p>' if card['context'] else ''
    rows = ''.join(f'<li>{marked(row["text"], row.get("highlight"))}</li>' for row in card['front'])
    return f'<h2>{escaped(card["prompt"])}</h2>{context}<ol>{rows}</ol>'


def render_sources(sources: list[dict]) -> str:
    rows = []
    for source in sources:
        label = escaped(source['label'])
        if source.get('url'):
            label = f'<a href="{escaped(source["url"])}">{label}</a>'
        elif source.get('pages'):
            label += ' · pp. ' + ', '.join(str(p) for p in source['pages'])
        rows.append(f'<li>{label}</li>')
    return '<ul class="sources">' + ''.join(rows) + '</ul>'


def render_back(card: dict) -> str:
    rows = []
    for row in card['back']:
        title = f'<h3>{escaped(row["title"])}</h3>' if row['title'] else ''
        details = ''
        for field, label in [('discriminator', 'Dato clave'), ('action', 'Primera acción'), ('reason', 'Por qué'), ('limits', 'Límite del patrón')]:
            if row.get(field):
                details += f'<p><strong>{label}:</strong> {escaped(row[field])}</p>'
        rows.append(f'<li>{title}<p>{escaped(row["text"])}</p>{details}</li>')
    return '<ol class="answers">' + ''.join(rows) + '</ol>' + render_sources(card['sources']) + '<p class="notice">Material de estudio. Revisión clínica profesional pendiente.</p>'


CSS = """
.card {font-family:Arial,sans-serif;font-size:19px;line-height:1.6;text-align:left;color:#29233b;background:#fbf9ff;max-width:840px;margin:auto;padding:24px}
h2,h3 {line-height:1.3} h2 {font-size:23px} h3 {font-size:21px;color:#5c408a;margin:0 0 8px}
ol {padding-left:30px} li {padding:12px 5px;border-bottom:1px solid #e0d9ed} p {margin:8px 0}
mark {background:#ffdfab;color:#50391b;padding:1px 3px;border-radius:3px} .context {font-style:italic}
.sources,.notice {font-size:13px;color:#625b6b} a {color:#684399} .nightMode .card {background:#211d2a;color:#eee8f5}
.nightMode h3,.nightMode a {color:#d5bbff} .nightMode .sources,.nightMode .notice {color:#c6bcd2}
"""


def stable_id(value: str) -> int:
    return int(hashlib.sha256(value.encode()).hexdigest()[:8], 16) % 1900000000 + 100000000


def validate_review(section: dict, review: dict) -> None:
    expected_topics = [t['id'] for b in section['blocks'] for t in b['topics']]
    actual_topics = review.get('topic_ids', [])
    needed_pages = {p for b in section['blocks'] for t in b['topics'] for p in t['source_pages'] + t.get('verified_source_pages', [])}
    needed_urls = {s['url'] for b in section['blocks'] for t in b['topics'] for s in t.get('external_sources', [])}
    if (review.get('section_id') != section['id'] or review.get('status') != 'approved'
            or not review.get('author') or not review.get('reviewer') or review['author'] == review['reviewer']
            or review.get('content_sha256') != content_hash(section) or Counter(actual_topics) != Counter(expected_topics)
            or review.get('issues') != [] or not needed_pages.issubset(set(review.get('pages_checked', [])))
            or not needed_urls.issubset(set(review.get('external_urls_checked', [])))):
        raise ValueError(f'Invalid or stale independent review: {section["id"]}')


def check_coverage(section: dict, expected: dict) -> None:
    if section['id'] != expected['id']:
        raise ValueError('Section coverage mismatch')
    actual = {b['id']: b for b in section['blocks']}
    if len(actual) != len(section['blocks']) or set(actual) != {b['id'] for b in expected['blocks']}:
        raise ValueError(f'Block coverage mismatch: {section["id"]}')
    for block in expected['blocks']:
        authored = actual[block['id']]
        if authored['mother']['answer'].casefold() in authored['mother']['cue'].casefold():
            raise ValueError(f'Answer leaked on mother front: {block["id"]}')
        if Counter(t['id'] for t in authored['topics']) != Counter(t['id'] for t in block['topics']):
            raise ValueError(f'Topic coverage mismatch: {block["id"]}')
        names = {t['id']: t['name'] for t in block['topics']}
        for topic in authored['topics']:
            if topic['name'] != names[topic['id']] or topic.get('source_gaps') != []:
                raise ValueError(f'Incomplete coverage: {topic["id"]}')
            if answer_name(topic).casefold() in topic['pattern'].casefold():
                raise ValueError(f'Answer leaked on recognition front: {topic["id"]}')
            for field in ['pattern', 'key_discriminator', 'mechanism', 'initial_action', 'action_reason', 'limits']:
                if not isinstance(topic.get(field), str) or not topic[field].strip():
                    raise ValueError(f'Incomplete coverage: {topic["id"]} {field}')
            if topic['key_discriminator'] not in topic['pattern'] or not topic.get('findings'):
                raise ValueError(f'Incomplete coverage: {topic["id"]} discriminator/findings')


def build(catalog: dict, sections: Path, reviews: Path, output: Path, preview: bool = False, source_validation: dict | None = None) -> dict:
    structural = validate(catalog, sections, None, allow_partial=preview)
    if structural['errors']:
        raise ValueError('Invalid section coverage: ' + json.dumps(structural['errors'][:5], ensure_ascii=False))
    if not preview and (not source_validation or source_validation.get('source_text_checked') is not True
            or source_validation.get('source_book_sha256') != catalog['book']['sha256']
            or source_validation.get('errors') != [] or source_validation.get('missing_sections') != []
            or source_validation.get('section_hashes') != structural['section_hashes']
            or source_validation.get('verified_sections') != len(catalog['sections'])):
        raise ValueError('Missing or stale source validation for this content')
    compiled = []
    hashes = {}
    groups = []
    for expected in catalog['sections']:
        path = sections / f'{expected["id"]}.json'
        if preview and not path.exists():
            continue
        if not path.exists():
            raise ValueError(f'Missing section coverage: {expected["id"]}')
        section = json.loads(path.read_text())
        check_coverage(section, expected)
        if not preview:
            review_path = reviews / path.name
            if not review_path.exists():
                raise ValueError(f'Missing independent review: {expected["id"]}')
            validate_review(section, json.loads(review_path.read_text()))
        hashes[section['id']] = content_hash(section)
        groups.extend({'id': b['id'], 'title': b['title'], 'section_id': section['id'], 'problem': b['common_problem']} for b in section['blocks'])
        compiled.append(compile_section(section, catalog['book']['filename']))
    if not compiled:
        raise ValueError('No authored coverage')
    all_cards = [c for section in compiled for c in section['cards']]
    counts = Counter(c['family'] for c in all_cards)
    occurrence_count = sum(len(b['topics']) for expected in catalog['sections'] if expected['id'] in hashes for b in expected['blocks'])
    block_count = sum(len(s['blocks']) for s in compiled)
    expected_counts = {'eje': block_count, 'madre': block_count + 3 * occurrence_count}
    if dict(counts) != expected_counts or len({c['id'] for c in all_cards}) != len(all_cards):
        raise ValueError('Card coverage mismatch or duplicate identities')
    manifest = {'schema_version': 1, 'review_status': 'draft' if preview else 'cross-reviewed',
                'professional_review': 'pending', 'book': catalog['book'], 'guide': catalog.get('guide', {}),
                'content_sha256': content_hash(hashes), 'counts': {'sections': len(compiled), 'blocks': block_count, 'topic_occurrences': occurrence_count, 'cards': len(all_cards), **dict(counts)},
                'curriculum_counts': catalog['counts'],
                'sections': [{'id': s['id'], 'title': s['title'], 'blocks': len(s['blocks']), 'cards': len(s['cards']), 'url': f'sections/{s["id"]}.json'} for s in compiled],
                'groups': groups,
                'downloads': []}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='enarm-build-', dir=output.parent) as temporary:
        stage = Path(temporary) / 'study'
        stage.mkdir()
        for section in compiled:
            write_json(stage / f'sections/{section["id"]}.json', section)
        model = genanki.Model(stable_id('enarm-contraste-full-v1-model'), 'ENARM Contraste · Dos formatos v1',
                              fields=[{'name': n} for n in ['Identity', 'Front', 'Back']],
                              templates=[{'name': 'Reconocer y decidir', 'qfmt': '{{Front}}', 'afmt': '{{FrontSide}}<hr id="answer">{{Back}}'}], css=CSS)
        for family, label in [('eje', 'Eje Clínico'), ('madre', 'Patrones Madre')]:
            decks = []
            for section in compiled:
                name = f'ENARM Contraste::{label}::{section["id"]} {section["title"]}'
                deck = genanki.Deck(stable_id('enarm-full-' + family + '-' + section['id']), name)
                for card in section['cards']:
                    if card['family'] == family:
                        deck.add_note(genanki.Note(model=model, fields=[card['id'], render_front(card), render_back(card)], guid=genanki.guid_for('enarm-contraste-full-v1', card['id']), tags=[f'seccion_{section["id"]}', f'bloque_{card["block_id"]}', family, f'nivel_{card["level"]}']))
                decks.append(deck)
            target = stage / f'enarm-{family}.apkg'
            genanki.Package(decks).write_to_file(str(target))
            manifest['downloads'].append({'family': family, 'label': label, 'url': target.name, 'cards': counts[family], 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
        write_json(stage / 'manifest.json', manifest)
        write_json(stage / 'coverage.json', {'content_sha256': manifest['content_sha256'], 'review_status': manifest['review_status'], 'section_hashes': hashes, 'counts': manifest['counts'], 'curriculum_counts': manifest['curriculum_counts']})
        if output.exists():
            if any(output.iterdir()) and not (output / 'manifest.json').exists():
                raise ValueError(f'Refusing to replace a directory without a generated manifest: {output}')
            shutil.rmtree(output)
        shutil.move(str(stage), str(output))
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=Path('content/curriculum.json'))
    parser.add_argument('--sections', type=Path, default=Path('content/sections'))
    parser.add_argument('--reviews', type=Path, default=Path('content/reviews'))
    parser.add_argument('--source-validation', type=Path, default=Path('content/source-validation.json'))
    parser.add_argument('--output', type=Path, default=Path('app/public/study'))
    parser.add_argument('--preview', action='store_true', help='Local draft export; never use for release')
    args = parser.parse_args()
    proof = json.loads(args.source_validation.read_text()) if not args.preview and args.source_validation.exists() else None
    manifest = build(json.loads(args.catalog.read_text()), args.sections, args.reviews, args.output, args.preview, proof)
    print(json.dumps({'counts': manifest['counts'], 'review_status': manifest['review_status']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
