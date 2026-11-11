import type { StudyCardData, StudySection } from "../library-types";
import type { CardFamily, CoachIndex, CoachState, PersonalCard } from "./types";

export const familyLabels: Record<CardFamily, string> = {
  eje: "Eje Clínico",
  madre: "Patrones Madre",
  creadas: "Creadas",
};
export const personalTextLimit = 20_000;
const uuidId = /^created\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const safeId = (x: unknown): x is string =>
  typeof x === "string" &&
  x.length > 0 &&
  x.length <= 512 &&
  !["__proto__", "prototype", "constructor"].includes(x);
const object = (x: unknown): x is Record<string, unknown> =>
  !!x &&
  typeof x === "object" &&
  !Array.isArray(x) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(x)) &&
  Object.keys(x).every(safeId);
const text = (x: unknown): x is string =>
  typeof x === "string" && x.trim().length > 0 && x.length <= personalTextLimit;

export function validPersonalCard(value: unknown): value is PersonalCard {
  if (
    !object(value) ||
    Object.keys(value)
      .filter((key) => key !== "layer")
      .sort()
      .join(",") !== "back,created_at,front,id,section_id,source_block_id,source_card_id"
  )
    return false;
  return (
    (value.layer === undefined || value.layer === 1 || value.layer === 2) &&
    typeof value.id === "string" &&
    uuidId.test(value.id) &&
    typeof value.section_id === "string" &&
    /^\d{2}$/.test(value.section_id) &&
    safeId(value.source_card_id) &&
    value.source_card_id !== value.id &&
    typeof value.source_block_id === "string" &&
    /^\d{2}\.(?:\d{2}|creadas)$/.test(value.source_block_id) &&
    text(value.front) &&
    text(value.back) &&
    typeof value.created_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.created_at) &&
    Number.isFinite(Date.parse(value.created_at)) &&
    new Date(value.created_at).toISOString() === value.created_at
  );
}

export function validPersonalFields(state: Record<string, unknown>): boolean {
  const cards = state.created_cards;
  if (
    cards !== undefined &&
    (!object(cards) ||
      Object.keys(cards).length > 5_000 ||
      !Object.entries(cards).every(([id, value]) => validPersonalCard(value) && value.id === id))
  )
    return false;
  const suspended = state.suspended_cards;
  return (
    suspended === undefined ||
    (Array.isArray(suspended) &&
      suspended.length <= 20_000 &&
      new Set(suspended).size === suspended.length &&
      suspended.every((id) => safeId(id) && !id.startsWith("clinical/")))
  );
}

export function addPersonalCard(state: CoachState, card: PersonalCard): CoachState {
  if (!validPersonalCard(card)) throw new Error("La flashcard no pasó la comprobación.");
  const previous = state.created_cards?.[card.id];
  if (previous) {
    if ((Object.keys(card) as (keyof PersonalCard)[]).every((key) => previous[key] === card[key]))
      return state;
    throw new Error("Esta flashcard ya existe con otro contenido.");
  }
  if (Object.keys(state.created_cards ?? {}).length >= 5_000)
    throw new Error("Llegaste al límite de 5,000 flashcards creadas.");
  return { ...state, created_cards: { ...state.created_cards, [card.id]: { ...card } } };
}

/** Changes only the text of a saved card. Its ID, section, origin and progress stay unchanged. */
export function editPersonalCard(
  state: CoachState,
  id: string,
  front: unknown,
  back: unknown,
): CoachState {
  const previous =
    safeId(id) && state.created_cards && Object.hasOwn(state.created_cards, id)
      ? state.created_cards[id]
      : undefined;
  if (!previous) throw new Error("Esta flashcard ya no existe.");
  if (!text(front) || !text(back)) throw new Error("Escribe el frente y el reverso.");
  if (previous.front === front && previous.back === back) return state;
  const card = { ...previous, front, back };
  if (!validPersonalCard(card)) throw new Error("La flashcard no pasó la comprobación.");
  return { ...state, created_cards: { ...state.created_cards, [id]: card } };
}

export function setSuspended(state: CoachState, id: string, suspended: boolean): CoachState {
  if (!safeId(id) || id.startsWith("clinical/") || typeof suspended !== "boolean")
    throw new Error("Flashcard no válida.");
  const ids = new Set(state.suspended_cards ?? []);
  if (suspended) ids.add(id);
  else ids.delete(id);
  if (ids.size > 20_000) throw new Error("Llegaste al límite de flashcards suspendidas.");
  return { ...state, suspended_cards: [...ids] };
}

export function personalData(card: PersonalCard): StudyCardData {
  return {
    id: card.id,
    family: "creadas",
    level: 0,
    section_id: card.section_id,
    block_id: `${card.section_id}.creadas`,
    prompt: card.front,
    context: "Flashcard personal · Creadas",
    front: [],
    back: [{ title: "", text: card.back }],
    sources: [{ label: `Creada por ti · Tarjeta de origen: ${card.source_card_id}` }],
  };
}

/** Keeps the published index intact. Repeated overlays never duplicate cards. */
export function personalIndex(index: CoachIndex, state: CoachState): CoachIndex {
  if (state.workspace === "capa1" || state.workspace === "capa2")
    return { ...index, cards: index.cards.filter((card) => card.family !== "creadas") };
  const cards = Object.values(state.created_cards ?? {});
  if (!cards.length && !state.workspace?.startsWith("creadas")) return index;
  const original = state.workspace?.startsWith("creadas")
    ? []
    : index.cards.filter((card) => card.family !== "creadas");
  return {
    ...index,
    cards: [
      ...original,
      ...cards.map((card, i) => ({
        id: card.id,
        family: "creadas" as const,
        section_id: card.section_id,
        block_id: `${card.section_id}.creadas`,
        level: 0,
        order: original.length + i,
        new_seconds: 90,
        review_seconds: 35,
      })),
    ],
  };
}

export function personalSection(section: StudySection, state: CoachState): StudySection {
  if (state.workspace === "capa1" || state.workspace === "capa2") return section;
  const cards = Object.values(state.created_cards ?? {})
    .filter((card) => card.section_id === section.id)
    .map(personalData);
  return {
    ...section,
    blocks: [
      ...(state.workspace ? [] : section.blocks.filter((b) => b.id !== `${section.id}.creadas`)),
      { id: `${section.id}.creadas`, title: "Creadas", topics: cards.length },
    ],
    cards: [
      ...(state.workspace ? [] : section.cards.filter((card) => card.family !== "creadas")),
      ...cards,
    ],
  };
}
