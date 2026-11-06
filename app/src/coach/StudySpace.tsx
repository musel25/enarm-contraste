import { createContext, useContext } from "react";
import type { StudySpace } from "./types";
import { spaceLabels, studySpaces } from "./profile";

const Context = createContext<StudySpace>("capa1");
export const StudySpaceProvider = Context.Provider;
export const useStudySpace = () => useContext(Context);

export const spaceHashes: Record<StudySpace, string> = {
  capa1: "#hoy-capa-1",
  capa2: "#hoy-capa-2",
  creadas1: "#capa-1-creadas",
  creadas2: "#capa-2-creadas",
};
export function spaceFromHash(hash: string): StudySpace {
  const direct = studySpaces.find((space) => spaceHashes[space] === hash);
  const requested = new URLSearchParams(hash.split("?")[1] || "").get("space");
  return direct || studySpaces.find((space) => space === requested) || "capa1";
}
export function openSpace(space: StudySpace, section?: string, family?: string) {
  const route = location.hash.startsWith("#biblioteca")
    ? "#biblioteca"
    : location.hash.startsWith("#avance")
      ? "#avance"
      : spaceHashes[space];
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  params.set("space", space);
  if (section) params.set("section", section);
  if (family) params.set("family", family);
  location.hash =
    route.startsWith("#hoy") || route.includes("creadas") ? route : `${route}?${params}`;
}
export function StudySpaceSelect() {
  const space = useStudySpace();
  return (
    <label className="study-space-select">
      Espacio de estudio
      <select
        aria-label="Espacio de estudio"
        value={space}
        onChange={(event) => openSpace(event.target.value as StudySpace)}
      >
        {studySpaces.map((key) => (
          <option key={key} value={key}>
            {spaceLabels[key]}
          </option>
        ))}
      </select>
    </label>
  );
}
