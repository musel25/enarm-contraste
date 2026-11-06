import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  createAssignment,
  dayLoad,
  emptyState,
  estimatePlan,
  isError,
  logSession,
  recordReview,
  recordStudy,
  redistributeBacklog,
  scopeRemaining,
  setDayLoad,
  setTag,
  studyQueue,
  summary,
  validateState,
} from "../../app/src/coach/engine";
import type { CoachCard, CoachIndex, CoachState, StudyPlan } from "../../app/src/coach/types";

const day = "2026-11-02"; // Monday

test("clinical objectives filter new cards and due reviews without changing their memory", () => {
  const content = index(3);
  content.cards[0] = { ...content.cards[0], objective: "gravedad" };
  content.cards[1] = { ...content.cards[1], objective: "variante" };
  let state = plan();
  state.preferences.session_scope = {
    section_ids: [],
    block_ids: [],
    families: [],
    objectives: ["gravedad"],
  };
  assert.equal(validateState(state), true);
  assert.deepEqual(studyQueue(state, content, day, "new").ids, ["c0"]);
  assert.deepEqual(scopeRemaining(state, content), { total: 1, left: 1 });
  state = recordStudy(state, content, "c0", 3, 20, day, "severity");
  const memory = state.progress.c0;
  assert.deepEqual(studyQueue(state, content, memory.due_day, "review").ids, ["c0"]);
  state.preferences.session_scope!.objectives = ["variante"];
  assert.deepEqual(studyQueue(state, content, memory.due_day, "review").ids, []);
  assert.deepEqual(state.progress.c0, memory);
  assert.equal(
    validateState({
      ...state,
      preferences: {
        ...state.preferences,
        session_scope: {
          ...state.preferences.session_scope,
          objectives: ["gravedad", 1],
        },
      },
    }),
    false,
  );
});
function card(id: string, order: number, seconds = 60, review = 30): CoachCard {
  return {
    id,
    order,
    section_id: "s1",
    block_id: "b1",
    family: "eje",
    level: 1,
    new_seconds: seconds,
    review_seconds: review,
  };
}
const index = (n = 30): CoachIndex => ({
  schema_version: 1,
  content_sha256: "a".repeat(64),
  cards: Array.from({ length: n }, (_, i) => card(`c${i}`, i)),
});
function plan(overrides: Partial<StudyPlan> = {}): CoachState {
  return {
    ...emptyState(),
    plan: {
      id: "plan",
      revision: 0,
      mode: "time",
      start_day: day,
      deadline_day: null,
      minutes_per_day: 10,
      section_ids: ["s1"],
      families: ["eje"],
      timezone: "UTC",
      ...overrides,
    },
  };
}
const assign = (s: CoachState, i: CoachIndex, date = day) => ({
  ...s,
  days: { ...s.days, [date]: createAssignment(s, i, date) },
});

test("a first reading rated «Otra vez» is not an error, a forgotten review is", () => {
  const i = index(3);
  let s = assign(plan(), i);
  s = recordReview(s, i, "c0", 1, 20, day, "first");
  assert.equal(isError(s.history[0]), false);
  assert.equal(summary(s, i, day).errors_today, 0);
  assert.equal(summary(s, i, day).first_reads_today, 1);
  const next = addDays(day, 1);
  s = recordStudy(s, i, "c0", 1, 20, next, "again");
  assert.equal(isError(s.history[1]), true);
  assert.equal(summary(s, i, next).errors_today, 1);
});

test("weekly rest days and light days shrink the goal and keep the plan valid", () => {
  const i = index();
  const sunday = "2026-11-08";
  const s = plan({ weekly_load: [0, 1, 1, 1, 1, 1, 0.5] });
  assert.equal(dayLoad(s, sunday), 0);
  assert.equal(createAssignment(s, i, sunday).ids.length, 0);
  assert.equal(createAssignment(s, i, "2026-11-07").ids.length, 5);
  assert.equal(createAssignment(s, i, day).ids.length, 10);
  const withDay = { ...s, days: { [sunday]: createAssignment(s, i, sunday) } };
  assert.ok(validateState(withDay));
  assert.equal(estimatePlan(s, i, day).feasible, true);
  assert.equal(
    validateState({ ...s, plan: { ...s.plan!, weekly_load: [0, 0, 0, 0, 0, 0, 0] } }),
    false,
  );
});

test("a day load override rebuilds today and retains finished cards", () => {
  const i = index();
  let s = assign(plan(), i);
  s = recordReview(s, i, "c0", 3, 20, day, "a");
  s = setDayLoad(s, i, day, 0.5);
  assert.deepEqual(s.days[day].ids.slice(0, 1), ["c0"]);
  assert.equal(s.days[day].ids.length, 5);
  s = setDayLoad(s, i, day, 0);
  assert.deepEqual(s.days[day].ids, ["c0"]);
  assert.ok(validateState(s));
});

test("reviews spread out instead of landing on the same day", () => {
  const i = index(60);
  let s = plan({ minutes_per_day: 120 });
  let date = day;
  for (let n = 0; n < 6; n++) {
    s = assign(s, i, date);
    for (const id of studyQueue(s, i, date, "review").ids)
      s = recordStudy(s, i, id, 3, 20, date, `${date}-${id}`);
    for (const id of studyQueue(s, i, date, "new").ids.slice(0, 10))
      s = recordStudy(s, i, id, 3, 20, date, `${date}-${id}`);
    date = addDays(date, 1);
  }
  const counts = new Map<string, number>();
  for (const memory of Object.values(s.progress))
    counts.set(memory.due_day, (counts.get(memory.due_day) || 0) + 1);
  assert.ok(Math.max(...counts.values()) <= 20, `peak ${Math.max(...counts.values())}`);
  assert.ok(validateState(s));
});

test("reviews avoid rest days", () => {
  const i = index(3);
  let s = assign(plan({ weekly_load: [1, 1, 0, 1, 1, 1, 1] }), i); // Tuesday rests
  s = recordReview(s, i, "c0", 3, 20, day, "a");
  assert.notEqual(s.progress.c0.due_day, "2026-11-03");
  assert.ok(validateState(s));
});

test("new and review sessions use separate queues with «al final» cards last", () => {
  const i = index(6);
  let s = assign(plan({ minutes_per_day: 5 }), i);
  s = setTag(s, "c0", { later: true });
  const queue = studyQueue(s, i, day, "new");
  assert.equal(queue.recommended, 5);
  assert.deepEqual(queue.ids, ["c1", "c2", "c3", "c4", "c0", "c5"]);
  s = recordStudy(s, i, "c5", 3, 20, day, "extra");
  assert.ok(s.days[day].extra_ids.includes("c5"));
  assert.equal(studyQueue(s, i, day, "review").ids.length, 0);
  assert.equal(studyQueue(s, i, addDays(day, 1), "review").ids.length, 0);
  assert.ok(validateState(s));
});

test("the backlog spreads across the next days by study time", () => {
  const i = index(12);
  let s = assign(plan({ minutes_per_day: 30 }), i);
  for (const id of studyQueue(s, i, day, "new").ids) s = recordStudy(s, i, id, 1, 10, day, id);
  const later = addDays(day, 4);
  assert.equal(studyQueue(s, i, later, "review").ids.length, 12);
  s = redistributeBacklog(s, i, later, 3);
  const days = Object.values(s.progress).map((m) => m.due_day);
  assert.deepEqual(
    [later, addDays(later, 1), addDays(later, 2)].map((d) => days.filter((x) => x === d).length),
    [4, 4, 4],
  );
  assert.ok(validateState(s));
});

test("tags and session logs validate and stay compact", () => {
  let s = setTag(plan(), "c1", { order: 2, deepen: true });
  s = setTag(s, "c1", { deepen: false });
  assert.deepEqual(s.tags, { c1: { order: 2 } });
  s = setTag(s, "c1", { order: undefined });
  assert.deepEqual(s.tags, {});
  s = logSession(s, {
    id: "s1",
    day,
    kind: "new",
    started_at: "2026-11-02T15:00:00.000Z",
    wall_seconds: 600,
    active_seconds: 500,
    cards: 12,
    target_seconds: 1500,
  });
  assert.equal(s.sessions?.length, 1);
  assert.ok(validateState(s));
  assert.equal(validateState({ ...s, tags: { c1: { order: 4 } } }), false);
  assert.equal(
    validateState({ ...s, preferences: { ...s.preferences, motivation_every: 1000 } }),
    false,
  );
});

test("a session scope limits new and review queues to chosen sections, blocks and formats", () => {
  const cards: CoachCard[] = [
    { ...card("e1", 0), section_id: "s1", block_id: "b1", family: "eje" },
    { ...card("m1", 1), section_id: "s1", block_id: "b1", family: "madre" },
    { ...card("m2", 2), section_id: "s1", block_id: "b2", family: "madre" },
    { ...card("m3", 3), section_id: "s2", block_id: "b3", family: "madre" },
  ];
  const i: CoachIndex = { schema_version: 1, content_sha256: "a".repeat(64), cards };
  let s = assign(
    plan({ section_ids: ["s1", "s2"], families: ["eje", "madre"], minutes_per_day: 30 }),
    i,
  );
  const scoped = (scope: NonNullable<CoachState["preferences"]["session_scope"]>) => ({
    ...s,
    preferences: { ...s.preferences, session_scope: scope },
  });
  assert.deepEqual(
    studyQueue(scoped({ section_ids: ["s1"], block_ids: [], families: ["madre"] }), i, day, "new")
      .ids,
    ["m1", "m2"],
  );
  assert.deepEqual(
    studyQueue(scoped({ section_ids: ["s1"], block_ids: ["b2"], families: [] }), i, day, "new").ids,
    ["m2"],
  );
  assert.equal(
    studyQueue(scoped({ section_ids: [], block_ids: [], families: ["eje"] }), i, day, "new")
      .recommended,
    1,
  );
  for (const id of ["e1", "m1", "m2", "m3"]) s = recordStudy(s, i, id, 3, 20, day, id);
  const later = addDays(day, 30);
  assert.deepEqual(
    studyQueue(scoped({ section_ids: ["s2"], block_ids: [], families: [] }), i, later, "review")
      .ids,
    ["m3"],
  );
  assert.ok(validateState(scoped({ section_ids: ["s2"], block_ids: [], families: ["madre"] })));
  assert.equal(
    validateState(scoped({ section_ids: [], block_ids: [], families: ["otro" as "eje"] })),
    false,
  );
});

test("scope remaining counts first-pass cards left in the chosen sections or blocks, even on days they are not scheduled", () => {
  const cards: CoachCard[] = [
    { ...card("a1", 0, 290), section_id: "s1", block_id: "b1", family: "eje" },
    { ...card("a2", 1, 290), section_id: "s1", block_id: "b1", family: "madre" },
    { ...card("b1", 2, 290), section_id: "s2", block_id: "b2", family: "eje" },
    { ...card("b2", 3, 290), section_id: "s2", block_id: "b2", family: "eje" },
    { ...card("b3", 4, 290), section_id: "s2", block_id: "b3", family: "eje" },
  ];
  const i: CoachIndex = { schema_version: 1, content_sha256: "a".repeat(64), cards };
  let s = assign(
    plan({ section_ids: ["s1", "s2"], families: ["eje", "madre"], minutes_per_day: 5 }),
    i,
  );
  const scoped = (scope: NonNullable<CoachState["preferences"]["session_scope"]>) => ({
    ...s,
    preferences: { ...s.preferences, session_scope: scope },
  });
  const s2 = { section_ids: ["s2"], block_ids: [], families: [] as ("eje" | "madre")[] };
  assert.equal(studyQueue(scoped(s2), i, day, "new").recommended, 0);
  assert.deepEqual(scopeRemaining(scoped(s2), i), { total: 3, left: 3 });
  s = recordStudy(s, i, "b1", 1, 20, day, "b1");
  assert.deepEqual(scopeRemaining(scoped(s2), i), { total: 3, left: 2 });
  assert.deepEqual(
    scopeRemaining(scoped({ section_ids: ["s2"], block_ids: ["b3"], families: [] }), i),
    { total: 1, left: 1 },
  );
  assert.deepEqual(
    scopeRemaining(scoped({ section_ids: ["s1"], block_ids: [], families: ["madre"] }), i),
    { total: 1, left: 1 },
  );
  assert.deepEqual(scopeRemaining({ ...s, plan: null }, i), { total: 0, left: 0 });
});
