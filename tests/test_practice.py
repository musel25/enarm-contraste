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
        variant = lambda text: dict(vignette=text, discriminator=self.topic['key_discriminator'], explanation=self.topic['mechanism'], confusable_with='Otro problema', why_not=self.topic['limits'], distractors=[], facts=[dict(field='pattern', text=self.topic['pattern'])])
        self.bank = dict(schema_version=1, section_id='01', author='author', source_sha256='source', groups=[dict(id=self.topic['id'], parent_topic_id=self.topic['id'], block_id=self.source['blocks'][0]['id'], name=self.topic['name'], answer_kind='decision', variants={k:variant(text) for k,text in zip(['easy','medium','contrast'], ['Una persona colapsa y no responde.', 'Durante una valoración se identifica respiración anormal.', 'Se debe decidir si la ausencia de respuesta requiere reanimación.'])})])
        self.review = dict(section_id='01', author='author', reviewer='other', content_sha256='bank', source_sha256='source', status='source-checked', professional_review='pending')
        self.review['case_checks'] = {self.topic['id']:{k:dict(evidence=v['vignette'],difference=f'Contexto clínico distinto para {k}.',options_checked=True) for k,v in self.bank['groups'][0]['variants'].items()}}

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
            self.topic['source_corrections'] = [{'reason':'Aclaración vigente.'}]
            def write(path, data):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(data))
            source_path = root / 'content/sections/01.json'
            write(source_path, self.source)
            self.bank['source_sha256'] = self.module.raw_hash(source_path)
            self.bank['groups'][0]['variants']['easy']['sources'] = [{'label':'Guía adicional','url':'https://example.org/guide'}]
            self.bank['groups'][0]['variants']['easy']['source_evidence'] = [{'page':999,'quote':'Supporting text'}]
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
            self.assertEqual(generated['groups'][0]['corrections'],['Aclaración vigente.'])
            self.assertTrue(any(s.get('url') == 'https://example.org/guide' for s in generated['groups'][0]['sources']))
            self.assertIn(999,generated['groups'][0]['sources'][0]['pages'])
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

    def test_original_identity_cannot_be_reassigned_to_another_topic(self):
        other = copy.deepcopy(self.topic)
        other['id'] = '01.01-02'
        self.source['blocks'][0]['topics'].append(other)
        second = copy.deepcopy(self.bank['groups'][0])
        second['id'] = second['parent_topic_id'] = other['id']
        self.bank['groups'].append(second)
        self.bank['groups'][0]['parent_topic_id'] = other['id']
        with self.assertRaisesRegex(ValueError,'identity'):
            self.validate()

    def test_decision_corrections_are_text_not_source_objects(self):
        self.topic['source_corrections'] = [{'reason':'Aclaración vigente.'}]
        steps=self.module.decision_steps(self.source)
        self.assertTrue(steps)
        self.assertTrue(all(q['corrections']==['Aclaración vigente.'] for q in steps))

    def test_references_keep_evidence_pages_and_honor_replacements(self):
        self.topic.update(source_pages=[1,2],verified_source_pages=[3],evidence=[{'page':4,'quote':'Evidence'}])
        self.assertEqual(self.module.sources(self.topic)[0]['pages'],[1,2,3,4])
        self.topic['reference_page_mode']='replace'
        self.assertEqual(self.module.sources(self.topic)[0]['pages'],[3,4])

    def test_decision_labels_use_the_corrected_clinical_name(self):
        self.topic['answer_name']='Nombre clínico corregido'
        self.assertTrue(all(q['path_label']=='Nombre clínico corregido' for q in self.module.decision_steps(self.source)))

    def test_case_choices_must_be_explicit_and_cannot_repeat_the_answer(self):
        self.bank['groups'][0]['variants']['easy'].pop('distractors')
        with self.assertRaisesRegex(ValueError,'distractor'):
            self.validate()
        self.setUp()
        self.bank['groups'][0]['variants']['easy']['distractors']=[self.bank['groups'][0]['name']]
        with self.assertRaisesRegex(ValueError,'distractor'):
            self.validate()

    def test_every_case_needs_a_semantic_review_with_actual_distinctive_evidence(self):
        self.review.pop('case_checks')
        with self.assertRaisesRegex(ValueError,'semantic'):
            self.validate()
        self.setUp()
        self.review['case_checks'][self.topic['id']]['easy']['evidence']='No aparece en el caso.'
        with self.assertRaisesRegex(ValueError,'evidence'):
            self.validate()
        self.setUp()
        self.bank['groups'][0]['variants']['medium']['vignette']='Una persona conserva respiración anormal.'
        self.review['case_checks'][self.topic['id']]['easy']['evidence']='Una persona'
        self.review['case_checks'][self.topic['id']]['medium']['evidence']='conserva respiración anormal'
        with self.assertRaisesRegex(ValueError,'evidence'):
            self.validate()


if __name__ == '__main__':
    unittest.main()
