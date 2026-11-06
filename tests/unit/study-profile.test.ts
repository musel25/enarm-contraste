import assert from "node:assert/strict";
import test from "node:test";
import { emptyState, recordStudy, selectedCards, validateState } from "../../app/src/coach/engine";
import { addPersonalCard, personalIndex } from "../../app/src/coach/personal";
import {
  isStudyProfile,
  migrateProfile,
  personalOriginsMatchIndex,
  spaceState,
  updateSpace,
} from "../../app/src/coach/profile";
import type { CoachIndex, PersonalCard } from "../../app/src/coach/types";

const day = "2026-11-06";
const personal: PersonalCard = {
  id: "created/6a9121c5-fc78-453b-90a7-d265eed8a90e",
  section_id: "01",
  source_card_id: "eje/01.01",
  source_block_id: "01.01",
  front: "Pregunta propia",
  back: "Respuesta propia",
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
function legacy() {
  let state = addPersonalCard(emptyState(), personal);
  state.plan = {
    id: "plan",
    revision: 1,
    mode: "time",
    start_day: day,
    deadline_day: null,
    minutes_per_day: 10,
    section_ids: ["01"],
    families: ["eje", "creadas"],
    timezone: "UTC",
  };
  state = recordStudy(state, index, "eje/01.01", 3, 20, day, "published-attempt");
  state = recordStudy(state, index, personal.id, 2, 25, day, "personal-attempt");
  state.tags = { [personal.id]: { deepen: true }, "eje/01.01": { order: 2 } };
  state.suspended_cards = [personal.id];
  state.sessions = [
    {
      id: "mixed-session",
      day,
      kind: "new",
      started_at: `${day}T12:00:00.000Z`,
      wall_seconds: 60,
      active_seconds: 45,
      cards: 2,
      target_seconds: 300,
    },
  ];
  state.revision = 9;
  assert.equal(validateState(state), true);
  return state;
}

test("migration splits all existing attempts without modifying memory or identities", () => {
  const before = legacy();
  const preserved = structuredClone(before);
  const profile = migrateProfile(before);
  assert.equal(isStudyProfile(profile), true);
  assert.deepEqual(before, preserved);
  assert.equal(profile.revision, before.revision);
  assert.deepEqual(profile.workspaces.capa1.progress["eje/01.01"], before.progress["eje/01.01"]);
  assert.deepEqual(profile.workspaces.creadas1.progress[personal.id], before.progress[personal.id]);
  assert.equal(profile.created_cards[personal.id].layer, 1);
  assert.deepEqual(
    profile.workspaces.capa1.history.map((a) => a.id),
    ["published-attempt"],
  );
  assert.deepEqual(
    profile.workspaces.creadas1.history.map((a) => a.id),
    ["personal-attempt"],
  );
  assert.deepEqual(profile.workspaces.capa2.history, []);
  assert.deepEqual(profile.workspaces.creadas2.history, []);
  assert.deepEqual(profile.workspaces.creadas1.undo, before.undo);
  assert.equal(profile.workspaces.capa1.undo, null);
  assert.deepEqual(profile.workspaces.creadas1.suspended_cards, [personal.id]);
  assert.deepEqual(profile.legacy?.days, before.days);
  assert.deepEqual(profile.legacy?.sessions, before.sessions);
  assert.deepEqual(profile.workspaces.capa1.sessions, []);
  assert.deepEqual(profile.workspaces.creadas1.sessions, []);
  assert.deepEqual(migrateProfile(profile), profile);
  assert.equal(isStudyProfile(JSON.parse(JSON.stringify(profile))), true);
});

test("migration partitions daily assignments, tags and costs without duplicating time", () => {
  const before = legacy();
  const profile = migrateProfile(before);
  const first = profile.workspaces.capa1.days[day];
  const created = profile.workspaces.creadas1.days[day];
  assert.deepEqual([...first.ids, ...first.extra_ids], ["eje/01.01"]);
  assert.deepEqual([...created.ids, ...created.extra_ids], [personal.id]);
  assert.equal(first.budget_seconds + created.budget_seconds, before.days[day].budget_seconds);
  assert.deepEqual(profile.workspaces.creadas1.tags, { [personal.id]: { deepen: true } });
  assert.notEqual(profile.workspaces.capa1.plan?.id, profile.workspaces.creadas1.plan?.id);
  assert.deepEqual(profile.workspaces.creadas1.plan?.families, ["creadas"]);
  assert.equal(profile.workspaces.capa1.plan?.created_cards_enabled, false);
});

test("published spaces cannot schedule private cards while created spaces can", () => {
  const profile = migrateProfile(legacy());
  profile.workspaces.creadas1.suspended_cards = [];
  const published = spaceState(profile, "capa1");
  const created = spaceState(profile, "creadas1");
  assert.deepEqual(
    personalIndex(index, published).cards.map((c) => c.id),
    ["eje/01.01"],
  );
  assert.deepEqual(
    personalIndex(index, created).cards.map((c) => c.id),
    [personal.id],
  );
  assert.deepEqual(
    selectedCards(index, published.plan!, published).map((c) => c.id),
    ["eje/01.01"],
  );
  assert.deepEqual(
    selectedCards(index, created.plan!, created).map((c) => c.id),
    [personal.id],
  );
});

test("a confirmed space change preserves other spaces and derives personal ownership", () => {
  const before = migrateProfile(legacy());
  const selected = spaceState(before, "capa2");
  const newCard = {
    ...personal,
    id: "created/1a9121c5-fc78-453b-90a7-d265eed8a90e",
    source_card_id: "capa2/eje/01.01",
    layer: 2 as const,
  };
  const next = updateSpace(before, "capa2", addPersonalCard(selected, newCard));
  assert.equal(isStudyProfile(next), true);
  assert.deepEqual(next.workspaces.capa1, before.workspaces.capa1);
  assert.deepEqual(next.workspaces.creadas1, before.workspaces.creadas1);
  assert.equal(next.workspaces.capa2.created_cards, undefined);
  assert.equal(next.created_cards[newCard.id].layer, 2);
  assert.equal(spaceState(next, "capa1").created_cards?.[newCard.id], undefined);
  assert.equal(spaceState(next, "creadas2").created_cards?.[newCard.id]?.front, personal.front);
  assert.throws(() =>
    updateSpace(before, "capa1", addPersonalCard(spaceState(before, "capa1"), newCard)),
  );
});

test("migration retains unknown historic IDs and does not invent a new plan", () => {
  const state = emptyState();
  state.progress["removed-source/card"] = {
    card: null,
    due_day: day,
    introduced_day: "",
    last_rating: null,
    imported: true,
  };
  const profile = migrateProfile(state);
  assert.deepEqual(profile.workspaces.capa1.progress, state.progress);
  assert.equal(profile.workspaces.capa1.plan, null);
  assert.equal(profile.workspaces.creadas1.plan, null);
  assert.equal(profile.workspaces.capa2.plan, null);
});

test("migration removes private-only session filters from the published space", () => {
  for (const scope of [
    { section_ids: ["01"], block_ids: ["01.creadas"], families: ["creadas" as const] },
    {
      section_ids: ["01"],
      block_ids: ["01.01", "01.creadas"],
      families: ["eje" as const, "creadas" as const],
    },
  ]) {
    const before = legacy();
    before.preferences.session_scope = scope;
    const profile = migrateProfile(before);
    assert.deepEqual(profile.workspaces.capa1.preferences.session_scope, {
      section_ids: ["01"],
      block_ids: scope.block_ids.filter((id) => !id.endsWith(".creadas")),
      families: scope.families.filter((family) => family !== "creadas"),
    });
    assert.deepEqual(profile.workspaces.creadas1.preferences.session_scope, {
      section_ids: ["01"],
      block_ids: [],
      families: ["creadas"],
    });
    assert.deepEqual(profile.legacy?.preferences.session_scope, scope);
    assert.deepEqual(profile.workspaces.capa1.progress["eje/01.01"], before.progress["eje/01.01"]);
  }
});

test("migration keeps legacy IDs that match inherited object property names", () => {
  const state = legacy();
  state.progress = {
    ...state.progress,
    ...Object.fromEntries([
      [
        "toString",
        { card: null, due_day: day, introduced_day: "", last_rating: null, imported: true },
      ],
    ]),
  };
  state.created_cards![personal.id].source_card_id = "toString";
  assert.equal(validateState(state), true);
  const profile = migrateProfile(state);
  assert.deepEqual(profile.workspaces.capa1.progress.toString, state.progress.toString);
  assert.equal(Object.hasOwn(profile.workspaces.creadas1.progress, "toString"), false);
  assert.equal(isStudyProfile(profile), true);
});

test("a legacy personal-only plan moves to created cards without an empty published plan", () => {
  const state = legacy();
  state.plan!.families = ["creadas"];
  const profile = migrateProfile(state);
  assert.equal(profile.workspaces.capa1.plan, null);
  assert.deepEqual(profile.workspaces.creadas1.plan?.families, ["creadas"]);
  assert.deepEqual(profile.legacy?.plan, state.plan);
  assert.deepEqual(profile.workspaces.capa1.progress, { "eje/01.01": state.progress["eje/01.01"] });
});

test("newly reserved layer-2 prefixes do not erase unknown version-1 history", () => {
  const id = "capa2/unknown-legacy-card";
  const extended: CoachIndex = {
    ...index,
    cards: [...index.cards, { ...index.cards[0], id, order: 1 }],
  };
  let state = recordStudy(legacy(), extended, id, 3, 30, day, "legacy-reserved-prefix");
  state.created_cards![personal.id] = {
    ...state.created_cards![personal.id],
    source_card_id: "capa2/unknown-legacy-source",
  };
  assert.equal(validateState(state), true);
  const profile = migrateProfile(state);
  assert.deepEqual(profile.workspaces.capa1.progress[id], state.progress[id]);
  assert.equal(profile.workspaces.capa1.history.at(-1)!.id, "legacy-reserved-prefix");
  assert.equal(profile.workspaces.capa2.history.length, 0);
  assert.equal(profile.created_cards[personal.id].layer, 1);
  assert.equal(isStudyProfile(profile), true);
  const selected = spaceState(profile, "capa1");
  const next = updateSpace(profile, "capa1", {
    ...selected,
    preferences: { ...selected.preferences, sound: true },
  });
  assert.deepEqual(next.workspaces.capa1.progress[id], state.progress[id]);
});

test("migration accepts a legacy plan ID at the existing maximum length", () => {
  const state = legacy();
  state.plan!.id = "p".repeat(512);
  assert.equal(validateState(state), true);
  const profile = migrateProfile(state);
  assert.equal(isStudyProfile(profile), true);
  assert.equal(profile.workspaces.capa1.plan!.id, state.plan!.id);
  assert.notEqual(profile.workspaces.creadas1.plan!.id, state.plan!.id);
});

test("profile validation rejects malformed types, workspace mixing and incorrect origins", () => {
  const profile = migrateProfile(legacy());
  for (const bad of [
    null,
    [],
    { ...profile, revision: "9" },
    { ...profile, workspaces: { ...profile.workspaces, capa2: null } },
    { ...profile, workspaces: { ...profile.workspaces, extra: emptyState() } },
    { ...profile, created_cards: { [personal.id]: { ...personal, layer: "1" } } },
    { ...profile, created_cards: { [personal.id]: { ...personal, layer: 2 } } },
    { ...profile, workspaces: { ...profile.workspaces, capa2: profile.workspaces.capa1 } },
  ])
    assert.equal(isStudyProfile(bad), false);
});

test("native personal origins reject missing parents, cross-block sources and cycles", () => {
  const base = migrateProfile(emptyState());
  const first = { ...personal, layer: 1 as const };
  const second = {
    ...first,
    id: "created/1a9121c5-fc78-453b-90a7-d265eed8a90e",
    source_card_id: first.id,
    source_block_id: "01.creadas",
  };
  assert.equal(
    isStudyProfile({ ...base, created_cards: { [first.id]: first, [second.id]: second } }),
    true,
  );
  for (const change of [
    { source_card_id: "eje/does-not-exist" },
    { source_block_id: "01.99" },
    { source_card_id: "eje/02.01" },
    { source_card_id: second.id, source_block_id: "01.creadas" },
  ]) {
    const profile = { ...base, created_cards: { [first.id]: { ...first, ...change } } };
    assert.equal(isStudyProfile(profile), false);
  }
  const cycle = {
    ...base,
    created_cards: {
      [first.id]: { ...first, source_card_id: second.id, source_block_id: "01.creadas" },
      [second.id]: second,
    },
  };
  assert.equal(isStudyProfile(cycle), false);
});

test("migration preserves pre-existing personal source relationships accepted by version one", () => {
  const before = legacy();
  before.created_cards![personal.id].source_block_id = "01.99";
  assert.equal(validateState(before), true);
  const profile = migrateProfile(before);
  assert.equal(isStudyProfile(profile), true);
  assert.equal(profile.created_cards[personal.id].source_block_id, "01.99");
});

test("native origins resolve to the published inventory through personal parent chains", () => {
  const profile = migrateProfile(emptyState());
  const first = { ...personal, layer: 1 as const };
  const second = {
    ...first,
    id: "created/1a9121c5-fc78-453b-90a7-d265eed8a90e",
    source_card_id: first.id,
    source_block_id: "01.creadas",
  };
  profile.created_cards = { [first.id]: first, [second.id]: second };
  assert.equal(isStudyProfile(profile), true);
  assert.equal(personalOriginsMatchIndex(profile, 1, index), true);
  profile.created_cards[first.id] = {
    ...first,
    source_card_id: "eje/01.99",
    source_block_id: "01.99",
  };
  assert.equal(isStudyProfile(profile), true);
  assert.equal(personalOriginsMatchIndex(profile, 1, index), false);
  const migrated = migrateProfile(legacy());
  assert.equal(personalOriginsMatchIndex(migrated, 1, { ...index, cards: [] }), true);
});
