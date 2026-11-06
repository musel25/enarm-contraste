import { emptyState, planKey, validateState } from "./engine";
import { validPersonalFields } from "./personal";
import type { CoachState, PersonalCard, StoredStudyState, StudyProfile, StudySpace } from "./types";

export const studySpaces: StudySpace[] = ["capa1", "capa2", "creadas1", "creadas2"];
export const spaceLabels: Record<StudySpace, string> = {
  capa1: "Hoy-capa 1",
  capa2: "Hoy-capa 2",
  creadas1: "Capa 1 creadas",
  creadas2: "Capa 2 creadas",
};
export const layerOf = (space: StudySpace): 1 | 2 => (space.endsWith("2") ? 2 : 1);
export const isPersonalSpace = (space: StudySpace) => space.startsWith("creadas");
const object = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
  Object.keys(value).every((key) => !["__proto__", "constructor", "prototype"].includes(key));

export function ownerOf(id: string, catalog: Record<string, PersonalCard>): StudySpace {
  const card = catalog[id];
  if (card) return card.layer === 2 ? "creadas2" : "creadas1";
  return id.startsWith("capa2/") ? "capa2" : "capa1";
}

function validOrigin(card: PersonalCard, catalog: Record<string, PersonalCard>) {
  const source = catalog[card.source_card_id];
  const layer = source?.layer ?? (card.source_card_id.startsWith("capa2/") ? 2 : 1);
  return card.layer === layer && (!source || source.section_id === card.section_id);
}

function references(state: CoachState): string[] {
  return [
    ...Object.keys(state.progress),
    ...state.history.map((a) => a.card_id),
    ...(state.suspended_cards ?? []),
    ...Object.keys(state.tags ?? {}),
    ...Object.values(state.days).flatMap((d) => [...d.ids, ...d.extra_ids]),
  ];
}

export function isStudyProfile(value: unknown): value is StudyProfile {
  if (
    !object(value) ||
    value.version !== 2 ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 0 ||
    Object.keys(value).sort().join(",") !== "created_cards,legacy,revision,version,workspaces" ||
    !object(value.workspaces) ||
    Object.keys(value.workspaces).sort().join(",") !== [...studySpaces].sort().join(",") ||
    !object(value.created_cards) ||
    !validPersonalFields({ created_cards: value.created_cards }) ||
    !(value.legacy === null || validateState(value.legacy))
  )
    return false;
  const catalog = value.created_cards as Record<string, PersonalCard>;
  if (
    !Object.values(catalog).every(
      (card) => (card.layer === 1 || card.layer === 2) && validOrigin(card, catalog),
    )
  )
    return false;
  const attempts = new Set<string>();
  const spaces = value.workspaces;
  return studySpaces.every((space) => {
    const state = spaces[space];
    if (
      !validateState(state) ||
      state.created_cards !== undefined ||
      state.workspace !== undefined ||
      references(state).some((id) => ownerOf(id, catalog) !== space) ||
      state.plan?.families.some((family) =>
        isPersonalSpace(space) ? family !== "creadas" : family === "creadas",
      )
    )
      return false;
    for (const attempt of state.history) {
      if (attempts.has(attempt.id)) return false;
      attempts.add(attempt.id);
    }
    return true;
  });
}

export function validStoredState(value: unknown): value is StoredStudyState {
  return isStudyProfile(value) || (validateState(value) && value.workspace === undefined);
}

export function migrateProfile(input: StoredStudyState): StudyProfile {
  if (isStudyProfile(input)) return input;
  if (!validateState(input)) throw new Error("El progreso anterior no pasó la comprobación.");
  const original = structuredClone(input);
  const catalog = Object.fromEntries(
    Object.entries(original.created_cards ?? {}).map(([id, card]) => [
      id,
      { ...card, layer: 1 as const },
    ]),
  );
  const workspaces = Object.fromEntries(
    studySpaces.map((space) => [space, emptyState()]),
  ) as StudyProfile["workspaces"];
  for (const space of ["capa1", "creadas1"] as const) {
    const own = (id: string) => ownerOf(id, catalog) === space;
    const personal = isPersonalSpace(space);
    const derivedId = `creadas1/${original.plan?.id.slice(0, 128) || "plan"}`;
    const plan = original.plan
      ? {
          ...original.plan,
          id: personal
            ? derivedId === original.plan.id
              ? `${derivedId}/migrado`
              : derivedId
            : original.plan.id,
          families: personal
            ? ["creadas" as const]
            : original.plan.families.filter((f) => f !== "creadas"),
          created_cards_enabled: personal,
        }
      : null;
    const state: CoachState = {
      ...emptyState(),
      plan,
      progress: Object.fromEntries(Object.entries(original.progress).filter(([id]) => own(id))),
      history: original.history.filter((attempt) => own(attempt.card_id)),
      tags: Object.fromEntries(Object.entries(original.tags ?? {}).filter(([id]) => own(id))),
      suspended_cards: (original.suspended_cards ?? []).filter(own),
      preferences: {
        ...original.preferences,
        ...(personal
          ? {
              session_scope: {
                section_ids: original.preferences.session_scope?.section_ids ?? [],
                block_ids: [],
                families: ["creadas" as const],
              },
            }
          : {}),
      },
      day_loads: original.day_loads,
      sessions: [],
      celebrated_days: personal ? [] : original.celebrated_days,
      celebrated_plans: personal ? [] : original.celebrated_plans,
      undo:
        original.undo && original.history.at(-1) && own(original.history.at(-1)!.card_id)
          ? original.undo
          : null,
      days: Object.fromEntries(
        Object.entries(original.days).map(([day, assignment]) => {
          const ids = assignment.ids.filter(own),
            extra = assignment.extra_ids.filter(own);
          const all = new Set([...ids, ...extra]);
          const cost = (list: string[]) => list.reduce((sum, id) => sum + assignment.costs[id], 0);
          const totalCost = cost([...assignment.ids, ...assignment.extra_ids]);
          const share = totalCost ? cost([...all]) / totalCost : personal ? 0 : 1;
          return [
            day,
            {
              ...assignment,
              plan_key: plan ? planKey(plan) : assignment.plan_key,
              ids,
              new_ids: assignment.new_ids.filter(own),
              extra_ids: extra,
              costs: Object.fromEntries(
                Object.entries(assignment.costs).filter(([id]) => all.has(id)),
              ),
              budget_seconds: assignment.budget_seconds * share,
            },
          ];
        }),
      ),
    };
    workspaces[space] = state;
  }
  const profile: StudyProfile = {
    version: 2,
    revision: original.revision,
    workspaces,
    created_cards: catalog,
    legacy: {
      ...emptyState(),
      plan: original.plan,
      days: original.days,
      sessions: original.sessions,
      preferences: original.preferences,
      celebrated_days: original.celebrated_days,
      celebrated_plans: original.celebrated_plans,
    },
  };
  if (!isStudyProfile(profile))
    throw new Error("No se pudo separar el progreso. Conserva la copia anterior.");
  return profile;
}

export function spaceState(profile: StudyProfile, space: StudySpace): CoachState {
  return {
    ...profile.workspaces[space],
    revision: profile.revision,
    workspace: space,
    created_cards: Object.fromEntries(
      Object.entries(profile.created_cards).filter(([, card]) => card.layer === layerOf(space)),
    ),
  };
}

export function updateSpace(
  profile: StudyProfile,
  space: StudySpace,
  next: CoachState,
): StudyProfile {
  if (!validateState(next) || next.workspace !== space || next.revision !== profile.revision)
    throw new Error("El espacio de estudio cambió. Recarga tu progreso.");
  const catalog = { ...profile.created_cards };
  for (const [id, card] of Object.entries(next.created_cards ?? {})) {
    const normalized = { ...card, layer: card.layer ?? layerOf(space) };
    if (
      normalized.layer !== layerOf(space) ||
      !validOrigin(normalized, { ...catalog, ...next.created_cards })
    )
      throw new Error("La flashcard no pertenece a esta capa.");
    if (catalog[id] && JSON.stringify(catalog[id]) !== JSON.stringify(normalized))
      throw new Error("No se puede reemplazar una flashcard guardada.");
    catalog[id] = normalized;
  }
  const { workspace: _space, created_cards: _cards, ...stored } = next;
  const result: StudyProfile = {
    ...profile,
    created_cards: catalog,
    workspaces: { ...profile.workspaces, [space]: { ...stored, revision: 0 } },
  };
  if (!isStudyProfile(result)) throw new Error("El espacio de estudio no pasó la comprobación.");
  return result;
}
