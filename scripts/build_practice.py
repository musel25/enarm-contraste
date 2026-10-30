"""Audit independently reviewed supplemental cases and publish source-based decision steps."""
from __future__ import annotations
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / 'scripts'))
from validate_sections import book_reference_pages, correction_notes
DIFFICULTIES = ('easy', 'medium', 'contrast')

def require(ok, message):
    if not ok:
        raise ValueError(message)

def raw_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def field_value(topic, path):
    value = topic
    try:
        for part in path.split('.'):
            value = value[int(part)] if isinstance(value, list) else value[part]
        return value
    except (KeyError, IndexError, ValueError, TypeError):
        return None

def normalize(text):
    return re.sub(r'\W+', ' ', text.casefold()).strip()

def validate_bank(source, bank, review, source_hash, bank_hash):
    sid = source['id']
    require(bank.get('schema_version') == 1 and bank.get('section_id') == sid and bank.get('source_sha256') == source_hash, f'{sid}: stale source')
    topics = {t['id']: (b['id'], t) for b in source['blocks'] for t in b['topics']}
    groups = bank.get('groups', [])
    ids = [g['id'] for g in groups]
    require(len(ids) == len(set(ids)) and set(topics) <= set(ids), f'{sid}: incomplete/duplicate coverage')
    require(review.get('section_id') == sid and review.get('author') == bank.get('author') and review.get('reviewer') and review['reviewer'] != bank.get('author') and review.get('content_sha256') == bank_hash and review.get('source_sha256') == source_hash and review.get('status') == 'source-checked' and review.get('professional_review') == 'pending', f'{sid}: missing/stale independent review')
    for group in groups:
        label = f'{sid}/{group["id"]}'
        require(group.get('parent_topic_id') in topics, label + ': unknown parent')
        require(group['id'] not in topics or group['id'] == group['parent_topic_id'], label + ': original identity reassigned')
        require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*',group['id']), label + ': invalid identity')
        block, topic = topics[group['parent_topic_id']]
        require(group.get('block_id') == block and group.get('answer_kind') in ('diagnosis', 'decision') and group.get('name'), label + ': invalid group')
        variants = group.get('variants', {})
        require(set(variants) == set(DIFFICULTIES), label + ': missing difficulty')
        require(len({normalize(v.get('vignette', '')) for v in variants.values()}) == 3, label + ': variants must be distinct')
        for key, variant in variants.items():
            require(all(isinstance(variant.get(f), str) and variant[f].strip() for f in ('vignette','discriminator','explanation','confusable_with','why_not')), label + '/' + key + ': missing content')
            facts = variant.get('facts', [])
            require(facts and all(isinstance(f.get('text'), str) and f['text'] and field_value(topic, f.get('field','')) == f['text'] for f in facts), label + ': unsupported source fact')
            if group['answer_kind'] == 'diagnosis':
                require(normalize(group['name']) not in normalize(variant['vignette']), label + ': answer visible in vignette')

def sources(topic):
    result = [{'label':'Edwino.pdf', 'pages':book_reference_pages(topic)}]
    result += [{k:s[k] for k in ('label','url')} for s in topic.get('external_sources', [])]
    return result

def practice_sources(topic, group):
    result = sources(topic)
    known = {s.get('url',s['label']) for s in result}
    annotations = [group,*group['variants'].values()]
    pages = set(result[0]['pages'])
    for annotation in annotations:
        for evidence in annotation.get('source_evidence', []):
            if isinstance(evidence.get('page'), int) and evidence['page'] > 0:
                pages.add(evidence['page'])
        for source in annotation.get('sources', []):
            key = source.get('url',source['label'])
            if key not in known:
                require(not source.get('url') or source['url'].startswith('https://'), 'Invalid practice source URL')
                result.append({k:source[k] for k in ('label','url','pages') if k in source})
                known.add(key)
    result[0]['pages'] = sorted(pages)
    return result


def decision_steps(section):
    result = []
    for block in section['blocks']:
        for topic in block['topics']:
            common = dict(section_id=section['id'], block_id=block['id'], topic_id=topic['id'], path_id=topic['id'], path_label=topic.get('answer_name',topic['name']), sources=sources(topic), corrections=correction_notes(topic))
            steps = [
                ('discriminator', '¿Qué dato cambia la dirección del diagnóstico?', topic['pattern'], topic['key_discriminator'], topic['limits']),
                ('mechanism', '¿Dónde falla el sistema y qué produce ese fallo?', topic['pattern'], topic['mechanism'], ' '.join(f'{f["mechanism"]}: {f["finding"]}.' for f in topic['findings'])),
                ('initial', '¿Qué haces primero en esta situación?', topic['pattern'], topic['initial_action'], topic['action_reason']),
            ]
            steps += [(f'modifier-{i+1}', 'Este dato cambia. ¿Cómo cambia tu decisión?', 'Problema evaluado: ' + topic.get('answer_name', topic['name']) + '.\nSituación modificada: ' + m['factor'], m['action'], m['reason']) for i,m in enumerate(topic['modifiers'])]
            for position,(node,prompt,context,answer,explanation) in enumerate(steps):
                result.append({**common,'id':f'decision/{block["id"]}/{topic["id"]}/{node}', 'node_id':node,'step':position+1,'steps':len(steps),'prompt':prompt,'context':context,'answer':answer,'explanation':explanation,'discriminator':topic['key_discriminator'],'options':[]})
    return result

def compiled_decisions(section):
    generic = decision_steps(section)
    if section['id'] != '14':
        return generic
    module = (ROOT / 'app/src/learning/decisions.ts').as_uri()
    code = 'const mod = await import(process.argv[1]); process.stdout.write(JSON.stringify(mod.amenorrheaDecisions()));'
    result = subprocess.run(['node','--import','tsx','--input-type=module','-e',code,module], cwd=ROOT, check=True, capture_output=True, text=True)
    curated = json.loads(result.stdout)
    all_steps = curated + generic
    require(len({step['id'] for step in all_steps}) == len(all_steps), 'Duplicate decision identity')
    return all_steps


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def build(root=ROOT):
    output = root / 'app/public/study/practice'
    section_index = []
    total_groups = total_decisions = 0
    for path in sorted((root / 'content/sections').glob('*.json')):
        source = json.loads(path.read_text())
        bank_path = root / 'content/practice/sections' / path.name
        review_path = root / 'content/practice/reviews' / path.name
        require(bank_path.exists() and review_path.exists(), f'{path.stem}: missing practice/review')
        bank = json.loads(bank_path.read_text())
        validate_bank(source, bank, json.loads(review_path.read_text()), raw_hash(path), raw_hash(bank_path))
        topic_map = {t['id']:t for b in source['blocks'] for t in b['topics']}
        groups = [{**{key:g[key] for key in ('id','parent_topic_id','block_id','name','answer_kind')}, 'variants':{difficulty:{key:value[key] for key in ('vignette','discriminator','explanation','confusable_with','why_not')} for difficulty,value in g['variants'].items()}, 'sources':practice_sources(topic_map[g['parent_topic_id']],g), 'corrections':correction_notes(topic_map[g['parent_topic_id']])} for g in bank['groups']]
        data = dict(schema_version=1,section_id=source['id'],groups=groups,decisions=compiled_decisions(source),professional_review='pending')
        target = output / f'{source["id"]}.json'
        write_json(target, data)
        section_index.append(dict(id=source['id'],sha256=raw_hash(target),groups=len(groups),cases=len(groups)*3,decisions=len(data['decisions'])))
        total_groups += len(groups)
        total_decisions += len(data['decisions'])
    index = dict(schema_version=1,sections=section_index,groups=total_groups,cases=total_groups*3,decisions=total_decisions)
    write_json(output / 'index.json', index)
    manifest_path = root / 'app/public/study/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['practice'] = dict(url='practice/index.json',sha256=raw_hash(output/'index.json'),cases=index['cases'],decisions=total_decisions)
    write_json(manifest_path, manifest)
    print(json.dumps({k:index[k] for k in ('groups','cases','decisions')}))
    return index

if __name__ == '__main__':
    build()
