"""Build a source-linked inventory without generating medical claims."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def page_numbers(value: str) -> list[int]:
    numbers = []
    for part in value.split(','):
        matches = list(map(int, re.findall(r'\d+', part)))
        if not matches:
            raise ValueError(f'Invalid page reference: {value}')
        numbers.extend(range(matches[0], matches[-1] + 1) if len(matches) > 1 else matches)
    return sorted(set(numbers))


def parse_catalog(text: str) -> dict:
    sections = {}
    block_ids = set()
    active = None
    for page_number, page in enumerate(text.split('\f'), 1):
        for line in page.splitlines():
            section = re.match(r'^\s*(\d{2})\.\s+(.+?)\s*$', line)
            if section:
                sections.setdefault(section[1], {'id': section[1], 'title': section[2], 'blocks': []})
            block = re.match(r'^\s*(\d{2}\.\d{2})\s+(.+)', line)
            if block:
                if block[1] in block_ids:
                    raise ValueError(f'Duplicate block: {block[1]}')
                block_ids.add(block[1])
                if block[1][:2] not in sections:
                    raise ValueError(f'Block without section: {block[1]}')
                active = {'id': block[1], 'title': block[2].strip(), 'guide_pages': [page_number], 'compare': '', 'topics': [], 'source_review_required': False}
                sections[block[1][:2]]['blocks'].append(active)
            elif active and line.strip().startswith('Comparar:'):
                active['compare'] = line.strip()[9:].strip()
            elif active and line.strip().startswith('RESPUESTA:'):
                response = re.match(r'^RESPUESTA:\s*(.*?)\s*\(p\.\s*(.*?)\)\s*$', line.strip())
                if not response:
                    raise ValueError(f'Cannot parse response at guide page {page_number}: {line.strip()}')
                name, reference = response.groups()
                pages = page_numbers(reference)
                identity = name + '|' + ','.join(map(str, pages))
                active['topics'].append({'id': f'{active["id"]}-{len(active["topics"]) + 1:02}', 'canonical_id': hashlib.sha256(identity.encode()).hexdigest()[:16], 'name': name, 'source_pages': pages, 'source_ref': reference})
                if page_number not in active['guide_pages']:
                    active['guide_pages'].append(page_number)
    blocks = [block for section in sections.values() for block in section['blocks']]
    topics = [topic for block in blocks for topic in block['topics']]
    for block in blocks:
        block['source_review_required'] = not bool(block['topics'])
    return {'schema_version': 1, 'counts': {'sections': len(sections), 'blocks': len(blocks), 'topic_occurrences': len(topics), 'unique_topics': len({topic['canonical_id'] for topic in topics})}, 'sections': list(sections.values())}


def pdf_metadata(path: Path) -> dict:
    info = subprocess.check_output(['pdfinfo', str(path)], text=True)
    pages = int(re.search(r'^Pages:\s*(\d+)', info, re.M)[1])
    digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
    return {'filename': path.name, 'pages': pages, 'sha256': digest}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--guide', type=Path)
    source.add_argument('--guide-text', type=Path)
    parser.add_argument('--book', type=Path)
    parser.add_argument('--book-text', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    text = args.guide_text.read_text() if args.guide_text else subprocess.check_output(['pdftotext', '-layout', str(args.guide), '-'], text=True)
    data = parse_catalog(text)
    if args.guide:
        data['guide'] = pdf_metadata(args.guide)
    if args.book:
        data['book'] = pdf_metadata(args.book)
        if args.book_text:
            pages = args.book_text.read_text().split('\f')
            if not pages[-1].strip():
                pages.pop()
            if len(pages) != data['book']['pages']:
                raise ValueError('Extracted page count does not match the complete PDF')
            data['book']['visual_review_pages'] = [i for i, page in enumerate(pages, 1) if len(page.strip()) < 80]
        for section in data['sections']:
            for block in section['blocks']:
                for topic in block['topics']:
                    if not all(1 <= page <= data['book']['pages'] for page in topic['source_pages']):
                        raise ValueError(f'Page outside book: {topic["id"]}')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(data['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
