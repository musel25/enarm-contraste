import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, undoReview, validateState } from '../../app/src/coach/engine';
import { recordPractice } from '../../app/src/coach/engine';
import { completionNotices, progressRows, topicErrors } from '../../app/src/learning/model';
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
