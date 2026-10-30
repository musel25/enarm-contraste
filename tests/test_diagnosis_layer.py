"""Regression cases for the named diseases that had become management prompts."""
import json
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
REQUIRED_DIAGNOSES=[
    '10.01-01','10.01-02','10.07-01','16.01-01','18.12-01','18.12-02',
    '20.03-01','23.04-02','23.04-04','24.06-02','24.08-02','25.05-01',
    '25.05-02','25.06-03','31.02-01','31.06-03','31.09-01',
]

class DiagnosisLayerTests(unittest.TestCase):
    def test_named_conditions_ask_for_diagnosis_before_management(self):
        banks={sid:json.loads((ROOT/f'content/practice/sections/{sid}.json').read_text()) for sid in {tid[:2] for tid in REQUIRED_DIAGNOSES}}
        for topic in REQUIRED_DIAGNOSES:
            with self.subTest(topic=topic):
                group=next(g for g in banks[topic[:2]]['groups'] if g['id']==topic)
                self.assertEqual(group['answer_kind'],'diagnosis')
                self.assertIsNone(re.match(r'^(evaluar|tratar|investigar|descartar|revisar|confirmar|seleccionar|priorizar|dar|valorar|estabilizar)\b',group['name'],re.I))
                self.assertEqual(set(group['variants']),{'easy','medium','contrast'})
