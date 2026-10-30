import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amenorrheaDecisions } from '../../app/src/learning/decisions';
import { practiceMeta, progressRows, topicErrors } from '../../app/src/learning/model';
import { emptyState, recordPractice, validateState } from '../../app/src/coach/engine';

test('amenorrhea paths reach every named cause through separate decisions', () => {
  const questions = amenorrheaDecisions();
  assert.ok(questions.length > 60);
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  for (const cause of ['turner','mrkh','cais','imperforate-hymen','transverse-septum','kallmann','functional-hypothalamic','swyer','pregnancy','pcos','poi','hyperprolactinemia','thyroid','asherman','sheehan','secondary-functional-hypothalamic']) {
    const path = questions.filter(q => q.path_id === cause);
    assert.ok(path.length >= 4, cause);
    assert.match(path[0].prompt, /menstruado/);
    assert.ok(!path[0].context.includes('46,XY'));
    assert.ok(path.every((q,i) => q.step === i+1 && q.steps === path.length && practiceMeta(q.id)));
    assert.ok(path.every(q => q.sources.some(s => s.url?.startsWith('https://'))));
  }
  const mrkh = questions.filter(q => q.path_id === 'mrkh');
  assert.ok(mrkh.some(q => /útero/.test(q.prompt)));
  assert.ok(mrkh.some(q => /testosterona|cariotipo/.test(q.answer)));
});

test('decision memory survives snapshots and stays separate from original coverage', () => {
  const question = amenorrheaDecisions()[0];
  const meta = practiceMeta(question.id)!;
  const state = recordPractice(emptyState(),meta,1,12,'2026-10-29','decision-1');
  const loaded = validateState(JSON.parse(JSON.stringify(state)));
  assert.ok(loaded);
  const row = progressRows(state,{schema_version:1,content_sha256:'test',cards:[]},'2026-10-29').sections[0];
  assert.equal(row.practiced,0);
  assert.equal(row.decision_practiced,1);
  assert.equal(row.errors,1);
  assert.equal(topicErrors(state,{schema_version:1,content_sha256:'test',cards:[]})[0].id,`decision:${question.topic_id}:${question.node_id}`);
});
