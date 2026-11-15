import type { CoachCard, StudySpace } from "./types";

/** Published layer-one cards retain their IDs when their study space changes. */
export function publishedSpace(id: string): StudySpace {
  if (id.startsWith("capa2/")) return "capa2";
  if (/^madre\/(?:1|4)\//.test(id)) return "capa15";
  if (id.startsWith("scenario/") && !id.endsWith("-ancla")) return "capa15";
  return "capa1";
}

export function cardInSpace(card: Pick<CoachCard, "id" | "family">, space: StudySpace): boolean {
  if (space.startsWith("creadas")) return card.family === "creadas";
  return card.family !== "creadas" && publishedSpace(card.id) === space;
}
