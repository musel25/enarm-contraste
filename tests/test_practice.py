import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest
import tempfile

ROOT = Path(__file__).resolve().parents[1]


class PracticeTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('practice', ROOT / 'scripts/build_practice.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.source = json.loads((ROOT / 'content/sections/01.json').read_text())
        self.topic = self.source['blocks'][0]['topics'][0]
        self.source['blocks'] = [dict(self.source['blocks'][0], topics=[self.topic])]
        variant = lambda text: dict(vignette=text, discriminator=self.topic['key_discriminator'], explanation=self.topic['mechanism'], confusable_with='Otro problema', why_not=self.topic['limits'], facts=[dict(field='pattern', text=self.topic['pattern'])])
        self.bank = dict(schema_version=1, section_id='01', author='author', source_sha256='source', groups=[dict(id=self.topic['id'], parent_topic_id=self.topic['id'], block_id=self.source['blocks'][0]['id'], name=self.topic['name'], answer_kind='decision', variants={k:variant(text) for k,text in zip(['easy','medium','contrast'], ['Una persona colapsa y no responde.', 'Durante una valoración se identifica respiración anormal.', 'Se debe decidir si la ausencia de respuesta requiere reanimación.'])})])
        self.review = dict(section_id='01', author='author', reviewer='other', content_sha256='bank', source_sha256='source', status='source-checked', professional_review='pending')

    def validate(self):
        self.module.validate_bank(self.source, self.bank, self.review, 'source', 'bank')

    def test_complete_reviewed_bank(self):
        self.validate()

    def test_rejects_duplicate_variants(self):
        self.bank['groups'][0]['variants']['medium']['vignette'] = self.bank['groups'][0]['variants']['easy']['vignette']
        with self.assertRaisesRegex(ValueError, 'distinct'):
            self.validate()

    def test_rejects_unsupported_fact(self):
        self.bank['groups'][0]['variants']['easy']['facts'][0]['text'] = 'invented'
        with self.assertRaisesRegex(ValueError, 'fact'):
            self.validate()

    def test_rejects_missing_topic_or_stale_self_review(self):
        self.bank['groups'] = []
        with self.assertRaisesRegex(ValueError, 'coverage'):
            self.validate()
        self.setUp()
        self.review['reviewer'] = 'author'
        with self.assertRaisesRegex(ValueError, 'review'):
            self.validate()
        self.setUp()
        self.review['content_sha256'] = 'stale'
        with self.assertRaisesRegex(ValueError, 'review'):
            self.validate()

    def test_decisions_split_each_modifier_from_initial_action(self):
        steps = self.module.decision_steps(self.source)
        self.assertGreaterEqual(len(steps), 4)
        initial = next(s for s in steps if s['node_id'] == 'initial')
        modifier = next(s for s in steps if s['node_id'] == 'modifier-1')
        self.assertEqual(initial['answer'], self.topic['initial_action'])
        self.assertNotIn(self.topic['modifiers'][0]['factor'], initial['context'])
        self.assertEqual(modifier['answer'], self.topic['modifiers'][0]['action'])
        self.assertIn(self.topic['modifiers'][0]['factor'], modifier['context'])
        self.assertIn(self.topic['name'], modifier['context'])

    def test_publishes_hash_checked_sections_without_private_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            def write(path, data):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(data))
            source_path = root / 'content/sections/01.json'
            write(source_path, self.source)
            self.bank['source_sha256'] = self.module.raw_hash(source_path)
            bank_path = root / 'content/practice/sections/01.json'
            write(bank_path,self.bank)
            self.review['source_sha256'] = self.bank['source_sha256']
            self.review['content_sha256'] = self.module.raw_hash(bank_path)
            write(root / 'content/practice/reviews/01.json',self.review)
            write(root / 'app/public/study/manifest.json',{})
            index = self.module.build(root)
            self.assertEqual(index['cases'],3)
            public = root / 'app/public/study/practice/01.json'
            self.assertEqual(index['sections'][0]['sha256'],self.module.raw_hash(public))
            generated = json.loads(public.read_text())
            self.assertNotIn('facts',generated['groups'][0]['variants']['easy'])
            self.assertTrue(all(q['id'].startswith('decision/01.01/') for q in generated['decisions']))
            manifest = json.loads((root / 'app/public/study/manifest.json').read_text())
            self.assertEqual(manifest['practice']['sha256'],self.module.raw_hash(root / 'app/public/study/practice/index.json'))

    def test_curated_amenorrhea_paths_are_in_the_published_bank(self):
        source = json.loads((ROOT / 'content/sections/14.json').read_text())
        steps = self.module.compiled_decisions(source)
        self.assertTrue(any(q['id'] == 'decision/14.01/mrkh/anatomy' for q in steps))
        self.assertTrue(any(q['id'] == 'decision/14.01/secondary-functional-hypothalamic/hormones' for q in steps))
        self.assertEqual(len(steps),len({q['id'] for q in steps}))
        generic = self.module.decision_steps(source)
        self.assertGreater(len(steps),len(generic))


if __name__ == '__main__':
    unittest.main()
