import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, addExtra, createAssignment, dayDiff, dayKey, emptyState, estimatePlan,
  importLegacy, recordReview, selectedCards, summary, undoReview, validateState } from '../../app/src/coach/engine';
import type { CoachCard, CoachIndex, CoachState, StudyPlan } from '../../app/src/coach/types';

const day = '2026-10-29';
function card(id: string, order: number, seconds = 120, review = 60): CoachCard {
  return { id, order, section_id: 's1', block_id: 'b1', family: 'eje', level: 1,
    new_seconds: seconds, review_seconds: review };
}
function index(cards = [card('a', 1), card('b', 2), card('c', 3)]): CoachIndex {
  return { schema_version: 1, content_sha256: 'a'.repeat(64), cards };
}
function state(overrides: Partial<StudyPlan> = {}): CoachState {
  return { ...emptyState(), plan: { id: 'plan', revision: 0, mode: 'time', start_day: day,
    deadline_day: null, minutes_per_day: 5, section_ids: ['s1'], families: ['eje'],
    timezone: 'America/Tijuana', ...overrides } };
}
function assigned(s: CoachState, i: CoachIndex, date = day): CoachState {
  return { ...s, days: { ...s.days, [date]: createAssignment(s, i, date) } };
}

test('calendar arithmetic respects leap days, DST and saved timezone', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-03-10', 1), '2024-03-11');
  assert.equal(dayDiff('2024-03-09', '2024-03-11'), 2);
  assert.equal(dayKey('America/Tijuana', new Date('2026-10-29T02:00:00Z')), '2026-10-28');
  assert.throws(() => addDays('2026-02-30', 1));
  assert.throws(() => dayKey('Invalid/Zone'));
});

test('whole cards fit the budget in pedagogical order', () => {
  const i = index([card('c', 3, 30), card('a', 1, 240), card('b', 2, 120)]);
  assert.deepEqual(createAssignment(state(), i, day).ids, ['a']);
  assert.deepEqual(selectedCards(i, state().plan!).map(c => c.id), ['a', 'b', 'c']);
});

test('overdue reviews come first and blocked reviews remain explicit backlog', () => {
  const i = index([card('a', 1), card('b', 2, 120, 250), card('c', 3, 120, 80)]);
  let s = importLegacy(state(), i, { b: 'known', c: 'again' }, '2026-10-20');
  s.progress.b.due_day = '2026-10-27';
  s.progress.c.due_day = '2026-10-28';
  s = assigned(s, i);
  assert.deepEqual(s.days[day].ids, ['b']);
  assert.equal(summary(s, i, day).backlog_due, 1);
  assert.equal(summary(s, i, day).remaining_seconds, 250);
});

test('rating earns one daily credit; Again schedules tomorrow without correct recall', () => {
  const i = index();
  const original = assigned(state(), i);
  const first = recordReview(original, i, 'a', 1, 30, day, 'attempt-a');
  assert.equal(first.progress.a.due_day, '2026-10-30');
  assert.equal(first.progress.a.card!.last_review, '2026-10-29T12:00:00.000Z');
  assert.equal(summary(first, i, day).today_done, 1);
  assert.equal(summary(first, i, day).correct_today, 0);
  assert.equal(summary(first, i, day).covered, 1);
  assert.equal(first.revision, original.revision);
  assert.deepEqual(original.history, []);
  assert.equal(recordReview(first, i, 'a', 1, 30, day, 'attempt-a'), first);
  const second = recordReview(first, i, 'a', 3, 30, day, 'attempt-b');
  assert.equal(summary(second, i, day).today_done, 1);
  assert.equal(summary(second, i, day).attempts_today, 2);
});

test('saved assignment does not refill after grades or reload', () => {
  const i = index();
  let s = assigned(state(), i);
  const target = s.days[day];
  s = recordReview(s, i, 'a', 3, 20, day, 'a');
  s = recordReview(s, i, 'b', 3, 20, day, 'b');
  assert.equal(createAssignment(s, i, day), target);
  assert.deepEqual(createAssignment(JSON.parse(JSON.stringify(s)), i, day).ids, ['a', 'b']);
  assert.equal(summary(s, i, day).today_goal, 2);
  assert.deepEqual(s.celebrated_days, [day]);
  assert.equal(summary(s, i, day).pending_ids.length, 0);
});

test('one explicit extra does not move the original goal or daily celebration', () => {
  const i = index();
  let s = assigned(state(), i);
  s = recordReview(s, i, 'a', 3, 20, day, 'a');
  s = recordReview(s, i, 'b', 3, 20, day, 'b');
  s = addExtra(s, i, day);
  assert.deepEqual(s.days[day].extra_ids, ['c']);
  assert.equal(summary(s, i, day).today_goal, 2);
  s = recordReview(s, i, 'c', 3, 20, day, 'c');
  assert.equal(summary(s, i, day).extra_done, 1);
  assert.equal(summary(s, i, day).today_done, 2);
  assert.deepEqual(s.celebrated_days, [day]);
  assert.deepEqual(s.celebrated_plans, ['plan']);
});

test('plan edits retain eligible completed work and exclude removed sections', () => {
  const i = index([card('a', 1), card('b', 2), { ...card('d', 4), section_id: 's2' }]);
  let s = assigned(state(), i);
  s = recordReview(s, i, 'a', 3, 20, day, 'a');
  s = { ...s, plan: { ...s.plan!, revision: 1, section_ids: ['s1', 's2'], minutes_per_day: 10 } };
  s = assigned(s, i);
  assert.deepEqual(s.days[day].ids, ['a', 'b', 'd']);
  assert.equal(summary(s, i, day).today_done, 1);
  s = { ...s, plan: { ...s.plan!, revision: 2, section_ids: ['s2'] } };
  s = assigned(s, i);
  assert.deepEqual(s.days[day].ids, ['d']);
  assert.equal(summary(s, i, day).covered, 0);
  assert.equal(s.progress.a.last_rating, 3);
});

test('Undo restores FSRS memory and retains the target and milestone flags', () => {
  const i = index([card('a', 1)]);
  let s = assigned(state(), i);
  s = recordReview(s, i, 'a', 3, 30, day, 'a');
  const firstMemory = s.progress.a;
  s = recordReview(s, i, 'a', 1, 40, day, 'b');
  const undone = undoReview(s);
  assert.deepEqual(undone.progress.a, firstMemory);
  assert.equal(undone.history.length, 1);
  assert.deepEqual(undone.days[day].ids, ['a']);
  assert.deepEqual(undone.celebrated_days, [day]);
  assert.deepEqual(undone.celebrated_plans, ['plan']);
  assert.equal(undoReview(undone), undone);
  const firstUndone = undoReview(recordReview(assigned(state(), i), i, 'a', 1, 20, day, 'first'));
  assert.equal(firstUndone.progress.a, undefined);
  assert.equal(summary(firstUndone, i, day).today_goal, 1);
});

test('legacy exposures have no invented grades or history and spread reviews over seven days', () => {
  const cards = Array.from({ length: 14 }, (_, n) => card(String(n), n));
  const i = index(cards);
  const flags = Object.fromEntries(cards.map(c => [c.id, 'known' as const]));
  const s = importLegacy(state(), i, flags, day);
  assert.equal(s.history.length, 0);
  assert.equal(s.progress['0'].introduced_day, '');
  assert.equal(s.progress['0'].card, null);
  assert.equal(s.progress['0'].last_rating, null);
  assert.equal(s.progress['0'].due_day, '2026-10-30');
  assert.equal(s.progress['6'].due_day, '2026-11-05');
  assert.equal(new Set(Object.values(s.progress).map(p => p.due_day)).size, 7);
  assert.equal(importLegacy(s, i, flags, day), s);
  assert.equal(summary(s, i, day).covered, 14);
  assert.equal(validateState(s), true);
});

test('forecasts use repeated reviews and inclusive dates with whole-card budgets', () => {
  const i = index(Array.from({ length: 20 }, (_, n) => card(String(n), n, 300, 240)));
  const s = state({ mode: 'deadline', deadline_day: '2026-11-12' });
  const f = estimatePlan(s, i, day);
  assert.equal(f.feasible, true);
  assert.ok(f.daily_minutes > 7, 'first-pass division ignores repeated review work');
  assert.ok(f.total_seconds > 6000);
  let live = state({ minutes_per_day: f.daily_minutes });
  let finish: string | null = null;
  let seconds = 0;
  for (let n = 0; n < 15; n++) {
    const date = addDays(day, n);
    live = assigned(live, i, date);
    for (const id of live.days[date].ids) {
      seconds += live.days[date].costs[id];
      live = recordReview(live, i, id, 3, 0, date, `${date}-${id}`);
    }
    if (summary(live, i, date).covered === 20) { finish = date; break; }
  }
  assert.equal(finish, f.finish_day);
  assert.equal(seconds, f.total_seconds);
  const timeForecast = estimatePlan(state({ minutes_per_day: f.daily_minutes }), i, day);
  assert.equal(timeForecast.finish_day, finish);
  assert.equal(timeForecast.total_seconds, seconds);
});

test('forecasts report past deadlines, oversized cards and insufficient horizons honestly', () => {
  const i = index([card('a', 1, 43201)]);
  assert.equal(estimatePlan(state({ mode: 'deadline', deadline_day: '2026-10-28' }), i, day).feasible, false);
  const impossible = estimatePlan(state({ mode: 'deadline', deadline_day: day }), i, day);
  assert.equal(impossible.feasible, false);
  assert.equal(impossible.finish_day, null);
  assert.equal(estimatePlan(state(), index([card('a', 1, 301)]), day).finish_day, null);
  assert.equal(estimatePlan(state({ minutes_per_day: 4 }), index(), day).feasible, false);
  const inclusive = estimatePlan(state({ mode: 'deadline', deadline_day: day }), index([card('a', 1, 600)]), day);
  assert.equal(inclusive.daily_minutes, 10);
  assert.equal(inclusive.finish_day, day);
});

test('forecast respects saved progress and the fixed remaining daily assignment', () => {
  const i = index([card('a', 1, 300), card('b', 2, 300)]);
  let s = assigned(state(), i);
  s = recordReview(s, i, 'a', 3, 20, day, 'a');
  const f = estimatePlan(s, i, day);
  assert.equal(f.remaining_new, 1);
  assert.equal(f.finish_day, '2026-10-30');
  assert.equal(f.total_seconds, 300);
  const all = importLegacy(state(), i, { a: 'known', b: 'again' }, day);
  assert.equal(estimatePlan(all, i, day).total_seconds, 0);
  assert.equal(estimatePlan(all, i, day).remaining_new, 0);
  assert.equal(estimatePlan(all, i, day).feasible, true);
});

test('an explicit pending extra is included in the forecast without changing the daily target', () => {
  const i = index([card('a', 1, 300), card('b', 2, 300)]);
  let s = recordReview(assigned(state(), i), i, 'a', 3, 20, day, 'a');
  s = addExtra(s, i, day);
  assert.equal(summary(s, i, day).today_goal, 1);
  assert.equal(estimatePlan(s, i, day).finish_day, day);
  assert.equal(estimatePlan(s, i, day).total_seconds, 300);
});

test('the 730-day time horizon cannot create a false completion date', () => {
  const i = index(Array.from({ length: 1000 }, (_, n) => card(String(n), n, 300, 1)));
  const f = estimatePlan(state(), i, day);
  assert.equal(f.feasible, false);
  assert.equal(f.finish_day, null);
  assert.equal(f.remaining_new, 1000);
});

test('serialized state stays valid across reviews, repeats, plan edits and Undo', () => {
  const i = index(Array.from({ length: 8 }, (_, n) => card(String(n), n, 100, 40)));
  let s = assigned(state({ minutes_per_day: 60 }), i);
  for (const id of s.days[day].ids) s = recordReview(s, i, id, 1, 9, day, `first-${id}`);
  s = assigned(s, i, '2026-10-30');
  for (const id of s.days['2026-10-30'].ids) s = recordReview(s, i, id, 3, 9, '2026-10-30', `review-${id}`);
  assert.equal(validateState(JSON.parse(JSON.stringify(s))), true);
  s = { ...s, plan: { ...s.plan!, revision: 1, section_ids: ['s2'] } };
  s = assigned(s, i, '2026-10-30');
  assert.equal(validateState(JSON.parse(JSON.stringify(s))), true);
  assert.equal(validateState(JSON.parse(JSON.stringify(undoReview(s)))), true);
});

test('completed first passes use saved exposure dates when checking a past deadline', () => {
  const i = index([card('a', 1)]);
  let s = recordReview(assigned(state(), i), i, 'a', 3, 20, day, 'a');
  s = { ...s, plan: { ...s.plan!, mode: 'deadline', deadline_day: '2026-10-28' } };
  const missed = estimatePlan(s, i, '2026-11-01');
  assert.equal(missed.feasible, false);
  assert.equal(missed.finish_day, day);
  s = { ...s, plan: { ...s.plan!, deadline_day: '2026-10-30' } };
  assert.equal(estimatePlan(s, i, '2026-11-01').feasible, true);
  assert.equal(estimatePlan(s, i, '2026-11-01').finish_day, day);
});

test('missed days preserve memory and queue overdue work before new cards', () => {
  const i = index([card('a', 1, 300, 240), card('b', 2, 300)]);
  let s = recordReview(assigned(state(), i), i, 'a', 1, 30, day, 'a');
  const previous = structuredClone(s.progress.a);
  s = assigned(s, i, '2026-11-05');
  assert.deepEqual(s.days['2026-11-05'].ids, ['a']);
  assert.deepEqual(s.progress.a, previous);
  assert.equal(summary(s, i, '2026-11-05').today_done, 0);
  assert.equal(estimatePlan(s, i, '2026-11-05').finish_day, '2026-11-06');
});

test('calibration requires five active samples and uses a clamped median ratio', () => {
  const i = index(Array.from({ length: 20 }, (_, n) => card(String(n), n, 100, 40)));
  let s = assigned(state({ minutes_per_day: 60 }), i);
  for (let n = 0; n < 4; n++) s = recordReview(s, i, String(n), 3, 250, day, String(n));
  assert.equal(createAssignment({ ...s, plan: { ...s.plan!, revision: 1 } }, i, '2026-10-30').costs['4'], 100);
  s = recordReview(s, i, '4', 3, 900, day, '4');
  const next = createAssignment(s, i, '2026-10-30');
  assert.equal(next.costs['5'], 250);
  assert.equal(next.costs['6'], 250);
});

test('review calibration stays separate and ignores active samples shorter than ten seconds', () => {
  const i = index(Array.from({ length: 12 }, (_, n) => card(String(n), n, 100, 40)));
  let s = assigned(state({ minutes_per_day: 60 }), i);
  for (let n = 0; n < 12; n++) s = recordReview(s, i, String(n), 1, 9, day, `new-${n}`);
  s = assigned(s, i, '2026-10-30');
  for (let n = 0; n < 5; n++) s = recordReview(s, i, String(n), 1, n === 4 ? 500 : 10, '2026-10-30', `review-${n}`);
  const next = createAssignment(s, i, '2026-10-31');
  assert.equal(next.costs['5'], 20, 'review factor clamps at 0.5 after five samples');
  const expanded = index([...i.cards, card('new', 13, 100, 40)]);
  const expandedDay = createAssignment(s, expanded, '2026-10-31');
  assert.equal(expandedDay.costs.new, 100, 'short new samples must not calibrate new costs');
});

test('invalid grades, times, unknown IDs and unassigned cards cannot create progress', () => {
  const i = index();
  const s = assigned(state(), i);
  assert.throws(() => recordReview(s, i, 'no', 3, 20, day, 'x'));
  assert.throws(() => recordReview(s, i, 'c', 3, 20, day, 'x'));
  assert.throws(() => recordReview(s, i, 'a', 0 as 1, 20, day, 'x'));
  assert.throws(() => recordReview(s, i, 'a', 3, NaN, day, 'x'));
  assert.throws(() => recordReview(s, i, 'a', 3, -1, day, 'x'));
  assert.throws(() => recordReview(s, i, 'a', 3, 20, day, ''));
  assert.throws(() => recordReview(state(), i, 'a', 3, 20, day, 'x'));
});

test('backup validation rejects malformed date, FSRS, numeric and reference data', () => {
  const i = index();
  const s = recordReview(assigned(state(), i), i, 'a', 3, 20, day, 'a');
  assert.equal(validateState(JSON.parse(JSON.stringify(s))), true);
  const cases = [
    (v: CoachState) => { v.revision = -1; },
    (v: CoachState) => { v.plan!.timezone = 'Invalid/Zone'; },
    (v: CoachState) => { v.plan!.minutes_per_day = Infinity; },
    (v: CoachState) => { v.plan!.start_day = '2026-02-30'; },
    (v: CoachState) => { v.progress.a.card!.stability = NaN; },
    (v: CoachState) => { v.progress.a.card!.due = 'yesterday'; },
    (v: CoachState) => { v.progress.a.card!.difficulty = 99; },
    (v: CoachState) => { v.progress.a.card!.state = 0; v.progress.a.card!.stability = 0; },
    (v: CoachState) => { v.progress.a.card!.scheduled_days = 0; },
    (v: CoachState) => { v.progress.a.card!.scheduled_days = 300; },
    (v: CoachState) => { v.history[0].rating = 1; },
    (v: CoachState) => { v.progress.a.due_day = '2026-02-30'; },
    (v: CoachState) => { v.history.push(v.history[0]); },
    (v: CoachState) => { v.history[0].elapsed_seconds = -1; },
    (v: CoachState) => { v.days[day].ids.push('a'); },
    (v: CoachState) => { v.days[day].costs.a = -5; },
    (v: CoachState) => { v.undo!.attempt_id = 'missing'; },
  ];
  for (const mutate of cases) {
    const changed = structuredClone(s); mutate(changed);
    assert.equal(validateState(changed), false, mutate.toString());
  }
  assert.equal(validateState(null), false);
  assert.equal(validateState({ version: 1 }), false);
});
