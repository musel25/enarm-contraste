import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
import zipfile
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
        topics = []
        for index, name in enumerate(['Diagnóstico alfa', 'Diagnóstico beta'], 1):
            topics.append({'id': f'01.01-0{index}', 'name': name, 'source_pages': [1], 'pattern': f'Una persona consulta por fiebre con hallazgo {index} después de varios días de evolución clínica.', 'key_discriminator': f'hallazgo {index}', 'mechanism': 'Una función alterada produce un cambio identificable durante el estudio.', 'findings': [{'mechanism': f'Mecanismo {index}', 'finding': f'Consecuencia {index}'}], 'initial_action': f'Acción {index}', 'action_reason': 'La acción corrige el problema.', 'modifiers': [{'factor': 'Inestabilidad', 'action': 'Escalar atención', 'reason': 'Cambia la prioridad.'}], 'limits': 'El patrón requiere contexto.', 'evidence': [{'page': 1, 'quote': 'Una frase original del libro.'}], 'source_gaps': []})
        self.section = {'id': '01', 'title': 'Ejemplo', 'blocks': [{'id': '01.01', 'title': 'Fiebre', 'common_problem': 'Dos personas consultan por fiebre.', 'mother': {'cue': 'La función circulatoria cambia.', 'answer': 'Patrón circulatorio', 'explanation': 'Explica el problema compartido.'}, 'topics': topics}]}
        self.catalog = {'book': {'filename': 'Libro.pdf', 'pages': 1, 'sha256': 'book', 'visual_review_pages': []}, 'guide': {}, 'counts': {'sections': 1, 'blocks': 1, 'topic_occurrences': 2, 'unique_topics': 2}, 'sections': [{'id': '01', 'title': 'Ejemplo', 'blocks': [{'id': '01.01', 'title': 'Fiebre', 'topics': [{'id': t['id'], 'name': t['name'], 'source_pages': [1], 'canonical_id': t['id']} for t in topics]}]}]}
        self.write_section()

    def write_section(self):
        (self.sections / '01.json').write_text(json.dumps(self.section))
        review = {'section_id': '01', 'status': 'approved', 'author': 'author_a', 'reviewer': 'reviewer_b', 'content_sha256': digest(self.section), 'topic_ids': [t['id'] for t in self.section['blocks'][0]['topics']], 'issues': [], 'pages_checked': [1], 'external_urls_checked': []}
        (self.reviews / '01.json').write_text(json.dumps(review))

    def build(self, name='build'):
        return self.module.build(self.catalog, self.sections, self.reviews, self.root / name)

    def test_two_formats_keep_corresponding_rows_and_real_anki_notes(self):
        manifest = self.build()
        self.assertEqual(manifest['counts']['eje'], 1)
        self.assertEqual(manifest['counts']['madre'], 7)
        self.assertEqual(manifest['counts']['cards'], 8)
        data = json.loads((self.root / 'build/sections/01.json').read_text())
        eje = next(c for c in data['cards'] if c['family'] == 'eje')
        self.assertEqual([row['title'] for row in eje['back']], ['Diagnóstico alfa', 'Diagnóstico beta'])
        self.assertEqual([row['highlight'] for row in eje['front']], ['hallazgo 1', 'hallazgo 2'])
        self.assertEqual([c['level'] for c in data['cards'] if c['family'] == 'madre'], [1, 2, 3, 4, 2, 3, 4])
        for family, count in [('eje', 1), ('madre', 7)]:
            with zipfile.ZipFile(self.root / f'build/enarm-{family}.apkg') as package:
                package.extract('collection.anki2', self.root / family)
            with sqlite3.connect(self.root / family / 'collection.anki2') as db:
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
            with sqlite3.connect(self.root / name / 'db/collection.anki2') as db:
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


if __name__ == '__main__':
    unittest.main()
