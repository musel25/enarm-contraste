import { useEffect, useMemo, useState } from "react";
import type { StudyManifest, StudySection } from "../library-types";
import { loadSection } from "./resources";
import type { CardFamily, CoachIndex, SessionScope } from "./types";
import { objectiveLabels, isClinicalObjective } from "./objectives";

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
  if (scope.card_ids?.length) parts.push(`${scope.card_ids.length} tarjetas de patrones elegidos`);
  if (scope.objectives?.length)
    parts.push(scope.objectives.map((key) => objectiveLabels[key]).join(", "));
  return parts.join(" · ");
}

/** Chooses the sections, blocks and formats of the next study sessions. */
export default function SessionScopePicker({
  value,
  onChange,
  manifest,
  index,
  showMotherPatterns,
  planFamilies,
}: {
  value: SessionScope;
  onChange: (scope: SessionScope) => void;
  manifest: StudyManifest;
  index: CoachIndex;
  showMotherPatterns: boolean;
  planFamilies: CardFamily[];
}) {
  const [loaded, setLoaded] = useState<Record<string, StudySection>>({});
  const available = manifest.sections.filter((s) =>
    index.cards.some((card) => card.section_id === s.id),
  );
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
  const indexCards = new Set(index.cards.map((card) => card.id));
  const motherPatterns = new Map<string, { label: string; ids: string[] }>();
  for (const id of blockSections) {
    for (const card of loaded[id]?.cards ?? []) {
      if (
        card.family !== "madre" ||
        !card.topic_id ||
        !indexCards.has(card.id) ||
        (value.block_ids.length > 0 && !value.block_ids.includes(card.block_id))
      )
        continue;
      const existing = motherPatterns.get(card.topic_id);
      if (existing) {
        existing.ids.push(card.id);
      } else {
        motherPatterns.set(card.topic_id, {
          label: `${card.topic_id} · ${card.id.startsWith("scenario/") ? card.prompt : card.back[0]?.title || card.prompt}`,
          ids: [card.id],
        });
      }
    }
  }
  const toggle = <T extends string>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const objectives = [
    ...new Set(index.cards.map((card) => card.objective).filter(isClinicalObjective)),
  ];
  return (
    <fieldset className="session-scope">
      <legend>¿Qué quieres estudiar en tus sesiones?</legend>
      <p>Sin elegir nada, la sesión usa todo tu plan. Aplica a temas nuevos y a repasos.</p>
      {!!objectives.length && (
        <div className="session-scope-group" role="group" aria-label="Objetivo de la sesión">
          <span>Objetivo clínico</span>
          {objectives.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={value.objectives?.includes(key) ?? false}
              onClick={() =>
                onChange({ ...value, objectives: toggle(value.objectives ?? [], key) })
              }
            >
              {objectiveLabels[key]}
            </button>
          ))}
        </div>
      )}
      <div className="session-scope-group" role="group" aria-label="Formato de la sesión">
        <span>Formato</span>
        {families
          .filter(([id]) => planFamilies.includes(id))
          .map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={value.families.includes(id)}
              onClick={() =>
                onChange({
                  ...value,
                  families:
                    id === "madre" && value.card_ids?.length
                      ? ["madre"]
                      : toggle(value.families, id),
                  card_ids: undefined,
                })
              }
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
                const card_ids = value.card_ids?.filter((id) =>
                  index.cards.some(
                    (card) => card.id === id && section_ids.includes(card.section_id),
                  ),
                );
                onChange({
                  ...value,
                  section_ids,
                  block_ids: value.block_ids.filter((b) => section_ids.includes(b.slice(0, 2))),
                  card_ids,
                  families: value.card_ids?.length && !card_ids?.length ? [] : value.families,
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
                onClick={() => {
                  const block_ids = toggle(value.block_ids, b.id);
                  const card_ids = block_ids.length
                    ? value.card_ids?.filter((id) =>
                        index.cards.some(
                          (card) => card.id === id && block_ids.includes(card.block_id),
                        ),
                      )
                    : value.card_ids;
                  onChange({
                    ...value,
                    block_ids,
                    card_ids,
                    families: value.card_ids?.length && !card_ids?.length ? [] : value.families,
                  });
                }}
              >
                {b.id}
                {b.title ? ` · ${b.title}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      {showMotherPatterns && !value.section_ids.length && (
        <p>Elige una sección para seleccionar patrones madre específicos.</p>
      )}
      {value.section_ids.length > 3 && (
        <p>Para elegir bloques o patrones madre específicos, deja hasta 3 secciones.</p>
      )}
      {showMotherPatterns && blockSections.length > 0 && motherPatterns.size > 0 && (
        <div className="session-scope-group" role="group" aria-label="Patrones madre específicos">
          <span>Patrones madre específicos</span>
          <div className="session-scope-chips">
            {[...motherPatterns.values()].map((pattern) => {
              const selected = pattern.ids.every((id) => value.card_ids?.includes(id));
              return (
                <button
                  key={pattern.ids[0]}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    const card_ids = selected
                      ? (value.card_ids?.filter((id) => !pattern.ids.includes(id)) ?? [])
                      : [...new Set([...(value.card_ids ?? []), ...pattern.ids])];
                    onChange({
                      ...value,
                      card_ids,
                      families: card_ids.length ? ["madre"] : [],
                    });
                  }}
                >
                  {pattern.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {(value.section_ids.length > 0 ||
        value.families.length > 0 ||
        !!value.card_ids?.length ||
        !!value.objectives?.length) && (
        <button type="button" className="text-button" onClick={() => onChange(emptyScope)}>
          Usar todo mi plan
        </button>
      )}
    </fieldset>
  );
}
