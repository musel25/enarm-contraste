import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, undoReview, validateState } from '../../app/src/coach/engine';
import { recordPractice } from '../../app/src/coach/engine';
import { caseMeta, completionNotices, progressRows, topicErrors } from '../../app/src/learning/model';
import type { CoachIndex } from '../../app/src/coach/types';

const day = '2026-10-29';
const index: CoachIndex = { schema_version: 1, content_sha256: 'test', cards: [
  { id: 'eje/14.01', section_id: '14', block_id: '14.01', family: 'eje', level: 0, order: 0, new_seconds: 120, review_seconds: 40 },
  { id: 'madre/2/14.01-01', section_id: '14', block_id: '14.01', family: 'madre', level: 2, order: 1, new_seconds: 60, review_seconds: 20 },
] };

test('practice saves valid FSRS state without a daily plan and undo restores exposure', () => {
  const state = recordPractice(emptyState(), index.cards[0], 1, 24, day, 'first');
  assert.ok(validateState(state));
  assert.equal(state.plan, null);
  assert.equal(state.progress[index.cards[0].id].due_day, '2026-10-30');
  assert.equal(state.history[0].rating, 1);
  assert.deepEqual(undoReview(state).progress, {});
  assert.ok(validateState(undoReview(state)));
});

test('repetition counts attempts once per response and exposure once per card', () => {
  let state = recordPractice(emptyState(), index.cards[0], 1, 20, day, 'first');
  state = recordPractice(state, index.cards[0], 3, 8, day, 'second');
  assert.ok(validateState(state));
  assert.equal(recordPractice(state, index.cards[0], 3, 8, day, 'second'), state);
  const row = progressRows(state, index, day).sections[0];
  assert.equal(row.practiced, 1);
  assert.equal(row.remaining, 1);
  assert.equal(row.attempts, 2);
  assert.equal(row.errors, 1);
  assert.equal(row.started, day);
  assert.equal(row.next_due, state.progress[index.cards[0].id].due_day);
});

test('block and section notices require all cards and return after undo and a new answer', () => {
  const first = recordPractice(emptyState(), index.cards[0], 3, 20, day, 'first');
  const second = recordPractice(first, index.cards[1], 3, 20, day, 'second');
  assert.deepEqual(completionNotices(emptyState(), first, index), []);
  assert.deepEqual(completionNotices(first, second, index), [
    { kind: 'block', id: '14.01' }, { kind: 'section', id: '14' },
  ]);
  assert.deepEqual(completionNotices(second, second, index), []);
  assert.equal(progressRows(undoReview(second), index, day).sections[0].remaining, 1);
});

test('clinical results are separate from library coverage and errors have precise topic IDs', () => {
  let state = recordPractice(emptyState(), index.cards[0], 1, 20, day, 'multi');
  state = recordPractice(state, { ...index.cards[0], id: 'clinical/14.01/turner/easy' }, 1, 20, day, 'diagnosis');
  state = recordPractice(state, index.cards[1], 2, 20, day, 'hard');
  const row = progressRows(state, index, day).sections[0];
  assert.equal(row.practiced, 2);
  assert.equal(row.clinical_practiced, 1);
  assert.equal(row.errors, 2);
  assert.equal(row.difficult, 1);
  assert.deepEqual(topicErrors(state, index).map(t => [t.id, t.errors]), [['block:14.01', 1], ['turner', 1]]);
});

test('practice rejects future-dated reviews and invalid elapsed time', () => {
  const state = recordPractice(emptyState(), index.cards[0], 3, 20, day, 'first');
  assert.throws(() => recordPractice(state, index.cards[0], 3, 1, '2026-10-28', 'old'));
  assert.throws(() => recordPractice(state, index.cards[0], 3, NaN, day, 'bad'));
});

import { clinicalCases } from '../../app/src/learning/cases';
import type { StudySection } from '../../app/src/library-types';
const clinicalSection: StudySection = { id: '14', title: 'Ginecología', blocks: [{ id: '14.01', title: 'Amenorreas', topics: 1 }], cards: [
  { id: 'eje/14.01', family: 'eje', level: 0, section_id: '14', block_id: '14.01', prompt: 'Diagnóstico', context: 'Amenorrea',
    front: [{ text: 'Nunca ha menstruado.', highlight: 'Nunca' }], back: [{ title: 'Amenorrea primaria', text: 'Mecanismo.', topic_id: '14.01-01', discriminator: 'Nunca' }], sources: [{ label: 'Libro' }] },
] };
test('primary amenorrhea adds eight diagnoses with three distinct source-linked cases each', () => {
  const cases = clinicalCases(clinicalSection);
  const expanded = cases.filter(c => c.expanded);
  assert.equal(expanded.length, 24);
  assert.equal(new Set(expanded.map(c => c.id)).size, 24);
  const diagnoses = new Set(expanded.map(c => c.topic_id));
  assert.equal(diagnoses.size, 8);
  for (const diagnosis of diagnoses) {
    const variants = expanded.filter(c => c.topic_id === diagnosis);
    assert.deepEqual(variants.map(c => c.difficulty), ['easy', 'medium', 'contrast']);
    assert.equal(new Set(variants.map(c => c.vignette)).size, 3);
    for (const item of variants) {
      assert.ok(item.sources.some(source => source.url?.startsWith('https://')));
      assert.ok(item.discriminator && item.explanation);
      assert.ok(item.options.includes(item.diagnosis));
      assert.ok(caseMeta(item.id));
    }
  }
});
test('every Eje case supports three difficulty modes without losing original facts', () => {
  const section = { ...clinicalSection, id: '01', cards: clinicalSection.cards.map(c => ({ ...c, section_id: '01', block_id: '01.01' })) };
  const cases = clinicalCases(section);
  assert.equal(cases.length, 3);
  assert.ok(cases.every(c => c.vignette === section.cards[0].front[0].text));
  assert.ok(cases.every(c => !c.expanded));
});

test('reviewed supplemental cases replace duplicated source vignettes and preserve IDs', () => {
  const variants = Object.fromEntries(['easy','medium','contrast'].map((difficulty,i) => [difficulty,{vignette:`Caso distinto ${i}`, discriminator:'Dato decisivo', explanation:'Mecanismo', confusable_with:'Otra causa',why_not:'Un dato la distingue'}]));
  const bank = {schema_version:1,section_id:'14',groups:[{id:'14.01-01',parent_topic_id:'14.01-01',block_id:'14.01',name:'Amenorrea primaria',answer_kind:'diagnosis',variants,sources:[{label:'Libro'}]}],decisions:[]} as any;
  const cases = clinicalCases(clinicalSection,bank);
  assert.equal(cases.length,3);
  assert.equal(new Set(cases.map(c => c.vignette)).size,3);
  assert.equal(cases[0].id,'clinical/14.01/14.01-01/easy');
  assert.ok(cases.every(c => c.expanded));
});

import { supplementalNotices } from '../../app/src/learning/model';
test('supplemental block milestones need every case and do not change course totals', () => {
  const items=['a','b'].map(id=>({id:`clinical/14.01/${id}/easy`,section_id:'14',block_id:'14.01'}));
  const before=recordPractice(emptyState(),caseMeta(items[0].id)!,3,5,day,'a');
  assert.deepEqual(supplementalNotices(emptyState(),before,items),[]);
  const after=recordPractice(before,caseMeta(items[1].id)!,3,5,day,'b');
  assert.deepEqual(supplementalNotices(before,after,items),[{kind:'block',id:'14.01'},{kind:'section',id:'14'}]);
  assert.equal(progressRows(after,index,day).sections[0].practiced,0);
});
