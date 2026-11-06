import { useEffect, useMemo, useState } from "react";
import type { StudyCardData, StudyManifest, StudySection } from "../library-types";
import type { ReviewContext } from "../storage";
import { createAssignment, estimatePlan, isError, recordPractice, setTag } from "../coach/engine";
import { personalIndex, personalSection } from "../coach/personal";
import { dateLabel, duration, timezone } from "../coach/format";
import { useCoachStore, useStudyDay } from "../coach/hooks";
import { loadResources, loadSection } from "../coach/resources";
import { downloadBackup } from "../coach/storage";
import type { CoachIndex, QuestionOrder } from "../coach/types";
import { DayDetail, HeatLegend, Heatmap } from "../coach/Calendar";
import { orderLabels } from "../coach/CardTags";
import { slowCards, studyRange } from "../coach/insights";
import { caseMeta, completionNotices, progressRows, topicErrors, type ProgressRow } from "./model";
import { clinicalCases, difficultyLabels, type Difficulty } from "./cases";
import TestSession, { type TestQuestion } from "./TestSession";
import "../library.css";
import "../coach/coach.css";
import "../coach/today.css";
import "./learning.css";

const date = (value: string | null) => (value ? dateLabel(value) : "Sin iniciar");
type Pattern = "creadas" | "eje" | "m1" | "m2" | "m3" | "m4";
const patterns: { id: Pattern; label: string }[] = [
  { id: "creadas", label: "Creadas" },
  { id: "eje", label: "Comparar casos (Eje Clínico)" },
  { id: "m1", label: "Reconocer el patrón" },
  { id: "m2", label: "Decir el diagnóstico" },
  { id: "m3", label: "Explicar los hallazgos" },
  { id: "m4", label: "Decidir el manejo" },
];
const patternOf = (card: Pick<StudyCardData, "family" | "level">): Pattern =>
  card.family === "creadas"
    ? "creadas"
    : card.family === "eje"
      ? "eje"
      : (`m${card.level}` as Pattern);
const patternName = (card: Pick<StudyCardData, "family" | "level">) =>
  card.family === "creadas"
    ? "Creadas"
    : card.family === "eje"
      ? "Eje Clínico"
      : `Patrones Madre ${card.level}`;
type Status = "all" | "errors" | "due" | "deepen" | "new" | "practiced";
const statuses: { id: Status; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "errors", label: "Con errores" },
  { id: "due", label: "Repaso pendiente" },
  { id: "deepen", label: "Para profundizar" },
  { id: "new", label: "Sin practicar" },
  { id: "practiced", label: "Ya practicadas" },
];
const VISIBLE = 300;

function cardLabel(card: StudyCardData, section: StudySection) {
  const topic = card.topic_id
    ? section.cards
        .find((c) => c.family === "eje" && c.block_id === card.block_id)
        ?.back.find((row) => row.topic_id === card.topic_id)?.title
    : null;
  return `${patternName(card)} · ${card.block_id} · ${topic || card.prompt}`;
}
function Counts({ row }: { row: ProgressRow }) {
  return (
    <>
      <span>
        <strong>
          {row.practiced} de {row.total}
        </strong>{" "}
        flashcards practicadas · {row.remaining} pendientes
      </span>
      <progress
        aria-label={`Primera vuelta ${row.id}`}
        value={row.practiced}
        max={row.total || 1}
      />
      <small>
        {row.attempts} respuestas · {row.errors} {row.errors === 1 ? "error" : "errores"} ·{" "}
        {row.difficult} difíciles
        {row.first_reads
          ? ` · ${row.first_reads} ${row.first_reads === 1 ? "primera lectura" : "primeras lecturas"}`
          : ""}
      </small>
      <small>
        Inicio: {date(row.started)} · Próximo repaso:{" "}
        {row.next_due ? date(row.next_due) : "Después de practicar"}
      </small>
      {row.clinical_practiced > 0 && (
        <small>{row.clinical_practiced} casos diagnósticos practicados</small>
      )}
      {row.due > 0 && <small className="learning-due">{row.due} repasos para hoy o vencidos</small>}
    </>
  );
}
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function Learning({
  suspended,
  onReview,
}: {
  suspended: boolean;
  onReview: (context: ReviewContext) => void;
}) {
  const store = useCoachStore();
  const { state } = store;
  const day = useStudyDay(state.plan?.timezone || timezone());
  const [baseResources, setResources] = useState<{
    manifest: StudyManifest;
    index: CoachIndex;
  } | null>(null);
  const resources = useMemo(
    () =>
      baseResources ? { ...baseResources, index: personalIndex(baseResources.index, state) } : null,
    [baseResources, state.created_cards],
  );
  const [loadError, setLoadError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const [sectionId, setSectionId] = useState(params.get("section") || "");
  const [scope, setScope] = useState<string[]>(
    params.get("section") ? [params.get("section")!] : [],
  );
  const [blocks, setBlocks] = useState<string[]>(params.get("block") ? [params.get("block")!] : []);
  const [kind, setKind] = useState<"cards" | "cases">(
    params.get("mode") === "cases" ? "cases" : "cards",
  );
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("easy");
  const [chosenPatterns, setPatterns] = useState<Pattern[]>([]);
  const [order, setOrder] = useState<"all" | "none" | `${QuestionOrder}`>("all");
  const [status, setStatus] = useState<Status>("all");
  const [limit, setLimit] = useState(0),
    [mixed, setMixed] = useState(false);
  const [loadedSections, setSections] = useState<Record<string, StudySection>>({});
  const sections = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(loadedSections).map(([id, section]) => [
          id,
          personalSection(section, state),
        ]),
      ),
    [loadedSections, state.created_cards],
  );
  const [sectionError, setSectionError] = useState(""),
    [sectionAttempt, setSectionAttempt] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [test, setTest] = useState<TestQuestion[] | null>(null);
  const [historyDay, setHistoryDay] = useState(day);
  useEffect(() => setHistoryDay(day), [day]);
  useEffect(() => {
    const abort = new AbortController();
    setLoadError("");
    loadResources(abort.signal)
      .then((data) => {
        if (abort.signal.aborted) return;
        setResources(data);
        const first = data.manifest.sections.some((s) => s.id === sectionId)
          ? sectionId
          : data.manifest.sections[0].id;
        setSectionId(first);
        setScope((old) =>
          old.length
            ? old.filter((id) => data.manifest.sections.some((s) => s.id === id))
            : [first],
        );
      })
      .catch((error) => {
        if (!abort.signal.aborted) setLoadError((error as Error).message);
      });
    return () => abort.abort();
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const slow = useMemo(
    () => (resources ? slowCards(state, resources.index) : []),
    [state, resources],
  );
  const deepen = useMemo(
    () =>
      Object.entries(state.tags ?? {})
        .filter(([, tag]) => tag.deepen)
        .map(([id]) => id),
    [state.tags],
  );
  // Load every section that the builder or the lists need.
  const needed = useMemo(() => {
    const sectionOf = (id: string) =>
      resources?.index.cards.find((c) => c.id === id)?.section_id ?? caseMeta(id)?.section_id;
    return [
      ...new Set([
        ...scope,
        sectionId,
        ...[...slow.map((s) => s.id), ...deepen].map(sectionOf).filter((id): id is string => !!id),
      ]),
    ]
      .filter(Boolean)
      .sort();
  }, [scope, sectionId, slow, deepen, resources]);
  useEffect(() => {
    if (!resources) return;
    const missing = needed.filter((id) => !sections[id]);
    if (!missing.length) return;
    let active = true;
    setSectionError("");
    Promise.all(missing.map((id) => loadSection(id, resources.index.content_sha256)))
      .then((loaded) => {
        if (active)
          setSections((old) => ({
            ...old,
            ...Object.fromEntries(loaded.map((section) => [section.id, section])),
          }));
      })
      .catch((error) => {
        if (active) setSectionError((error as Error).message);
      });
    return () => {
      active = false;
    };
  }, [resources, needed, sectionAttempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const analytics = useMemo(
    () => (resources ? progressRows(state, resources.index, day) : null),
    [state, resources, day],
  );
  const errorIds = useMemo(
    () => new Set(state.history.filter(isError).map((item) => item.card_id)),
    [state.history],
  );
  const ready = scope.length > 0 && scope.every((id) => sections[id]);
  const singleSection = scope.length === 1 ? sections[scope[0]] : null;
  const questions = useMemo<TestQuestion[]>(() => {
    if (!ready) return [];
    const keep = (id: string) => {
      if (state.suspended_cards?.includes(id)) return false;
      const tag = state.tags?.[id];
      if (order === "none" ? tag?.order : order !== "all" && tag?.order !== Number(order))
        return false;
      if (status === "errors") return errorIds.has(id);
      if (status === "due") return !!state.progress[id] && state.progress[id].due_day <= day;
      if (status === "deepen") return !!tag?.deepen;
      if (status === "new") return !state.progress[id];
      if (status === "practiced") return !!state.progress[id];
      return true;
    };
    const inBlock = (block: string) => !singleSection || !blocks.length || blocks.includes(block);
    return scope.flatMap((id): TestQuestion[] => {
      const section = sections[id];
      return kind === "cards"
        ? section.cards
            .filter(
              (card) =>
                inBlock(card.block_id) &&
                (!chosenPatterns.length || chosenPatterns.includes(patternOf(card))) &&
                keep(card.id),
            )
            .map((card) => ({ id: card.id, label: cardLabel(card, section), card }))
        : clinicalCases(section)
            .filter(
              (item) =>
                inBlock(item.block_id) &&
                (difficulty === "all" || item.difficulty === difficulty) &&
                keep(item.id),
            )
            .map((clinical) => ({
              id: clinical.id,
              label: `${clinical.diagnosis} · ${difficultyLabels[clinical.difficulty]}`,
              clinical,
            }));
    });
  }, [
    ready,
    scope,
    sections,
    singleSection,
    blocks,
    kind,
    chosenPatterns,
    difficulty,
    order,
    status,
    state,
    errorIds,
    day,
  ]);
  if (loadError)
    return (
      <main id="study" className="learning-main">
        <div role="alert">
          <h1>No se pudo cargar tu avance.</h1>
          <p>{loadError}</p>
          <button onClick={() => setAttempt((old) => old + 1)}>Reintentar carga</button>
        </div>
      </main>
    );
  if (!resources || !analytics || store.loading)
    return (
      <main id="study" className="learning-main" role="status">
        Abriendo tu avance…
      </main>
    );
  const { manifest, index } = resources;
  const disabled = suspended || store.saving;
  const section = sections[sectionId];
  const activeRow = analytics.sections.find((row) => row.id === sectionId);
  const errors = topicErrors(state, index).filter(
    (item) =>
      scope.includes(item.section_id) &&
      (!singleSection || !blocks.length || blocks.includes(item.block_id)),
  );
  const cases = singleSection ? clinicalCases(singleSection) : [];
  const labelFor = (id: string) =>
    cases.find((item) => item.topic_id === id)?.diagnosis ||
    (id.startsWith("block:") ? `Bloque ${id.slice(6)} · respuesta conjunta` : id);
  const sectionTitle = (id: string) => manifest.sections.find((s) => s.id === id)?.title || id;
  const clear = () => setSelected(new Set());
  const changeSection = (id: string) => {
    setSectionId(id);
    setScope([id]);
    setBlocks([]);
    clear();
  };
  const toggleScope = (id: string) => {
    setScope((old) => (old.includes(id) ? old.filter((x) => x !== id) : [...old, id].sort()));
    setBlocks([]);
    clear();
  };
  const questionFor = (id: string): TestQuestion | null => {
    if (state.suspended_cards?.includes(id)) return null;
    const meta = index.cards.find((card) => card.id === id) || caseMeta(id);
    const data = meta && sections[meta.section_id];
    if (!meta || !data) return null;
    if (id.startsWith("clinical/")) {
      const clinical = clinicalCases(data).find((item) => item.id === id);
      return clinical
        ? {
            id,
            label: `${clinical.diagnosis} · ${difficultyLabels[clinical.difficulty]}`,
            clinical,
          }
        : null;
    }
    const card = data.cards.find((item) => item.id === id);
    return card ? { id, label: cardLabel(card, data), card } : null;
  };
  const listTest = (ids: string[]) => {
    const list = ids.map(questionFor).filter((q): q is TestQuestion => !!q);
    if (list.length) setTest(list);
  };
  const milestoneText = (notice: { kind: "block" | "section"; id: string }) =>
    notice.kind === "block"
      ? `Bloque completo: ${sections[notice.id.slice(0, 2)]?.blocks.find((b) => b.id === notice.id)?.title || notice.id}. Practicaste todas sus flashcards.`
      : `Sección completa: ${sectionTitle(notice.id)}. Primera vuelta terminada.`;
  function start() {
    let list = questions.filter((q) => selected.has(q.id));
    if (mixed) list = shuffle(list);
    const tags = state.tags ?? {};
    list = [...list.filter((q) => !tags[q.id]?.later), ...list.filter((q) => tags[q.id]?.later)];
    if (limit > 0) list = list.slice(0, limit);
    setTest(list);
  }
  const range = studyRange(state, day);
  return (
    <main id="study" tabIndex={-1} className="learning-main">
      <div className="learning-heading">
        <div>
          <h1>Mi avance</h1>
          <p>Ve lo que ya estudiaste. Elige lo que necesitas repetir.</p>
        </div>
        <p>
          <strong>{analytics.sections.reduce((sum, row) => sum + row.practiced, 0)}</strong> de{" "}
          {index.cards.filter((c) => !state.suspended_cards?.includes(c.id)).length} flashcards
          practicadas
        </p>
      </div>
      {store.error && (
        <div className="coach-save-error" role="alert">
          <strong>No se pudo guardar el progreso.</strong>
          <p>{store.error}</p>
          {!store.latest && (
            <button disabled={store.saving} onClick={() => void store.retry()}>
              Reintentar guardado
            </button>
          )}
          <button onClick={() => void store.reload()}>Cargar progreso guardado</button>
          <button onClick={() => downloadBackup(store.pendingProfile || store.profile)}>
            Exportar copia
          </button>
        </div>
      )}
      {test ? (
        <TestSession
          key={store.generation}
          questions={test}
          personal={{ state, commit: store.commit, disabled: disabled || !!store.error }}
          disabled={disabled}
          tags={state.tags}
          onTag={(id, change) => void store.commit((previous) => setTag(previous, id, change))}
          onClose={() => {
            setTest(null);
            clear();
          }}
          onReview={(question) =>
            onReview({
              axisId: `libro-${question.card?.section_id || question.clinical?.section_id || sectionId}`,
              section: "subtest",
              caseId: question.id,
              label: question.label,
            })
          }
          onAnswer={async (question, grade, seconds, attemptId) => {
            const meta =
              index.cards.find((card) => card.id === question.id) || caseMeta(question.id);
            if (!meta) return null;
            let notices: ReturnType<typeof completionNotices> = [];
            const fresh = !store.state.progress[question.id];
            const saved = await store.commit((previous) => {
              const prepared =
                previous.plan && !previous.days[day]
                  ? {
                      ...previous,
                      days: {
                        ...previous.days,
                        [day]: createAssignment(
                          previous,
                          index,
                          day,
                          estimatePlan(previous, index, day).daily_minutes,
                        ),
                      },
                    }
                  : previous;
              const next = recordPractice(prepared, meta, grade, seconds, day, attemptId);
              notices = completionNotices(previous, next, index);
              return next;
            });
            return saved
              ? {
                  due: saved.progress[question.id].due_day,
                  notices: notices.map(milestoneText),
                  fresh,
                }
              : null;
          }}
        />
      ) : (
        <>
          <div className="learning-layout">
            <aside className="learning-sections" aria-label="Avance por sección">
              <h2>Secciones</h2>
              {manifest.sections.map((info) => {
                const row = analytics.sections.find((row) => row.id === info.id)!;
                return (
                  <button
                    key={info.id}
                    data-testid={`section-progress-${info.id}`}
                    aria-pressed={info.id === sectionId}
                    onClick={() => changeSection(info.id)}
                  >
                    <strong>{info.title}</strong>
                    <Counts row={row} />
                  </button>
                );
              })}
            </aside>
            <div className="learning-workspace">
              <section className="learning-block-summary" aria-label="Avance de la sección">
                <h2>{sectionTitle(sectionId)}</h2>
                {activeRow && <Counts row={activeRow} />}
                <p>
                  Primera vuelta: cada flashcard cuenta una vez. Los casos diagnósticos se cuentan
                  por separado. Una primera lectura no cuenta como error.
                </p>
                {section && (
                  <details>
                    <summary>Ver avances por bloque</summary>
                    <div className="learning-blocks">
                      {section.blocks.map((info) => {
                        const row = analytics.blocks.find((row) => row.id === info.id);
                        if (!row) return null;
                        return (
                          <button
                            key={info.id}
                            onClick={() => {
                              setScope([sectionId]);
                              setBlocks([info.id]);
                              clear();
                            }}
                          >
                            <strong>{info.title}</strong>
                            <Counts row={row} />
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
              </section>
              <section className="learning-builder" aria-label="Crear subtest">
                <h2>Prepara tu subtest</h2>
                <p>
                  Combina secciones y bloques. Filtra por tipo de pregunta, orden y estado. Puedes
                  repetir las preguntas en esta misma sesión.
                </p>
                <div className="learning-filter">
                  <span className="learning-filter-title">
                    Secciones del subtest{" "}
                    <small>
                      {scope.length} de {manifest.sections.length}
                    </small>
                  </span>
                  <div
                    className="learning-chips learning-section-chips"
                    role="group"
                    aria-label="Secciones del subtest"
                  >
                    {manifest.sections.map((info) => (
                      <button
                        key={info.id}
                        type="button"
                        aria-pressed={scope.includes(info.id)}
                        onClick={() => toggleScope(info.id)}
                      >
                        {info.title}
                      </button>
                    ))}
                  </div>
                  <div className="learning-chip-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setScope(manifest.sections.map((s) => s.id));
                        setBlocks([]);
                        clear();
                      }}
                    >
                      Todas las secciones
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScope([sectionId]);
                        setBlocks([]);
                        clear();
                      }}
                    >
                      Solo {sectionTitle(sectionId)}
                    </button>
                  </div>
                </div>
                {singleSection && (
                  <div className="learning-filter">
                    <span className="learning-filter-title">
                      Bloques{" "}
                      <small>
                        {blocks.length ? `${blocks.length} elegidos` : "Todos los bloques"}
                      </small>
                    </span>
                    <div className="learning-chips" role="group" aria-label="Bloques del subtest">
                      {singleSection.blocks.map((info) => (
                        <button
                          key={info.id}
                          type="button"
                          aria-pressed={blocks.includes(info.id)}
                          onClick={() => {
                            setBlocks((old) =>
                              old.includes(info.id)
                                ? old.filter((x) => x !== info.id)
                                : [...old, info.id],
                            );
                            clear();
                          }}
                        >
                          {info.id} · {info.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {scope.length > 1 && (
                  <p className="learning-scope">
                    Incluye todos los bloques de las {scope.length} secciones elegidas.
                  </p>
                )}
                <div className="learning-kind">
                  <button
                    aria-pressed={kind === "cards"}
                    onClick={() => {
                      setKind("cards");
                      clear();
                    }}
                  >
                    Flashcards
                  </button>
                  <button
                    aria-pressed={kind === "cases"}
                    onClick={() => {
                      setKind("cases");
                      clear();
                    }}
                  >
                    Casos diagnósticos
                  </button>
                </div>
                {kind === "cards" ? (
                  <div className="learning-filter">
                    <span className="learning-filter-title">
                      Tipo de pregunta{" "}
                      <small>
                        {chosenPatterns.length ? `${chosenPatterns.length} elegidos` : "Todos"}
                      </small>
                    </span>
                    <div className="learning-chips" role="group" aria-label="Tipo de pregunta">
                      {patterns.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={chosenPatterns.includes(item.id)}
                          onClick={() => {
                            setPatterns((old) =>
                              old.includes(item.id)
                                ? old.filter((x) => x !== item.id)
                                : [...old, item.id],
                            );
                            clear();
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="library-field">
                      Dificultad del caso
                      <select
                        value={difficulty}
                        onChange={(event) => {
                          setDifficulty(event.target.value as Difficulty | "all");
                          clear();
                        }}
                      >
                        <option value="all">Todos los niveles</option>
                        {Object.entries(difficultyLabels).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="learning-scope">
                      Fácil: pista y opciones. Medio: opciones sin pista. Se puede confundir:
                      escribe el diagnóstico antes de comparar. Los casos de la biblioteca conservan
                      su viñeta en los tres modos.
                    </p>
                    {scope.includes("14") && (!blocks.length || blocks.includes("14.01")) && (
                      <p className="learning-scope">
                        Amenorrea primaria: 24 viñetas nuevas para ocho diagnósticos, incluidos
                        Turner y Mayer-Rokitansky-Küster-Hauser. Cada diagnóstico tiene un caso
                        fácil, uno medio y uno de contraste. Se agrupan por mecanismo, sin indicar
                        un orden de frecuencia. Revisión clínica profesional pendiente.
                      </p>
                    )}
                  </>
                )}
                <div className="learning-filter-row">
                  <label className="library-field">
                    Orden de la pregunta
                    <select
                      value={order}
                      onChange={(event) => {
                        setOrder(event.target.value as typeof order);
                        clear();
                      }}
                    >
                      <option value="all">Todos los órdenes</option>
                      {([1, 2, 3] as const).map((n) => (
                        <option key={n} value={n}>
                          {orderLabels[n]}
                        </option>
                      ))}
                      <option value="none">Sin orden asignado</option>
                    </select>
                  </label>
                  <label className="library-field">
                    Estado
                    <select
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value as Status);
                        clear();
                      }}
                    >
                      {statuses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="library-field">
                    Máximo de preguntas
                    <input
                      type="number"
                      min={0}
                      max={2000}
                      value={limit}
                      onChange={(event) =>
                        setLimit(Math.max(0, Math.round(Number(event.target.value) || 0)))
                      }
                    />
                    <small>0 = todas</small>
                  </label>
                </div>
                {sectionError ? (
                  <div role="alert">
                    <p>{sectionError}</p>
                    <button onClick={() => setSectionAttempt((old) => old + 1)}>
                      Reintentar sección
                    </button>
                  </div>
                ) : !ready ? (
                  <p role="status">
                    {scope.length ? "Cargando las preguntas…" : "Elige al menos una sección."}
                  </p>
                ) : (
                  <>
                    <div className="learning-selection-actions">
                      <button onClick={() => setSelected(new Set(questions.map((q) => q.id)))}>
                        Seleccionar todas
                      </button>
                      <button
                        onClick={() =>
                          setSelected(
                            new Set(questions.filter((q) => errorIds.has(q.id)).map((q) => q.id)),
                          )
                        }
                      >
                        Elegir mis errores
                      </button>
                      <button
                        onClick={() =>
                          setSelected(
                            new Set(
                              questions
                                .filter((q) => state.progress[q.id]?.due_day <= day)
                                .map((q) => q.id),
                            ),
                          )
                        }
                      >
                        Elegir repasos de hoy
                      </button>
                      <button onClick={clear}>Quitar selección</button>
                    </div>
                    <p className="learning-scope">
                      {questions.length.toLocaleString("es-MX")} preguntas coinciden con tu
                      selección.
                      {questions.length > VISIBLE
                        ? ` Se muestran las primeras ${VISIBLE}. «Seleccionar todas» incluye todas.`
                        : ""}
                    </p>
                    <div className="learning-question-list">
                      {questions.slice(0, VISIBLE).map((question, i) => {
                        const tag = state.tags?.[question.id];
                        return (
                          <label key={question.id}>
                            <input
                              type="checkbox"
                              checked={selected.has(question.id)}
                              onChange={(event) =>
                                setSelected((old) => {
                                  const next = new Set(old);
                                  if (event.target.checked) next.add(question.id);
                                  else next.delete(question.id);
                                  return next;
                                })
                              }
                            />
                            <span>
                              <strong>
                                {i + 1}. {question.label}
                              </strong>
                              <small>
                                {state.progress[question.id]
                                  ? `Próximo repaso: ${date(state.progress[question.id].due_day)}`
                                  : "Sin practicar"}
                                {errorIds.has(question.id) ? " · Tiene errores registrados" : ""}
                                {tag?.order ? ` · ${tag.order}º orden` : ""}
                                {tag?.deepen ? " · ★ Profundizar" : ""}
                                {tag?.later ? " · Al final" : ""}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {!questions.length && <p>No hay preguntas para esta selección.</p>}
                    <div className="learning-start">
                      <label className="learning-mix">
                        <input
                          type="checkbox"
                          checked={mixed}
                          onChange={(event) => setMixed(event.target.checked)}
                        />
                        Mezclar el orden
                      </label>
                      <span>
                        {selected.size} preguntas seleccionadas
                        {limit > 0 && selected.size > limit ? ` · el subtest usa ${limit}` : ""}
                      </span>
                      <button
                        className="coach-primary"
                        disabled={!selected.size || disabled || !!store.error}
                        onClick={start}
                      >
                        Empezar subtest (
                        {limit > 0 ? Math.min(limit, selected.size) : selected.size})
                      </button>
                    </div>
                  </>
                )}
              </section>
              <section className="learning-errors learning-deepen">
                <h2>Para profundizar</h2>
                {deepen.length ? (
                  <>
                    <ol>
                      {deepen.slice(0, 40).map((id) => (
                        <li key={id}>
                          <span>{questionFor(id)?.label || id}</span>
                          <button
                            className="text-button"
                            disabled={disabled}
                            onClick={() =>
                              void store.commit((previous) =>
                                setTag(previous, id, { deepen: false }),
                              )
                            }
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ol>
                    <button
                      className="coach-primary"
                      disabled={disabled || !!store.error}
                      onClick={() => listTest(deepen)}
                    >
                      Subtest con estas ({deepen.length})
                    </button>
                  </>
                ) : (
                  <p>
                    Marca una pregunta con «☆ Profundizar» durante tu sesión. Aparecerá aquí para
                    estudiarla con más calma.
                  </p>
                )}
              </section>
              <section className="learning-errors learning-slow">
                <h2>Preguntas que más tiempo te toman</h2>
                {slow.length ? (
                  <>
                    <ol>
                      {slow.map((item) => (
                        <li key={item.id}>
                          <span>{questionFor(item.id)?.label || item.id}</span>
                          <strong>
                            {duration(item.average)} · {item.answers}{" "}
                            {item.answers === 1 ? "vez" : "veces"}
                          </strong>
                        </li>
                      ))}
                    </ol>
                    <button
                      className="coach-primary"
                      disabled={disabled || !!store.error}
                      onClick={() => listTest(slow.map((item) => item.id))}
                    >
                      Subtest con estas ({slow.length})
                    </button>
                  </>
                ) : (
                  <p>
                    Aún no hay tiempos registrados. Aparecerán después de tus primeras respuestas.
                  </p>
                )}
              </section>
              <section className="learning-errors">
                <h2>Temas con más errores</h2>
                {errors.length ? (
                  <ol>
                    {errors.map((item) => (
                      <li key={item.id}>
                        <span>{labelFor(item.id)}</span>
                        <strong>
                          {item.errors} {item.errors === 1 ? "error" : "errores"}
                        </strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    Aún no hay errores registrados en esta selección. «Difícil» y las primeras
                    lecturas se cuentan por separado.
                  </p>
                )}
                <p>
                  Las respuestas conjuntas de Eje Clínico se registran por bloque. Los casos
                  individuales identifican el diagnóstico.
                </p>
              </section>
            </div>
          </div>
          <section className="learning-history" aria-label="Tu historial completo">
            <h2>Todo tu camino</h2>
            <p>
              Desde tu primer día de estudio. El verde brilla más con cada 50 respuestas. Toca un
              día para ver su progreso.
            </p>
            <Heatmap
              state={state}
              days={range}
              selected={historyDay}
              onSelect={setHistoryDay}
              label="Historial de estudio desde el inicio"
              layout="weeks"
            />
            <HeatLegend />
            <DayDetail
              state={state}
              index={index}
              day={historyDay}
              today={day}
              sectionTitle={sectionTitle}
            />
          </section>
        </>
      )}
    </main>
  );
}
