import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class CatalogTests(unittest.TestCase):
    def run_catalog(self, text):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        source = Path(temporary.name) / 'guide.txt'
        output = Path(temporary.name) / 'catalog.json'
        source.write_text(text, encoding='utf-8')
        result = subprocess.run(['uv', 'run', 'python', 'scripts/catalog_pdf.py', '--guide-text', str(source), '--output', str(output)], cwd=ROOT, capture_output=True, text=True)
        return result, output

    def test_preserves_repeated_topics_and_page_continuations(self):
        result, output = self.run_catalog('01. Sección uno\n01.01 Problema compartido\nComparar: A vs B\nRESPUESTA: Tema A (p. 1-2)\n\fRESPUESTA: Tema B (p. 3)\n01.02 Otro contexto\nRESPUESTA: Tema A (p. 1-2)\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(output.read_text())
        self.assertEqual(data['counts'], {'sections': 1, 'blocks': 2, 'topic_occurrences': 3, 'unique_topics': 2})
        self.assertEqual(data['sections'][0]['blocks'][0]['guide_pages'], [1, 2])
        self.assertEqual(data['sections'][0]['blocks'][0]['topics'][0]['source_pages'], [1, 2])
        self.assertEqual(data['sections'][0]['blocks'][1]['topics'][0]['id'], '01.02-01')

    def test_rejects_duplicate_block_identifiers(self):
        result, _ = self.run_catalog('01. Uno\n01.01 A\nRESPUESTA: Tema (p. 1)\n01.01 B\nRESPUESTA: Otro (p. 2)\n')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('duplicate block', result.stderr.lower())

    def test_keeps_a_block_that_needs_source_review(self):
        result, output = self.run_catalog('01. Uno\n01.01 Sin respuesta extraída\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        block = json.loads(output.read_text())['sections'][0]['blocks'][0]
        self.assertEqual(block['topics'], [])
        self.assertTrue(block['source_review_required'])


if __name__ == '__main__':
    unittest.main()
