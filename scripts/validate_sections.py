"""Check inventory coverage and evidence against the complete book pages."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


def normalized(value: str) -> str:
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value)).strip().casefold()


def answer_in_text(answer: str, text: str) -> bool:
    def tokens(value: str) -> str:
        decomposed = ''.join(char for char in unicodedata.normalize('NFKD', value.casefold()) if not unicodedata.combining(char))
        return re.sub(r'[\W_]+', ' ', decomposed).strip()
    key = tokens(answer)
    return bool(key) and f' {key} ' in f' {tokens(text)} '


def book_reference_pages(topic: dict) -> list[int]:
    original = topic.get('source_pages', [])
    verified = topic.get('verified_source_pages', [])
    declared = verified if topic.get('reference_page_mode') == 'replace' else original + verified
    return sorted(set(declared + [item['page'] for item in topic.get('evidence', [])]))


def correction_notes(topic: dict) -> list[str]:
    notes = [item if isinstance(item, str) else item['reason'] for item in topic.get('source_corrections', [])]
    return list(dict.fromkeys(note.strip() for note in notes))


def validate(catalog: dict, directory: Path, pages: Path | None, selected: list[str] | None = None, allow_partial: bool = False) -> dict:
    report = {'source_text_checked': pages is not None, 'source_book_sha256': catalog.get('book', {}).get('sha256'), 'section_hashes': {}, 'verified_sections': 0, 'verified_blocks': 0, 'verified_topics': 0, 'verified_evidence': 0, 'visual_evidence': 0, 'external_sources': 0, 'missing_sections': [], 'errors': []}
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
        report['section_hashes'][sid] = hashlib.sha256(json.dumps(section, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
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
            if answer_in_text(mother.get('answer', ''), mother.get('cue', '')):
                error('answer_leak', bid, 'Answer leaked on mother front')
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
            comparison_front = ' '.join([block.get('common_problem', '')] + [topic.get('pattern', '') for topic in topics])
            for expected_topic in expected_block['topics']:
                tid = expected_topic['id']
                topic = indexed_topics.get(tid)
                if topic is None:
                    error('missing_topic', tid, bid)
                    continue
                topic_errors = len(report['errors'])
                if topic.get('name') != expected_topic['name']:
                    error('topic_name', tid, f'Expected {expected_topic["name"]}')
                if 'answer_name' in topic:
                    text_field(topic, 'answer_name', tid)
                    if topic['answer_name'] != topic['name'] and not topic.get('source_corrections'):
                        error('unexplained_answer_correction', tid, 'answer_name requires source_corrections')
                corrections = topic.get('source_corrections', [])
                if not isinstance(corrections, list) or any(not (isinstance(item, str) and item.strip() or isinstance(item, dict) and isinstance(item.get('reason'), str) and item['reason'].strip()) for item in corrections):
                    error('invalid_corrections', tid, 'Expected text or objects with a reason')
                if topic.get('source_pages') != expected_topic['source_pages'] and not topic.get('source_corrections'):
                    error('source_pages_changed', tid, 'Correction must be explicit')
                verified_pages = topic.get('verified_source_pages', [])
                if set(verified_pages) - set(expected_topic['source_pages']) and not topic.get('source_corrections'):
                    error('unexplained_page_correction', tid, 'verified_source_pages requires source_corrections')
                mode = topic.get('reference_page_mode', 'extend')
                if mode not in ('extend', 'replace'):
                    error('invalid_reference_mode', tid, str(mode))
                if mode == 'replace' and (not verified_pages or not topic.get('source_corrections')):
                    error('unexplained_reference_replacement', tid, 'Replacement requires verified pages and correction')
                declared_pages = set(verified_pages if mode == 'replace' else topic.get('source_pages', []) + verified_pages)
                for field in ('pattern', 'key_discriminator', 'mechanism', 'initial_action', 'action_reason', 'limits'):
                    text_field(topic, field, tid)
                if answer_in_text(topic.get('answer_name', topic.get('name', '')), topic.get('pattern', '')):
                    error('answer_leak', tid, 'Answer leaked on recognition front')
                if answer_in_text(topic.get('answer_name', topic.get('name', '')), comparison_front):
                    error('answer_leak', tid, 'Answer leaked on comparison front')
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
    print(json.dumps({key: (len(value) if key in ('errors', 'section_hashes') else value) for key, value in report.items()}, ensure_ascii=False))
    if report['errors']:
        for item in report['errors'][:30]:
            print(f'{item["code"]}: {item["id"]}: {item["detail"]}')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
