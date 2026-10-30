"""Check inventory coverage and evidence against the complete book pages."""
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


def normalized(value: str) -> str:
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value)).strip().casefold()


def validate(catalog: dict, directory: Path, pages: Path | None, selected: list[str] | None = None, allow_partial: bool = False) -> dict:
    report = {'verified_sections': 0, 'verified_blocks': 0, 'verified_topics': 0, 'verified_evidence': 0, 'visual_evidence': 0, 'external_sources': 0, 'missing_sections': [], 'errors': []}
    book_pages = catalog.get('book', {}).get('pages', 1150)
    visual_pages = set(catalog.get('book', {}).get('visual_review_pages', []))
    page_cache = {}

    def error(code: str, item: str, detail: str) -> None:
        report['errors'].append({'code': code, 'id': item, 'detail': detail})

    def text_field(obj: dict, field: str, identity: str) -> bool:
        if not isinstance(obj.get(field), str) or not obj[field].strip():
            error('empty_field', identity, field)
            return False
        return True

    for expected in catalog['sections']:
        sid = expected['id']
        if selected and sid not in selected:
            continue
        path = directory / f'{sid}.json'
        if not path.exists():
            report['missing_sections'].append(sid)
            if not allow_partial:
                error('missing_section', sid, str(path))
            continue
        initial_errors = len(report['errors'])
        try:
            section = json.loads(path.read_text())
        except (ValueError, OSError) as failure:
            error('invalid_json', sid, str(failure))
            continue
        if section.get('id') != sid:
            error('section_identity', sid, str(section.get('id')))
        blocks = section.get('blocks', [])
        if not isinstance(blocks, list):
            error('invalid_blocks', sid, 'Expected an array')
            continue
        for identity, count in Counter(block.get('id') for block in blocks).items():
            if count > 1:
                error('duplicate_block', str(identity), str(count))
        expected_block_ids = {block['id'] for block in expected['blocks']}
        for block in blocks:
            if block.get('id') not in expected_block_ids:
                error('unexpected_block', str(block.get('id')), sid)
        indexed_blocks = {block.get('id'): block for block in blocks}
        for expected_block in expected['blocks']:
            bid = expected_block['id']
            block = indexed_blocks.get(bid)
            if block is None:
                error('missing_block', bid, sid)
                continue
            text_field(block, 'common_problem', bid)
            mother = block.get('mother', {})
            for field in ('cue', 'answer', 'explanation'):
                text_field(mother, field, bid)
            topics = block.get('topics', [])
            if not isinstance(topics, list):
                error('invalid_topics', bid, 'Expected an array')
                continue
            for identity, count in Counter(topic.get('id') for topic in topics).items():
                if count > 1:
                    error('duplicate_topic', str(identity), str(count))
            expected_topic_ids = {topic['id'] for topic in expected_block['topics']}
            for topic in topics:
                if topic.get('id') not in expected_topic_ids:
                    error('unexpected_topic', str(topic.get('id')), bid)
            indexed_topics = {topic.get('id'): topic for topic in topics}
            for expected_topic in expected_block['topics']:
                tid = expected_topic['id']
                topic = indexed_topics.get(tid)
                if topic is None:
                    error('missing_topic', tid, bid)
                    continue
                topic_errors = len(report['errors'])
                if topic.get('name') != expected_topic['name']:
                    error('topic_name', tid, f'Expected {expected_topic["name"]}')
                if topic.get('source_pages') != expected_topic['source_pages'] and not topic.get('source_corrections'):
                    error('source_pages_changed', tid, 'Correction must be explicit')
                verified_pages = topic.get('verified_source_pages', [])
                if set(verified_pages) - set(expected_topic['source_pages']) and not topic.get('source_corrections'):
                    error('unexplained_page_correction', tid, 'verified_source_pages requires source_corrections')
                declared_pages = set(topic.get('source_pages', []) + verified_pages)
                for field in ('pattern', 'key_discriminator', 'mechanism', 'initial_action', 'action_reason', 'limits'):
                    text_field(topic, field, tid)
                for field, minimum, maximum in [('pattern', 20, 45), ('mechanism', 15, 35), ('initial_action', 1, 45)]:
                    words = len(topic.get(field, '').split())
                    if not minimum <= words <= maximum:
                        error('word_count', tid, f'{field}: {words}, expected {minimum}–{maximum}')
                if normalized(topic.get('key_discriminator', '')) not in normalized(topic.get('pattern', '')):
                    error('discriminator_not_in_pattern', tid, topic.get('key_discriminator', ''))
                if not isinstance(topic.get('source_gaps'), list):
                    error('missing_gap_status', tid, 'source_gaps must be an array')
                elif topic['source_gaps']:
                    error('source_gap', tid, '; '.join(topic['source_gaps']))
                findings = topic.get('findings', [])
                if not isinstance(findings, list) or not findings:
                    error('missing_findings', tid, 'At least one causal pair is required')
                else:
                    for finding in findings:
                        text_field(finding, 'mechanism', tid)
                        text_field(finding, 'finding', tid)
                modifiers = topic.get('modifiers', [])
                if not isinstance(modifiers, list):
                    error('invalid_modifiers', tid, 'Expected an array')
                else:
                    for modifier in modifiers:
                        for field in ('factor', 'action', 'reason'):
                            text_field(modifier, field, tid)
                evidence = topic.get('evidence', [])
                external = topic.get('external_sources', [])
                if not evidence and not external:
                    error('missing_evidence', tid, 'No source evidence')
                for item in evidence:
                    page = item.get('page')
                    quote = item.get('quote', '')
                    if not isinstance(page, int) or not 1 <= page <= book_pages:
                        error('invalid_page', tid, str(page))
                        continue
                    if page not in declared_pages:
                        error('unreferenced_evidence_page', tid, str(page))
                    if not isinstance(quote, str) or len(quote.strip()) < 12:
                        error('insufficient_evidence', tid, str(quote))
                        continue
                    if item.get('visual'):
                        if page not in visual_pages:
                            error('unexpected_visual_evidence', tid, str(page))
                        else:
                            report['visual_evidence'] += 1
                        continue
                    if pages is None:
                        continue
                    if page not in page_cache:
                        source = pages / f'{page:04}.txt'
                        page_cache[page] = normalized(source.read_text()) if source.exists() else ''
                    if normalized(quote) not in page_cache[page]:
                        error('evidence_not_found', tid, f'Page {page}: {quote}')
                    else:
                        report['verified_evidence'] += 1
                for source in external:
                    url = urlparse(source.get('url', ''))
                    if url.scheme != 'https' or not url.netloc or not source.get('label') or not source.get('quote'):
                        error('invalid_external_source', tid, str(source))
                    else:
                        report['external_sources'] += 1
                if len(report['errors']) == topic_errors:
                    report['verified_topics'] += 1
            report['verified_blocks'] += 1
        if len(report['errors']) == initial_errors:
            report['verified_sections'] += 1
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=Path('content/curriculum.json'))
    parser.add_argument('--sections', type=Path, default=Path('content/sections'))
    parser.add_argument('--pages', type=Path, default=Path('/tmp/enarm-authoring/pages'))
    parser.add_argument('--section', action='append')
    parser.add_argument('--allow-partial', action='store_true')
    parser.add_argument('--report', type=Path, default=Path('output/full-book/validation.json'))
    args = parser.parse_args()
    report = validate(json.loads(args.catalog.read_text()), args.sections, args.pages, args.section, args.allow_partial)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value if key != 'errors' else len(value) for key, value in report.items()}, ensure_ascii=False))
    if report['errors']:
        for item in report['errors'][:30]:
            print(f'{item["code"]}: {item["id"]}: {item["detail"]}')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
