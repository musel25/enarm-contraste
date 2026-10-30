import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SectionTests(unittest.TestCase):
    def validate(self, mutate=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'sections').mkdir()
            (root / 'pages').mkdir()
            (root / 'pages' / '0001.txt').write_text('La fuente describe el hallazgo alfa. La primera acción es comprobar beta.')
            topic = {'id': '01.01-01', 'name': 'Tema A', 'source_pages': [1], 'pattern': 'Una persona tiene un hallazgo alfa en el estudio inicial después de varios días de evolución sin otro dato que oriente la causa.', 'key_discriminator': 'hallazgo alfa', 'mechanism': 'Una función está alterada y produce cambios clínicos que permiten orientar el problema durante la evaluación inicial.', 'findings': [{'mechanism': 'Una alteración', 'finding': 'Un hallazgo'}], 'initial_action': 'Comprobar beta.', 'action_reason': 'Permite orientar el caso.', 'modifiers': [{'factor': 'Cambia un dato', 'action': 'Cambia una decisión', 'reason': 'Cambia la prioridad'}], 'limits': 'Es un ejemplo didáctico.', 'evidence': [{'page': 1, 'quote': 'La fuente describe el hallazgo alfa.'}, {'page': 1, 'quote': 'La primera acción es comprobar beta.'}], 'source_gaps': []}
            section = {'id': '01', 'title': 'Sección', 'blocks': [{'id': '01.01', 'title': 'Problema', 'common_problem': 'Un problema compartido.', 'mother': {'cue': 'Una pista funcional.', 'answer': 'Un patrón.', 'explanation': 'Una relación causal.'}, 'topics': [topic]}]}
            catalog = {'book': {'pages': 1, 'visual_review_pages': []}, 'sections': [{'id': '01', 'title': 'Sección', 'blocks': [{'id': '01.01', 'topics': [{'id': '01.01-01', 'name': 'Tema A', 'source_pages': [1]}]}]}]}
            if mutate:
                mutate(section)
            (root / 'catalog.json').write_text(json.dumps(catalog))
            (root / 'sections' / '01.json').write_text(json.dumps(section))
            report = root / 'report.json'
            result = subprocess.run(['uv', 'run', 'python', 'scripts/validate_sections.py', '--catalog', str(root / 'catalog.json'), '--sections', str(root / 'sections'), '--pages', str(root / 'pages'), '--report', str(report)], cwd=ROOT, capture_output=True, text=True)
            return result, json.loads(report.read_text()) if report.exists() else {}

    def test_accepts_complete_source_linked_content(self):
        result, report = self.validate()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(report['verified_topics'], 1)
        self.assertEqual(report['verified_evidence'], 2)

    def test_rejects_a_missing_topic(self):
        result, report = self.validate(lambda section: section['blocks'][0].update(topics=[]))
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(any(error['code'] == 'missing_topic' for error in report.get('errors', [])))

    def test_rejects_a_quote_not_found_on_its_page(self):
        result, report = self.validate(lambda section: section['blocks'][0]['topics'][0]['evidence'][0].update(quote='Este texto no existe en la página.'))
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(any(error['code'] == 'evidence_not_found' for error in report.get('errors', [])))

    def test_rejects_a_discriminator_not_present_in_the_vignette(self):
        result, report = self.validate(lambda section: section['blocks'][0]['topics'][0].update(key_discriminator='Una pista inventada'))
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(any(error['code'] == 'discriminator_not_in_pattern' for error in report.get('errors', [])))

    def test_rejects_evidence_outside_the_declared_reference(self):
        result, report = self.validate(lambda section: section['blocks'][0]['topics'][0].update(source_pages=[], source_corrections=['Wrong guide reference']))
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(any(error['code'] == 'unreferenced_evidence_page' for error in report.get('errors', [])))

    def test_accepts_an_explicitly_corrected_reference(self):
        result, report = self.validate(lambda section: section['blocks'][0]['topics'][0].update(source_pages=[], source_corrections=['Wrong guide reference'], verified_source_pages=[1]))
        self.assertEqual(result.returncode, 0, str(report))

    def test_rejects_an_overlong_vignette(self):
        result, report = self.validate(lambda section: section['blocks'][0]['topics'][0].update(pattern='hallazgo alfa ' + 'caso ' * 60))
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(any(error['code'] == 'word_count' for error in report.get('errors', [])))


if __name__ == '__main__':
    unittest.main()
