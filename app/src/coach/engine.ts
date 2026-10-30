import { createEmptyCard, fsrs, type Card, type Grade as FSRSGrade } from 'ts-fsrs';
import type { Assignment, Attempt, CoachCard, CoachIndex, CoachState, Forecast, Grade,
  Memory, SerializedFSRS, StudyPlan, StudySummary } from './types';

const DAY = 86_400_000;
const HORIZON = 730;
const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: false,
  enable_short_term: false, maximum_interval: 365 });
const formatters = new Map<string, Intl.DateTimeFormat>();
const dayTimes = new Map<string, number>();

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function requireDay(value: string): void {
  if (!isDay(value)) throw new Error('Invalid calendar day');
}
function dayTime(day: string): number {
  const cached = dayTimes.get(day);
  if (cached !== undefined) return cached;
  requireDay(day);
  const time = Date.parse(`${day}T12:00:00Z`);
  if (dayTimes.size > 8_000) dayTimes.clear();
  dayTimes.set(day, time);
  return time;
}
export function dayKey(timezone: string, now = new Date()): string {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(now);
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)!.value).join('-');
}
export function addDays(day: string, count: number): string {
  if (!Number.isSafeInteger(count)) throw new Error('Invalid day count');
  const time = dayTime(day) + count * DAY;
  const result = new Date(time).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('Invalid calendar day');
  dayTimes.set(result, time);
  return result;
}
export function dayDiff(start: string, end: string): number {
  return Math.round((dayTime(end) - dayTime(start)) / DAY);
}
export function emptyState(): CoachState {
  return { version: 1, revision: 0, plan: null, progress: {}, history: [], days: {},
    celebrated_days: [], celebrated_plans: [], preferences: { sound: false, low_motion: false }, undo: null };
}
export function selectedCards(index: CoachIndex, plan: StudyPlan): CoachCard[] {
  const sections = new Set(plan.section_ids);
  const families = new Set(plan.families);
  return index.cards.filter(c => sections.has(c.section_id) && families.has(c.family))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
function planKey(plan: StudyPlan): string { return `${plan.id}:${plan.revision}`; }
function validBudget(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes >= 5 && minutes <= 720;
}
function median(values: number[]): number {
  const sorted = values.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function calibration(state: CoachState, index: CoachIndex): { fresh: number; review: number } {
  const byId = new Map(index.cards.map(c => [c.id, c]));
  const fresh: number[] = [], review: number[] = [];
  for (const attempt of state.history) {
    const card = byId.get(attempt.card_id);
    if (!card || attempt.elapsed_seconds < 10) continue;
    const base = attempt.was_new ? card.new_seconds : card.review_seconds;
    (attempt.was_new ? fresh : review).push(attempt.elapsed_seconds / base);
  }
  const factor = (samples: number[]) => samples.length < 5 ? 1 : Math.max(0.5, Math.min(2.5, median(samples)));
  return { fresh: factor(fresh), review: factor(review) };
}
type Costs = ReturnType<typeof calibration>;
function cost(card: CoachCard, isNew: boolean, factors: Costs): number {
  return Math.max(1, Math.ceil((isNew ? card.new_seconds * factors.fresh : card.review_seconds * factors.review)));
}
function dueCards(cards: CoachCard[], progress: CoachState['progress'], day: string, done: Set<string>): CoachCard[] {
  return cards.filter(c => progress[c.id] && progress[c.id].due_day <= day && !done.has(c.id))
    .sort((a, b) => progress[a.id].due_day.localeCompare(progress[b.id].due_day) || a.order - b.order || a.id.localeCompare(b.id));
}

// Forecasts and real assignments both use this strict, whole-card queue.
function selectQueue(cards: CoachCard[], progress: CoachState['progress'], day: string,
  budget: number, factors: Costs, done = new Set<string>(), excluded = new Set<string>()): Pick<Assignment, 'ids' | 'new_ids' | 'costs'> {
  const ids: string[] = [], new_ids: string[] = [];
  const costs: Record<string, number> = {};
  let room = Math.max(0, budget);
  const due = dueCards(cards, progress, day, done).filter(c => !excluded.has(c.id));
  for (const card of due) {
    const seconds = cost(card, false, factors);
    if (seconds > room) return { ids, new_ids, costs };
    ids.push(card.id); costs[card.id] = seconds; room -= seconds;
  }
  for (const card of cards) {
    if (progress[card.id] || done.has(card.id) || excluded.has(card.id)) continue;
    const seconds = cost(card, true, factors);
    if (seconds > room) break;
    ids.push(card.id); new_ids.push(card.id); costs[card.id] = seconds; room -= seconds;
  }
  return { ids, new_ids, costs };
}

export function createAssignment(state: CoachState, index: CoachIndex, day: string, budgetMinutes?: number): Assignment {
  requireDay(day);
  const plan = state.plan;
  if (!plan) throw new Error('A study plan is required');
  const key = planKey(plan), saved = state.days[day];
  if (saved?.plan_key === key) return saved;
  const minutes = budgetMinutes ?? plan.minutes_per_day;
  if (!validBudget(minutes)) throw new Error('Daily time must be 5–720 minutes');
  const cards = selectedCards(index, plan), selected = new Set(cards.map(c => c.id));
  const factors = calibration(state, index);
  const todays = state.history.filter(a => a.day === day && selected.has(a.card_id));
  const done = new Set(todays.map(a => a.card_id));
  // A plan edit retains completed original targets and keeps explicit extras separate.
  const retained = saved ? saved.ids.filter(id => selected.has(id) && done.has(id)) : [...done];
  const extras = saved?.extra_ids.filter(id => selected.has(id)) ?? [];
  const byId = new Map(cards.map(c => [c.id, c]));
  const retainedCosts: Record<string, number> = {};
  const retainedNew: string[] = [];
  for (const id of retained) {
    const attempt = todays.find(a => a.card_id === id)!;
    retainedCosts[id] = saved?.costs[id] ?? attempt.estimated_seconds;
    if (saved ? saved.new_ids.includes(id) : attempt.was_new) retainedNew.push(id);
  }
  for (const id of extras) retainedCosts[id] = saved!.costs[id] ?? cost(byId.get(id)!, !state.progress[id], factors);
  const spent = retained.reduce((total, id) => total + retainedCosts[id], 0);
  const queue = day < plan.start_day ? { ids: [], new_ids: [], costs: {} }
    : selectQueue(cards, state.progress, day, minutes * 60 - spent, factors, done, new Set(extras));
  return { day, plan_key: key, ids: [...retained, ...queue.ids], new_ids: [...retainedNew, ...queue.new_ids],
    costs: { ...retainedCosts, ...queue.costs }, budget_seconds: minutes * 60, extra_ids: extras };
}

type Transition = Omit<SerializedFSRS, 'due' | 'last_review'>;
const transitions = new Map<string, Transition>();
const scheduledCards = new WeakMap<Transition, Map<string, SerializedFSRS>>();
function nextMemory(previous: Memory | undefined, rating: Grade, day: string): Memory {
  const stored = previous?.card;
  const elapsed = stored?.last_review ? dayDiff(stored.last_review.slice(0, 10), day) : 0;
  const key = JSON.stringify([rating, elapsed, stored && [stored.stability, stored.difficulty,
    stored.elapsed_days, stored.scheduled_days, stored.learning_steps, stored.reps, stored.lapses, stored.state]]);
  let template = transitions.get(key);
  if (!template) {
    const now = new Date(`${day}T12:00:00Z`);
    const input: Card = stored ? { ...stored, due: new Date(stored.due),
      last_review: stored.last_review ? new Date(stored.last_review) : undefined } : createEmptyCard(now);
    const { due: _due, last_review: _last, ...numeric } = scheduler.next(input, now, rating as FSRSGrade).card;
    numeric.scheduled_days = rating === 1 ? 1 : Math.max(1, numeric.scheduled_days);
    template = numeric;
    if (transitions.size > 30_000) transitions.clear();
    transitions.set(key, template);
  }
  let dates = scheduledCards.get(template);
  if (!dates) { dates = new Map(); scheduledCards.set(template, dates); }
  let serialized = dates.get(day);
  if (!serialized) {
    const due_day = addDays(day, template.scheduled_days);
    serialized = { ...template, due: `${due_day}T12:00:00.000Z`, last_review: `${day}T12:00:00.000Z` };
    dates.set(day, serialized);
  }
  const due_day = serialized.due.slice(0, 10);
  return { card: serialized,
    due_day, introduced_day: previous?.introduced_day ?? day, last_rating: rating, imported: previous?.imported ?? false };
}

export function recordReview(state: CoachState, index: CoachIndex, cardId: string, rating: Grade,
  elapsedSeconds: number, day: string, attemptId: string): CoachState {
  if (state.history.some(a => a.id === attemptId)) return state;
  requireDay(day);
  if (!textId(attemptId) || !isGrade(rating) || !finite(elapsedSeconds, 0, 86_400)) throw new Error('Invalid review');
  const plan = state.plan;
  const card = plan && selectedCards(index, plan).find(c => c.id === cardId);
  if (!card) throw new Error('Card is not in the selected course');
  const assignment = state.days[day];
  if (!assignment || assignment.plan_key !== planKey(plan!) ||
      ![...assignment.ids, ...assignment.extra_ids].includes(cardId) || day < plan!.start_day) throw new Error('Card is not assigned today');
  const previous = state.progress[cardId];
  if (previous?.card?.last_review && previous.card.last_review.slice(0, 10) > day) throw new Error('Review predates saved progress');
  const attempt: Attempt = { id: attemptId, card_id: cardId, day, rating, elapsed_seconds: elapsedSeconds,
    was_new: !previous, estimated_seconds: assignment.costs[cardId] };
  let result: CoachState = { ...state, progress: { ...state.progress, [cardId]: nextMemory(previous, rating, day) },
    history: [...state.history, attempt], undo: { attempt_id: attemptId, previous: previous ?? null } };
  const today = summary(result, index, day);
  if (today.today_goal > 0 && today.today_done === today.today_goal && !state.celebrated_days.includes(day)) {
    result = { ...result, celebrated_days: [...result.celebrated_days, day] };
  }
  if (today.total > 0 && today.covered === today.total && !state.celebrated_plans.includes(plan!.id)) {
    result = { ...result, celebrated_plans: [...result.celebrated_plans, plan!.id] };
  }
  return result;
}
export function undoReview(state: CoachState): CoachState {
  if (!state.undo || state.history.at(-1)?.id !== state.undo.attempt_id) return state;
  const last = state.history.at(-1)!;
  const progress = { ...state.progress };
  if (state.undo.previous) progress[last.card_id] = state.undo.previous;
  else delete progress[last.card_id];
  return { ...state, progress, history: state.history.slice(0, -1), undo: null };
}
export function addExtra(state: CoachState, index: CoachIndex, day: string): CoachState {
  requireDay(day);
  if (!state.plan || day < state.plan.start_day) return state;
  const assignment = createAssignment(state, index, day);
  const cards = selectedCards(index, state.plan);
  const excluded = new Set([...assignment.ids, ...assignment.extra_ids]);
  const done = new Set(state.history.filter(a => a.day === day).map(a => a.card_id));
  const candidate = dueCards(cards, state.progress, day, done).find(c => !excluded.has(c.id)) ??
    cards.find(c => !state.progress[c.id] && !excluded.has(c.id) && !done.has(c.id));
  if (!candidate) return state;
  const extra = { ...assignment, extra_ids: [...assignment.extra_ids, candidate.id],
    costs: { ...assignment.costs, [candidate.id]: cost(candidate, !state.progress[candidate.id], calibration(state, index)) } };
  return { ...state, days: { ...state.days, [day]: extra } };
}
export function summary(state: CoachState, index: CoachIndex, day: string): StudySummary {
  requireDay(day);
  const cards = state.plan ? selectedCards(index, state.plan) : [];
  const selected = new Set(cards.map(c => c.id)), assignment = state.days[day];
  const ids = assignment?.ids.filter(id => selected.has(id)) ?? [];
  const extras = assignment?.extra_ids.filter(id => selected.has(id)) ?? [];
  const eligible = new Set([...ids, ...extras]);
  const attempts = state.history.filter(a => a.day === day && eligible.has(a.card_id));
  const done = new Set(attempts.map(a => a.card_id));
  const originals = new Set(ids);
  const first = new Map<string, Attempt>();
  for (const attempt of attempts) if (originals.has(attempt.card_id) && !first.has(attempt.card_id)) first.set(attempt.card_id, attempt);
  const pending_ids = ids.filter(id => !done.has(id));
  const due = dueCards(cards, state.progress, day, done);
  const tomorrow = addDays(day, 1);
  const covered = cards.filter(c => !!state.progress[c.id]).length;
  return { today_done: ids.length - pending_ids.length, today_goal: ids.length, pending_ids,
    extra_done: extras.filter(id => done.has(id)).length,
    new_done: [...first.values()].filter(a => a.was_new).length,
    reviews_done: [...first.values()].filter(a => !a.was_new).length,
    covered, total: cards.length, coverage_percent: cards.length ? 100 * covered / cards.length : 0,
    today_seconds: attempts.reduce((total, a) => total + a.elapsed_seconds, 0),
    remaining_seconds: pending_ids.reduce((total, id) => total + (assignment?.costs[id] ?? 0), 0),
    backlog_due: due.filter(c => !eligible.has(c.id)).length,
    correct_today: attempts.filter(a => a.rating >= 3).length, attempts_today: attempts.length,
    due_tomorrow: cards.filter(c => state.progress[c.id]?.due_day === tomorrow).length };
}

type Projection = { finish_day: string | null; total_seconds: number };
function simulate(state: CoachState, cards: CoachCard[], day: string, minutes: number, limit: number,
  factors: Costs, index: CoachIndex): Projection {
  const plan = state.plan!;
  const progress = { ...state.progress };
  const start = day < plan.start_day ? plan.start_day : day;
  const remainingIds = new Set(cards.filter(c => !progress[c.id]).map(c => c.id));
  let total_seconds = 0;
  const selected = new Set(cards.map(c => c.id));
  const todayDone = new Set(state.history.filter(a => a.day === day && selected.has(a.card_id)).map(a => a.card_id));
  for (let n = 0; n < limit; n++) {
    const date = addDays(start, n);
    // Rebuilding an edited plan must reserve the same completed work as real study.
    const saved = date === day ? createAssignment(state, index, date, minutes) : undefined;
    const queue = saved ? { ids: [...saved.ids, ...saved.extra_ids].filter(id => selected.has(id) && !todayDone.has(id)), costs: saved.costs }
      : selectQueue(cards, progress, date, minutes * 60, factors, date === day ? todayDone : undefined);
    if (!queue.ids.length && !saved) return { finish_day: null, total_seconds };
    for (const id of queue.ids) {
      total_seconds += queue.costs[id];
      progress[id] = nextMemory(progress[id], 3, date);
      remainingIds.delete(id);
    }
    if (!remainingIds.size) return { finish_day: date, total_seconds };
  }
  return { finish_day: null, total_seconds };
}
export function estimatePlan(state: CoachState, index: CoachIndex, day: string): Forecast {
  requireDay(day);
  const plan = state.plan;
  const failure = (reason: string, remaining_new = 0, daily_minutes = plan?.minutes_per_day ?? 0, total_seconds = 0): Forecast =>
    ({ feasible: false, finish_day: null, daily_minutes, total_seconds, remaining_new, reason });
  if (!plan) return failure('Elige un plan de estudio.');
  const cards = selectedCards(index, plan);
  const remaining_new = cards.filter(c => !state.progress[c.id]).length;
  if (!cards.length) return failure('Selecciona al menos una tarjeta.');
  if (!validBudget(plan.minutes_per_day)) return failure('El tiempo diario debe ser de 5 a 720 minutos.', remaining_new);
  if (!remaining_new) {
    // Imported exposures have no known date. Never invent a historical finish.
    const dates = cards.map(c => state.progress[c.id].introduced_day);
    const finish_day = dates.some(date => !date) ? day : dates.sort().at(-1)!;
    const feasible = plan.mode === 'time' || (isDay(plan.deadline_day) && finish_day <= plan.deadline_day);
    return { feasible, finish_day, daily_minutes: plan.minutes_per_day, total_seconds: 0, remaining_new: 0,
      ...(!feasible ? { reason: 'La primera vuelta terminó después de la fecha objetivo.' } : {}) };
  }
  const factors = calibration(state, index);
  if (plan.mode === 'time') {
    const result = simulate(state, cards, day, plan.minutes_per_day, HORIZON, factors, index);
    return { ...result, feasible: !!result.finish_day, daily_minutes: plan.minutes_per_day, remaining_new,
      ...(!result.finish_day ? { reason: 'Este ritmo no completa la primera vuelta en 730 días.' } : {}) };
  }
  if (!isDay(plan.deadline_day)) return failure('Elige una fecha objetivo válida.', remaining_new);
  const start = day < plan.start_day ? plan.start_day : day;
  const limit = Math.min(HORIZON, Math.max(0, dayDiff(start, plan.deadline_day) + 1));
  if (!limit) return failure('La fecha objetivo ya pasó.', remaining_new);
  let low = 5, high = 720;
  let result = simulate(state, cards, day, high, limit, factors, index);
  if (!result.finish_day) return failure('No se puede completar la primera vuelta antes de esa fecha con hasta 720 minutos diarios.', remaining_new, high, result.total_seconds);
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const trial = simulate(state, cards, day, middle, limit, factors, index);
    if (trial.finish_day) high = middle;
    else low = middle + 1;
  }
  result = simulate(state, cards, day, low, limit, factors, index);
  return { ...result, feasible: !!result.finish_day, daily_minutes: low, remaining_new };
}

export function importLegacy(state: CoachState, index: CoachIndex, flags: Record<string, 'known' | 'again'>, day: string): CoachState {
  requireDay(day);
  const progress = { ...state.progress };
  let imported = 0;
  for (const card of [...index.cards].sort((a, b) => a.order - b.order)) {
    if (progress[card.id] || !Object.hasOwn(flags, card.id) || !['known', 'again'].includes(flags[card.id])) continue;
    progress[card.id] = { card: null, due_day: addDays(day, 1 + imported % 7), introduced_day: '', last_rating: null, imported: true };
    imported++;
  }
  return imported ? { ...state, progress } : state;
}

function object(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key));
}
function finite(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return finite(value, min, max) && Number.isSafeInteger(value);
}
function textId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    !['__proto__', 'prototype', 'constructor'].includes(value);
}
function strings(value: unknown, allowEmpty = true): value is string[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(textId) && new Set(value).size === value.length;
}
function isGrade(value: unknown): value is Grade { return integer(value, 1, 4); }
function iso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function validFSRS(value: unknown): value is SerializedFSRS {
  if (!object(value)) return false;
  return iso(value.due) && (value.last_review === undefined || iso(value.last_review)) &&
    finite(value.stability, Number.MIN_VALUE, 36_500) && finite(value.difficulty, 1, 10) &&
    integer(value.elapsed_days, 0, 3_652_425) && integer(value.scheduled_days, 1, 365) &&
    integer(value.learning_steps) && integer(value.reps) && integer(value.lapses) &&
    value.lapses <= value.reps && value.reps > 0 && integer(value.state, 1, 3) &&
    iso(value.last_review) && value.last_review < value.due &&
    dayDiff(value.last_review.slice(0, 10), value.due.slice(0, 10)) === value.scheduled_days;
}
function validMemory(value: unknown): value is Memory {
  if (!object(value) || typeof value.imported !== 'boolean' || !isDay(value.due_day) ||
      !(isDay(value.introduced_day) || (value.imported && value.introduced_day === '')) ||
      !(value.last_rating === null || isGrade(value.last_rating))) return false;
  if (value.card === null) return value.imported && value.last_rating === null && value.introduced_day === '';
  if (!validFSRS(value.card) || !isGrade(value.last_rating) || value.card.due.slice(0, 10) !== value.due_day) return false;
  return value.introduced_day === '' || (value.card.last_review !== undefined && value.introduced_day <= value.card.last_review.slice(0, 10));
}
function validPlan(value: unknown): value is StudyPlan {
  if (!object(value) || !textId(value.id) || !integer(value.revision) ||
      !['deadline', 'time'].includes(String(value.mode)) || !isDay(value.start_day) ||
      !(value.deadline_day === null || isDay(value.deadline_day)) ||
      (value.mode === 'deadline' && value.deadline_day === null) ||
      !finite(value.minutes_per_day, 5, 720) || !strings(value.section_ids, false) ||
      !strings(value.families, false) || !value.families.every(f => f === 'eje' || f === 'madre') ||
      typeof value.timezone !== 'string') return false;
  try { dayKey(value.timezone); return true; } catch { return false; }
}
export function validateState(value: unknown): value is CoachState {
  try {
    if (!object(value) || value.version !== 1 || !integer(value.revision) ||
        !(value.plan === null || validPlan(value.plan)) || !object(value.progress) || !object(value.days) ||
        !Array.isArray(value.history) || !strings(value.celebrated_days) || !value.celebrated_days.every(isDay) ||
        !strings(value.celebrated_plans) || !object(value.preferences) ||
        typeof value.preferences.sound !== 'boolean' || typeof value.preferences.low_motion !== 'boolean') return false;
    for (const [id, memory] of Object.entries(value.progress)) if (!textId(id) || !validMemory(memory)) return false;
    const attemptIds = new Set<string>();
    const latest = new Map<string, Attempt>();
    for (const attempt of value.history) {
      if (!object(attempt) || !textId(attempt.id) || attemptIds.has(attempt.id) || !textId(attempt.card_id) ||
          !isDay(attempt.day) || !isGrade(attempt.rating) || !finite(attempt.elapsed_seconds, 0, 86_400) ||
          !finite(attempt.estimated_seconds, Number.MIN_VALUE, 216_000) || typeof attempt.was_new !== 'boolean' ||
          !Object.hasOwn(value.progress, attempt.card_id)) return false;
      attemptIds.add(attempt.id);
      const previous = latest.get(attempt.card_id);
      if ((previous && (previous.day > attempt.day || attempt.was_new)) ||
          (!previous && !attempt.was_new && !(value.progress[attempt.card_id] as Memory).imported)) return false;
      latest.set(attempt.card_id, attempt as Attempt);
    }
    for (const [id, memory] of Object.entries(value.progress) as [string, Memory][]) {
      const attempt = latest.get(id);
      if (!attempt && memory.card !== null) return false;
      if (attempt && (memory.last_rating !== attempt.rating || memory.card?.last_review?.slice(0, 10) !== attempt.day ||
          (attempt.was_new && memory.introduced_day !== attempt.day))) return false;
    }
    for (const [day, assignment] of Object.entries(value.days)) {
      if (!isDay(day) || !object(assignment) || assignment.day !== day || !textId(assignment.plan_key) ||
          !strings(assignment.ids) || !strings(assignment.new_ids) || !strings(assignment.extra_ids) ||
          !finite(assignment.budget_seconds, 300, 43_200) || !object(assignment.costs)) return false;
      const originalIds = assignment.ids;
      if (assignment.new_ids.some(id => !originalIds.includes(id)) ||
          assignment.extra_ids.some(id => originalIds.includes(id))) return false;
      const ids = new Set([...assignment.ids, ...assignment.extra_ids]);
      if (Object.keys(assignment.costs).length !== ids.size) return false;
      for (const id of ids) if (!finite(assignment.costs[id], Number.MIN_VALUE, 216_000)) return false;
    }
    for (const attempt of value.history as Attempt[]) {
      const assignment = value.days[attempt.day] as Assignment | undefined;
      // A scope edit can remove old assigned IDs. Its history must remain valid.
      if (!assignment) return false;
    }
    if (value.undo !== null) {
      if (!object(value.undo) || !textId(value.undo.attempt_id) || value.history.at(-1)?.id !== value.undo.attempt_id ||
          !(value.undo.previous === null || validMemory(value.undo.previous))) return false;
    }
    return true;
  } catch { return false; }
}
