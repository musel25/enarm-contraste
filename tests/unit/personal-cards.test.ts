import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  createAssignment,
  emptyState,
  recordStudy,
  scopeRemaining,
  studyQueue,
  summary,
  undoReview,
  selectedCards,
  validateState,
} from "../../app/src/coach/engine";
import {
  addPersonalCard,
  personalIndex,
  personalSection,
  setSuspended,
} from "../../app/src/coach/personal";
import type { CoachIndex, CoachState, PersonalCard } from "../../app/src/coach/types";
import { completionNotices, progressRows } from "../../app/src/learning/model";

const day = "2026-11-04";

test("explicit format choices exclude personal cards while legacy plans retain them", () => {
  const state = addPersonalCard(initial(), card);
  assert.equal(selectedCards(index, state.plan!, state).length, 2);
  const excluded = { ...state.plan!, created_cards_enabled: false };
  assert.deepEqual(
    selectedCards(index, excluded, state).map((c) => c.id),
    ["eje/01.01"],
  );
  assert.deepEqual(selectedCards(index, { ...excluded, families: [] }, state), []);
  assert.equal(validateState({ ...state, plan: excluded }), true);
  assert.equal(
    validateState({ ...state, plan: { ...excluded, created_cards_enabled: "false" } }),
    false,
  );
});

test("suspending an answered target preserves today's completed work and time", () => {
  let state = initial();
  state = recordStudy(state, index, "eje/01.01", 3, 20, day, "done");
  state = setSuspended(state, "eje/01.01", true);
  const stats = summary(state, index, day);
  assert.equal(stats.today_done, 1);
  assert.equal(stats.today_goal, 1);
  assert.equal(stats.attempts_today, 1);
  assert.equal(stats.today_seconds, 20);
  assert.equal(stats.new_goal_done, 1);
  assert.deepEqual(stats.pending_ids, []);
  assert.equal(stats.total, 0);
});

test("progress analysis and milestones respect an explicitly filtered index", () => {
  const before = addPersonalCard(initial(), card);
  before.plan = { ...before.plan!, created_cards_enabled: false };
  const after = recordStudy(before, index, "eje/01.01", 3, 20, day, "finish");
  const scoped = {
    ...index,
    cards: selectedCards(personalIndex(index, before), before.plan!, before),
  };
  assert.equal(progressRows(after, scoped, day).sections[0].total, 1);
  assert.deepEqual(completionNotices(before, after, scoped), [
    { kind: "block", id: "01.01" },
    { kind: "section", id: "01" },
  ]);
});
const card: PersonalCard = {
  id: "created/6a9121c5-fc78-453b-90a7-d265eed8a90e",
  section_id: "01",
  source_card_id: "eje/01.01",
  source_block_id: "01.01",
  front: "Mi pregunta",
  back: "Mi respuesta\nOtra línea <script>",
  created_at: "2026-11-04T12:00:00.000Z",
};
const index: CoachIndex = {
  schema_version: 1,
  content_sha256: "test",
  cards: [
    {
      id: "eje/01.01",
      section_id: "01",
      block_id: "01.01",
      family: "eje",
      level: 0,
      order: 0,
      new_seconds: 90,
      review_seconds: 35,
    },
  ],
};
function initial(): CoachState {
  const state: CoachState = {
    ...emptyState(),
    plan: {
      id: "p",
      revision: 1,
      mode: "time",
      start_day: day,
      deadline_day: null,
      minutes_per_day: 5,
      section_ids: ["01"],
      families: ["eje"],
      timezone: "UTC",
    },
  };
  return { ...state, days: { [day]: createAssignment(state, index, day) } };
}

test("created cards join old plans without changing today's saved assignment", () => {
  const before = initial();
  const state = addPersonalCard(before, card);
  assert.deepEqual(state.days, before.days);
  assert.equal(validateState(state), true);
  assert.deepEqual(studyQueue(state, index, day, "new"), {
    ids: ["eje/01.01", card.id],
    recommended: 1,
  });
  state.preferences.session_scope = { section_ids: [], block_ids: [], families: ["creadas"] };
  assert.deepEqual(studyQueue(state, index, day, "new"), { ids: [card.id], recommended: 0 });
  assert.deepEqual(scopeRemaining(state, index), { total: 1, left: 1 });
  const rated = recordStudy(state, index, card.id, 3, 12, day, "attempt");
  assert.equal(validateState(rated), true);
  assert.deepEqual(rated.days[day].ids, before.days[day].ids);
  assert.deepEqual(rated.days[day].extra_ids, [card.id]);
  assert.equal(rated.progress[card.id].last_rating, 3);
  assert.deepEqual(undoReview(rated).created_cards, state.created_cards);
  assert.equal(undoReview(rated).progress[card.id], undefined);
  const due = rated.progress[card.id].due_day;
  assert.deepEqual(studyQueue(rated, index, due, "review").ids, [card.id]);
});

test("suspension removes targets and due reviews while retaining history and restoration", () => {
  let state = addPersonalCard(initial(), card);
  const assignment = state.days[day];
  state = setSuspended(state, "eje/01.01", true);
  assert.deepEqual(studyQueue(state, index, day, "new").ids, [card.id]);
  assert.deepEqual(state.days[day], assignment);
  assert.deepEqual(summary(state, index, day).pending_ids, []);
  state = recordStudy(state, index, card.id, 3, 10, day, "a");
  const history = state.history;
  const memory = state.progress[card.id];
  state = setSuspended(state, card.id, true);
  assert.equal(validateState(state), true);
  assert.deepEqual(studyQueue(state, index, addDays(day, 365), "review").ids, []);
  assert.throws(() => recordStudy(state, index, card.id, 3, 10, day, "b"));
  const row = progressRows(state, personalIndex(index, state), day).sections[0];
  assert.equal(row.total, 0);
  assert.equal(row.practiced, 0);
  assert.equal(row.attempts, 1);
  state = setSuspended(state, card.id, false);
  assert.deepEqual(state.history, history);
  assert.deepEqual(state.progress[card.id], memory);
  assert.deepEqual(studyQueue(state, index, memory.due_day, "review").ids, [card.id]);
});

test("personal overlays preserve library identity, text, virtual blocks and retry identity", () => {
  const state = addPersonalCard(initial(), card);
  assert.deepEqual(addPersonalCard(state, card), state);
  assert.throws(() => addPersonalCard(state, { ...card, back: "changed" }));
  const merged = personalIndex(index, state);
  assert.deepEqual(merged.cards[0], index.cards[0]);
  assert.equal(merged.cards[1].block_id, "01.creadas");
  assert.equal(merged.cards[1].family, "creadas");
  assert.deepEqual(personalIndex(merged, state), merged);
  const section = personalSection({ id: "01", title: "Test", blocks: [], cards: [] }, state);
  assert.equal(section.blocks[0].title, "Creadas");
  assert.equal(section.cards[0].back[0].text, card.back);
  assert.equal(section.cards[0].prompt, card.front);
  assert.deepEqual(personalSection(section, state), section);
  assert.equal(validateState(JSON.parse(JSON.stringify(state))), true);
});

test("private fields reject incorrect types, collisions, excessive text and unsafe identities", () => {
  assert.equal(validateState(emptyState()), true);
  const state = addPersonalCard(initial(), card);
  for (const bad of [
    null,
    [],
    "cards",
    { x: card },
    { [card.id]: { ...card, front: 5 } },
    { [card.id]: { ...card, back: " " } },
    { [card.id]: { ...card, back: "x".repeat(20_001) } },
    { [card.id]: { ...card, section_id: "02" } },
    { "eje/01.01": { ...card, id: "eje/01.01" } },
  ]) {
    assert.equal(
      validateState({ ...state, created_cards: bad }),
      false,
      JSON.stringify(bad).slice(0, 100),
    );
  }
  for (const bad of [null, {}, [1], [card.id, card.id], ["constructor"], ["clinical/01.01/x/easy"]])
    assert.equal(validateState({ ...state, suspended_cards: bad }), false);
  assert.throws(() => addPersonalCard(initial(), { ...card, id: "eje/01.01" }));
});
