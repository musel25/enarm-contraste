import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
import zipfile
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class FullDeckTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('build_full_decks', ROOT / 'scripts/build_full_decks.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sections = self.root / 'sections'
        self.reviews = self.root / 'reviews'
        self.sections.mkdir()
        self.reviews.mkdir()
        (self.root / 'pages').mkdir()
        (self.root / 'pages/0001.txt').write_text('Una frase original del libro.')
        topics = []
        for index, name in enumerate(['Diagnóstico alfa', 'Diagnóstico beta'], 1):
            topics.append({'id': f'01.01-0{index}', 'name': name, 'source_pages': [1], 'pattern': f'Una persona consulta por fiebre con hallazgo {index} después de varios días de evolución clínica sin otro dato que permita establecer la causa.', 'key_discriminator': f'hallazgo {index}', 'mechanism': 'Una función alterada produce un cambio identificable durante el estudio y permite relacionar la causa con el hallazgo observado.', 'findings': [{'mechanism': f'Mecanismo {index}', 'finding': f'Consecuencia {index}'}], 'initial_action': f'Acción {index}', 'action_reason': 'La acción corrige el problema.', 'modifiers': [{'factor': 'Inestabilidad', 'action': 'Escalar atención', 'reason': 'Cambia la prioridad.'}], 'limits': 'El patrón requiere contexto.', 'evidence': [{'page': 1, 'quote': 'Una frase original del libro.'}], 'source_gaps': []})
        self.section = {'id': '01', 'title': 'Ejemplo', 'blocks': [{'id': '01.01', 'title': 'Fiebre', 'common_problem': 'Dos personas consultan por fiebre.', 'mother': {'cue': 'La función circulatoria cambia.', 'answer': 'Patrón circulatorio', 'explanation': 'Explica el problema compartido.'}, 'topics': topics}]}
        self.catalog = {'book': {'filename': 'Libro.pdf', 'pages': 1, 'sha256': 'book', 'visual_review_pages': []}, 'guide': {}, 'counts': {'sections': 1, 'blocks': 1, 'topic_occurrences': 2, 'unique_topics': 2}, 'sections': [{'id': '01', 'title': 'Ejemplo', 'blocks': [{'id': '01.01', 'title': 'Fiebre', 'topics': [{'id': t['id'], 'name': t['name'], 'source_pages': [1], 'canonical_id': t['id']} for t in topics]}]}]}
        self.write_section()

    def write_section(self):
        (self.sections / '01.json').write_text(json.dumps(self.section))
        review = {'section_id': '01', 'status': 'approved', 'author': 'author_a', 'reviewer': 'reviewer_b', 'content_sha256': digest(self.section), 'topic_ids': [t['id'] for t in self.section['blocks'][0]['topics']], 'issues': [], 'pages_checked': sorted({p for b in self.section['blocks'] for t in b['topics'] for p in t['source_pages'] + t.get('verified_source_pages', [])}), 'external_urls_checked': []}
        (self.reviews / '01.json').write_text(json.dumps(review))

    def build(self, name='build'):
        proof = self.module.validate(self.catalog, self.sections, self.root / 'pages')
        return self.module.build(self.catalog, self.sections, self.reviews, self.root / name, source_validation=proof)

    def test_planner_index_retains_all_card_ids_and_has_no_answers(self):
        manifest = self.build()
        planner = manifest['planner']
        path = self.root / 'build' / planner['url']
        index = json.loads(path.read_text())
        exported = json.loads((self.root / 'build/sections/01.json').read_text())
        self.assertEqual(index['content_sha256'], manifest['content_sha256'])
        self.assertEqual(planner['sha256'], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertEqual(planner['cards'], 8)
        self.assertEqual([c['id'] for c in index['cards']], [c['id'] for c in exported['cards']])
        for order, card in enumerate(index['cards']):
            self.assertEqual(card['order'], order)
            self.assertGreaterEqual(card['new_seconds'], 30)
            self.assertGreaterEqual(card['review_seconds'], 15)
            self.assertLess(card['review_seconds'], card['new_seconds'])
            self.assertNotIn('front', card)
            self.assertNotIn('back', card)
            self.assertNotIn('title', card)

    def test_rejects_stale_source_validation(self):
        proof = self.module.validate(self.catalog, self.sections, self.root / 'pages')
        self.section['blocks'][0]['topics'][0]['initial_action'] = 'Cambiar la acción.'
        self.write_section()
        with self.assertRaisesRegex(ValueError, 'source validation'):
            self.module.build(self.catalog, self.sections, self.reviews, self.root / 'stale', source_validation=proof)

    def test_two_formats_keep_corresponding_rows_and_real_anki_notes(self):
        manifest = self.build()
        self.assertEqual(manifest['counts']['eje'], 1)
        self.assertEqual(manifest['counts']['madre'], 7)
        self.assertEqual(manifest['counts']['cards'], 8)
        self.assertEqual(manifest['groups'], [{'id': '01.01', 'title': 'Fiebre', 'section_id': '01', 'problem': 'Dos personas consultan por fiebre.'}])
        data = json.loads((self.root / 'build/sections/01.json').read_text())
        eje = next(c for c in data['cards'] if c['family'] == 'eje')
        self.assertEqual([row['title'] for row in eje['back']], ['Diagnóstico alfa', 'Diagnóstico beta'])
        self.assertEqual([row['highlight'] for row in eje['front']], ['hallazgo 1', 'hallazgo 2'])
        self.assertEqual([row['topic_id'] for row in eje['back']], ['01.01-01', '01.01-02'])
        self.assertEqual([c['level'] for c in data['cards'] if c['family'] == 'madre'], [1, 2, 3, 4, 2, 3, 4])
        for family, count in [('eje', 1), ('madre', 7)]:
            with zipfile.ZipFile(self.root / f'build/enarm-{family}.apkg') as package:
                package.extract('collection.anki2', self.root / family)
            with closing(sqlite3.connect(self.root / family / 'collection.anki2')) as db:
                self.assertEqual(db.execute('select count(*) from notes').fetchone()[0], count)
                self.assertEqual(db.execute('select count(*) from cards').fetchone()[0], count)
                fields = [row[0].split('\x1f') for row in db.execute('select flds from notes')]
                self.assertTrue(any('Acción 1' in row[2] for row in fields))
                self.assertTrue(all('Libro.pdf' not in row[1] for row in fields))

    def test_recognition_fronts_hide_diagnoses_and_sources(self):
        self.build()
        data = json.loads((self.root / 'build/sections/01.json').read_text())
        for card in data['cards']:
            if card['level'] in [0, 1, 2]:
                front = self.module.render_front(card)
                self.assertNotIn('Diagnóstico alfa', front)
                self.assertNotIn('Diagnóstico beta', front)
                self.assertNotIn('Libro.pdf', front)

    def test_html_is_escaped_and_guid_is_stable(self):
        self.section['blocks'][0]['topics'][0]['pattern'] += ' <script>bad()</script>'
        self.write_section()
        self.build('a')
        self.build('b')
        guids = []
        for name in ['a', 'b']:
            with zipfile.ZipFile(self.root / name / 'enarm-eje.apkg') as package:
                package.extract('collection.anki2', self.root / name / 'db')
            with closing(sqlite3.connect(self.root / name / 'db/collection.anki2')) as db:
                guid, fields = db.execute('select guid, flds from notes').fetchone()
                guids.append(guid)
                self.assertNotIn('<script>', fields)
                self.assertIn('&lt;script&gt;', fields)
        self.assertEqual(guids[0], guids[1])

    def test_missing_topic_rejected(self):
        self.section['blocks'][0]['topics'].pop()
        self.write_section()
        with self.assertRaisesRegex(ValueError, 'coverage'):
            self.build()

    def test_stale_review_rejected(self):
        self.section['blocks'][0]['topics'][0]['initial_action'] = 'Otra acción'
        (self.sections / '01.json').write_text(json.dumps(self.section))
        with self.assertRaisesRegex(ValueError, 'review'):
            self.build()

    def test_self_review_rejected(self):
        path = self.reviews / '01.json'
        review = json.loads(path.read_text())
        review['reviewer'] = review['author']
        path.write_text(json.dumps(review))
        with self.assertRaisesRegex(ValueError, 'review'):
            self.build()

    def test_rejects_missing_source_validation(self):
        with self.assertRaisesRegex(ValueError, 'source validation'):
            self.module.build(self.catalog, self.sections, self.reviews, self.root / 'unverified')

    def audit(self):
        spec = importlib.util.spec_from_file_location('verify_full_library', ROOT / 'scripts/verify_full_library.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.audit(self.catalog, self.sections, self.root / 'build')

    def test_audit_checks_real_packages_and_all_row_correspondences(self):
        self.build()
        report = self.audit()
        self.assertEqual(report['cards'], 8)
        self.assertEqual(report['anki_notes'], 8)
        self.assertEqual(report['topic_occurrences'], 2)

    def test_audit_rejects_swapped_answers(self):
        self.build()
        path = self.root / 'build/sections/01.json'
        data = json.loads(path.read_text())
        data['cards'][0]['back'].reverse()
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'correspondence'):
            self.audit()

    def test_rejects_answer_name_in_mother_front(self):
        self.section['blocks'][0]['mother']['cue'] = 'El caso presenta un Patrón circulatorio.'
        self.write_section()
        with self.assertRaisesRegex(ValueError, 'Answer leaked'):
            self.build()

    def test_audit_rejects_swapped_action_reasons(self):
        self.build()
        path = self.root / 'build/sections/01.json'
        data = json.loads(path.read_text())
        card = next(c for c in data['cards'] if c['id'] == 'madre/4/01.01-01')
        card['back'][0]['reason'], card['back'][1]['reason'] = card['back'][1]['reason'], card['back'][0]['reason']
        path.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'correspondence'):
            self.audit()

    def test_uses_corrected_clinical_name_without_losing_inventory_identity(self):
        topic = self.section['blocks'][0]['topics'][0]
        topic['answer_name'] = 'Diagnóstico corregido'
        topic['source_corrections'] = ['La guía usa un título incorrecto.']
        self.write_section()
        self.build()
        data = json.loads((self.root / 'build/sections/01.json').read_text())
        eje = next(c for c in data['cards'] if c['family'] == 'eje')
        self.assertEqual(eje['back'][0]['title'], 'Diagnóstico corregido')
        self.assertEqual(eje['back'][0]['topic_id'], '01.01-01')
        recognition = next(c for c in data['cards'] if c['id'] == 'madre/2/01.01-01')
        self.assertEqual(recognition['back'][0]['title'], 'Diagnóstico corregido')
        self.assertEqual(self.audit()['cards'], 8)

    def test_rejects_accent_and_punctuation_variants_of_answer_on_front(self):
        self.section['blocks'][0]['topics'][0]['pattern'] += ' Es un diagnostico-alfa.'
        self.write_section()
        with self.assertRaisesRegex(ValueError, 'Answer leaked'):
            self.build()

    def test_exports_complete_topic_reference_ranges(self):
        self.section['blocks'][0]['topics'][0]['source_pages'] = [1, 2, 3]
        self.catalog['sections'][0]['blocks'][0]['topics'][0]['source_pages'] = [1, 2, 3]
        self.catalog['book']['pages'] = 3
        self.write_section()
        self.build()
        data = json.loads((self.root / 'build/sections/01.json').read_text())
        self.assertEqual(data['cards'][0]['back'][0]['sources'][0]['pages'], [1, 2, 3])

    def test_distinguishes_replaced_pages_from_added_support(self):
        self.catalog['book']['pages'] = 3
        first, second = self.section['blocks'][0]['topics']
        first.update(verified_source_pages=[2], reference_page_mode='replace', source_corrections=['La página 2 reemplaza la referencia errónea.'])
        first['evidence'][0]['page'] = 2
        (self.root / 'pages/0002.txt').write_text('Una frase original del libro.')
        second.update(verified_source_pages=[3], reference_page_mode='extend', source_corrections=['La página 3 complementa la referencia original.'])
        self.write_section()
        self.build()
        data = json.loads((self.root / 'build/sections/01.json').read_text())
        rows = data['cards'][0]['back']
        self.assertEqual(rows[0]['sources'][0]['pages'], [2])
        self.assertEqual(rows[1]['sources'][0]['pages'], [1, 3])

    def test_preserves_source_corrections_on_backs_and_each_comparison_row(self):
        notes = ['El libro usa un umbral antiguo.', 'La guía omite un factor.']
        self.section['blocks'][0]['topics'][0]['source_corrections'] = [notes[0], {'reason': notes[1]}]
        self.write_section()
        self.build()
        data = json.loads((self.root / 'build/sections/01.json').read_text())
        eje = data['cards'][0]
        self.assertEqual(eje['back'][0]['corrections'], notes)
        action = next(c for c in data['cards'] if c['id'] == 'madre/4/01.01-01')
        self.assertEqual(action['corrections'], notes)
        for card in [eje, action]:
            self.assertIn(notes[0], self.module.render_back(card))
            self.assertNotIn(notes[0], self.module.render_front(card))

    def test_audit_preserves_inline_punctuation_after_highlights(self):
        self.section['blocks'][0]['topics'][0]['pattern'] = 'Una persona consulta por fiebre después de varios días de evolución clínica y en el estudio inicial aparece un hallazgo 1.'
        self.write_section()
        self.build()
        self.assertEqual(self.audit()['cards'], 8)

    def test_rejects_answer_in_another_comparison_case(self):
        self.section['blocks'][0]['topics'][1]['pattern'] += ' Se sospecha diagnostico-alfa.'
        self.write_section()
        with self.assertRaisesRegex(ValueError, 'comparison front'):
            self.build()

    def test_rejects_answer_in_shared_comparison_context(self):
        self.section['blocks'][0]['common_problem'] = 'El grupo estudia el diagnostico alfa.'
        self.write_section()
        with self.assertRaisesRegex(ValueError, 'comparison front'):
            self.build()


if __name__ == '__main__':
    unittest.main()
