import { useEffect, useMemo, useState } from "react";
import type { StudyManifest, StudySection } from "../library-types";
import { loadSection } from "./resources";
import type { CardFamily, CoachIndex, SessionScope } from "./types";

export const emptyScope: SessionScope = { section_ids: [], block_ids: [], families: [] };
const families = [
  ["eje", "Ejes clínicos"],
  ["madre", "Patrones madre"],
  ["creadas", "Creadas"],
] as const;

/** A short text for the active session filter, for example «Cardiología · Patrones madre». */
export function scopeLabel(scope: SessionScope, manifest: StudyManifest): string {
  const parts: string[] = [];
  if (scope.section_ids.length)
    parts.push(
      scope.section_ids
        .map((id) => manifest.sections.find((s) => s.id === id)?.title || id)
        .join(", "),
    );
  if (scope.block_ids.length)
    parts.push(`${scope.block_ids.length} ${scope.block_ids.length === 1 ? "bloque" : "bloques"}`);
  if (scope.families.length)
    parts.push(
      scope.families.map((id) => families.find(([key]) => key === id)?.[1] || id).join(", "),
    );
  return parts.join(" · ");
}

/** Chooses the sections, blocks and formats of the next study sessions. */
export default function SessionScopePicker({
  value,
  onChange,
  manifest,
  index,
  sectionIds,
  planFamilies,
}: {
  value: SessionScope;
  onChange: (scope: SessionScope) => void;
  manifest: StudyManifest;
  index: CoachIndex;
  sectionIds: string[];
  planFamilies: CardFamily[];
}) {
  const [loaded, setLoaded] = useState<Record<string, StudySection>>({});
  const available = manifest.sections.filter((s) => sectionIds.includes(s.id));
  // Blocks appear for the chosen sections. Titles come from the section files.
  const blockSections =
    value.section_ids.length && value.section_ids.length <= 3 ? value.section_ids : [];
  useEffect(() => {
    const missing = blockSections.filter((id) => !loaded[id]);
    if (!missing.length) return;
    let active = true;
    Promise.all(missing.map((id) => loadSection(id, index.content_sha256)))
      .then((list) => {
        if (active)
          setLoaded((old) => ({ ...old, ...Object.fromEntries(list.map((s) => [s.id, s])) }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [blockSections.join(","), index.content_sha256]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocks = useMemo(
    () =>
      blockSections.flatMap(
        (id) =>
          loaded[id]?.blocks.map((block) => ({ ...block, section_id: id })) ??
          [...new Set(index.cards.filter((c) => c.section_id === id).map((c) => c.block_id))].map(
            (block) => ({ id: block, title: "", topics: 0, section_id: id }),
          ),
      ),
    [blockSections.join(","), loaded, index],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const scopeBlocks = [
    ...blocks.filter((b) => !b.id.endsWith(".creadas")),
    ...blockSections.map((id) => ({
      id: `${id}.creadas`,
      title: "Creadas",
      topics: 0,
      section_id: id,
    })),
  ].filter((block) => index.cards.some((card) => card.block_id === block.id));
  const toggle = <T extends string>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  return (
    <fieldset className="session-scope">
      <legend>¿Qué quieres estudiar en tus sesiones?</legend>
      <p>Sin elegir nada, la sesión usa todo tu plan. Aplica a temas nuevos y a repasos.</p>
      <div className="session-scope-group" role="group" aria-label="Formato de la sesión">
        <span>Formato</span>
        {families
          .filter(([id]) => planFamilies.includes(id))
          .map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={value.families.includes(id)}
              onClick={() => onChange({ ...value, families: toggle(value.families, id) })}
            >
              {label}
            </button>
          ))}
      </div>
      <div className="session-scope-group" role="group" aria-label="Secciones de la sesión">
        <span>
          Secciones{" "}
          <small>
            {value.section_ids.length ? `${value.section_ids.length} elegidas` : "Todas"}
          </small>
        </span>
        <div className="session-scope-chips">
          {available.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={value.section_ids.includes(s.id)}
              onClick={() => {
                const section_ids = toggle(value.section_ids, s.id);
                onChange({
                  ...value,
                  section_ids,
                  block_ids: value.block_ids.filter((b) => section_ids.includes(b.slice(0, 2))),
                });
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>
      {blockSections.length > 0 && (
        <div className="session-scope-group" role="group" aria-label="Bloques de la sesión">
          <span>
            Bloques{" "}
            <small>
              {value.block_ids.length
                ? `${value.block_ids.length} elegidos`
                : "Todos los bloques de esas secciones"}
            </small>
          </span>
          <div className="session-scope-chips">
            {scopeBlocks.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={value.block_ids.includes(b.id)}
                onClick={() => onChange({ ...value, block_ids: toggle(value.block_ids, b.id) })}
              >
                {b.id}
                {b.title ? ` · ${b.title}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      {value.section_ids.length > 3 && <p>Para elegir bloques, deja hasta 3 secciones.</p>}
      {(value.section_ids.length > 0 || value.families.length > 0) && (
        <button type="button" className="text-button" onClick={() => onChange(emptyScope)}>
          Usar todo mi plan
        </button>
      )}
    </fieldset>
  );
}
