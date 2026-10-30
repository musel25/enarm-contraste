import { useEffect, useMemo, useState } from "react";
import { isManifest, isSection, type StudyManifest, type StudySection } from "./library-types";
import { readState, validPractice, type ReviewContext } from "./storage";
import StudyCard from "./StudyCard";
import { Icon } from "./ui";
import "./library.css";
import { useCoachStore, useStudyDay } from "./coach/hooks";
import { recordPractice } from "./coach/engine";
import { dateLabel, timezone } from "./coach/format";
import { completionNotices } from "./learning/model";
import type { CoachIndex } from "./coach/types";

const root = `${import.meta.env.BASE_URL}study/`;
const levels = [
  ["1", "1 · Reconocer el patrón"], ["2", "2 · Nombrar el diagnóstico"],
  ["3", "3 · Explicar los hallazgos"], ["4", "4 · Decidir el manejo"],
];
const number = (n: number) => n.toLocaleString("es-MX");
const searchText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function LoadError({ onRetry }: { onRetry: () => void }) {
  return <div className="library-load-error" role="alert"><h2>No se pudo cargar el contenido.</h2><p>Comprueba tu conexión y vuelve a intentarlo.</p><button className="primary-button" onClick={onRetry}>Reintentar</button></div>;
}

export default function Library({ onReview }: { onReview: (context: ReviewContext) => void }) {
  const [manifest, setManifest] = useState<StudyManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [section, setSection] = useState<StudySection | null>(null);
  const [sectionError, setSectionError] = useState(false);
  const [sectionAttempt, setSectionAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<"eje" | "madre">("eje");
  const [level, setLevel] = useState("1");
  const [block, setBlock] = useState("all");
  const [index, setIndex] = useState(0);
  const [progress] = useState(() => readState("enarm-full-library-progress-v1", validPractice, {}));
  const store = useCoachStore();
  const day = useStudyDay(store.state.plan?.timezone || timezone());
  const [notice, setNotice] = useState("");
  const [pendingNotice, setPendingNotice] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    setManifestError(false);
    fetch(`${root}manifest.json`, { signal: abort.signal, cache: "no-cache" }).then(async response => {
      if (!response.ok) throw new Error("Manifest request failed");
      const data: unknown = await response.json();
      if (!isManifest(data)) throw new Error("Invalid manifest");
      if (!abort.signal.aborted) setManifest(data);
    }).catch(() => { if (!abort.signal.aborted) setManifestError(true); });
    return () => abort.abort();
  }, [attempt]);

  useEffect(() => {
    if (!manifest || !sectionId) return;
    const abort = new AbortController();
    setSection(null);
    setSectionError(false);
    const info = manifest.sections.find(s => s.id === sectionId);
    if (!info) return;
    fetch(`${root}${info.url}?v=${manifest.content_sha256}`, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error("Section request failed");
      const data: unknown = await response.json();
      if (!isSection(data) || data.id !== sectionId) throw new Error("Invalid section");
      if (!abort.signal.aborted) setSection(data);
    }).catch(() => { if (!abort.signal.aborted) setSectionError(true); });
    return () => abort.abort();
  }, [manifest, sectionId, sectionAttempt]);

  const cards = useMemo(() => section?.cards.filter(c => c.family === family && (family === "eje" || c.level === Number(level)) && (block === "all" || c.block_id === block)) || [], [section, family, level, block]);
  const card = cards[index];
  const combined = { ...progress };
  for (const [id, memory] of Object.entries(store.state.progress)) if (!id.startsWith("clinical/") && memory.last_rating) combined[id] = memory.last_rating >= 3 ? "known" : "again";
  const recognized = Object.values(combined).filter(v => v === "known").length;
  const practiceIndex: CoachIndex = { schema_version: 1, content_sha256: manifest?.content_sha256 || "", cards: section?.cards.map((item, order) => ({ id: item.id, section_id: item.section_id, block_id: item.block_id, family: item.family, level: item.level, order, new_seconds: 90, review_seconds: 35 })) || [] };
  async function rate(value: "known" | "again") {
    if (!card || store.loading || store.saving || store.error) return;
    const meta = practiceIndex.cards.find(item => item.id === card.id)!;
    let completed: ReturnType<typeof completionNotices> = [];
    const saved = await store.commit(previous => {
      const next = recordPractice(previous, meta, value === "again" ? 1 : 3, 0, day, crypto.randomUUID());
      completed = completionNotices(previous, next, practiceIndex);
      return next;
    });
    const message = completed.map(item => `${item.kind === "block" ? "Bloque completo" : "Sección completa"}: ${item.id}. Primera vuelta terminada.`).join(" ");
    if (saved) { setNotice(message); setPendingNotice(""); }
    else setPendingNotice(message);
  }
  async function retrySave() {
    const saved = await store.retry();
    if (saved) { setNotice(pendingNotice); setPendingNotice(""); }
  }
  const selectSection = (id: string | null, blockId = "all") => {
    setSectionId(id); setSection(null); setBlock(blockId); setIndex(0); setNotice("");
    if (blockId !== "all") setFamily("eje");
    requestAnimationFrame(() => {
      document.getElementById("study")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    });
  };
  const changeFamily = (value: "eje" | "madre") => { setFamily(value); setIndex(0); };
  const changeLevel = (value: string) => {
    const next = section?.cards.filter(c => c.family === "madre" && c.level === Number(value) && (block === "all" || c.block_id === block)) || [];
    const target = next.findIndex(c => card?.topic_id ? c.topic_id === card.topic_id : c.block_id === card?.block_id);
    setLevel(value); setIndex(Math.max(0, target));
  };
  const followCase = (topicId: string) => {
    const next = section?.cards.filter(c => c.family === "madre" && c.level === 4 && (block === "all" || c.block_id === block)) || [];
    const target = next.findIndex(c => c.topic_id === topicId);
    if (target >= 0) {
      setFamily("madre"); setLevel("4"); setIndex(target);
      requestAnimationFrame(() => document.getElementById("library-card-question")?.focus());
    }
  };
  if (manifestError) return <main className="library-main" id="study"><LoadError onRetry={() => setAttempt(a => a + 1)} /></main>;
  if (!manifest) return <main className="library-main" id="study"><p role="status" className="library-loading">Cargando el temario…</p></main>;
  const term = searchText(query);
  const matchingSections = manifest.sections.filter(s => searchText(s.title).includes(term));
  const matchingGroups = term ? (manifest.groups || []).filter(g => searchText(`${g.title} ${g.problem}`).includes(term)) : [];
  return <main className="library-main" id="study" tabIndex={-1}>
    <p className="library-free-practice">Tus respuestas nuevas se registran en «Mi avance». Cada respuesta programa tu próximo repaso.</p>
    {store.error && <div role="alert"><p>No se pudo guardar tu respuesta. {store.error}</p><button onClick={() => void retrySave()}>Reintentar guardado</button><button onClick={() => void store.reload().then(() => setPendingNotice(""))}>Cargar progreso guardado</button></div>}
    {notice && <p role="status" className="learning-milestone">{notice}</p>}
    {sectionId ? <>
      <div className="library-breadcrumb"><button onClick={() => selectSection(null)}>‹ Todas las secciones</button><span>{manifest.sections.find(s => s.id === sectionId)?.title}</span></div>
      <div className="library-reader-heading"><div><h1>Una pista cambia la decisión.</h1><p>Lee, compara y explica tu respuesta.</p></div><span className="library-progress"><Icon name="check" size={15} />{recognized} {recognized === 1 ? "tarjeta reconocida" : "tarjetas reconocidas"}</span></div>
      <div className="library-reader">
        <aside className="library-controls" aria-label="Configurar tarjetas">
          <div className="library-family-switch" aria-label="Formato de tarjetas"><button aria-pressed={family === "eje"} onClick={() => changeFamily("eje")}>Eje Clínico</button><button aria-pressed={family === "madre"} onClick={() => changeFamily("madre")}>Patrones Madre</button></div>
          <p className="family-explanation">{family === "eje" ? "Compara casos del mismo grupo. Relaciona sus pistas con los diagnósticos." : "Conecta el patrón con su nombre, sus hallazgos y su manejo."}</p>
          {family === "madre" && <label className="library-field">Nivel de Patrones Madre<select value={level} onChange={e => changeLevel(e.target.value)}>{levels.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
          {section && <details className="library-block-picker"><summary>Elegir un bloque</summary><label className="library-field">Bloque<select value={block} onChange={e => { setBlock(e.target.value); setIndex(0); }}><option value="all">Todos los bloques</option>{section.blocks.map(b => <option key={b.id} value={b.id}>{b.id} · {b.title}</option>)}</select></label></details>}
          <div className="library-route-note"><span className="route-node" /><p>Primero distingue la pista.<br />Después explica por qué cambia la decisión.</p></div>
        </aside>
        <div className="library-study-column">
          {sectionError ? <LoadError onRetry={() => setSectionAttempt(a => a + 1)} /> : !section || store.loading ? <p role="status" className="library-loading">Cargando tarjetas…</p> : card ? <>
            <div className="library-card-pagination"><span>Tarjeta {index + 1} de {cards.length}</span><div><button aria-label="Tarjeta anterior" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>‹</button><button aria-label="Tarjeta siguiente" disabled={index >= cards.length - 1} onClick={() => setIndex(i => i + 1)}>›</button></div></div>
            <StudyCard key={`${store.generation}/${card.id}`} card={card} status={combined[card.id]} ratingDisabled={store.loading || store.saving || !!store.error} onFollow={followCase} onRate={value => void rate(value)} onReview={() => onReview({ axisId: `libro-${sectionId}`, section: "library", caseId: card.id, label: `${section.title} · ${card.id}` })} />
            {store.state.progress[card.id] && <p role="status">Próximo repaso: {dateLabel(store.state.progress[card.id].due_day)}</p>}
            <div className="library-practice-links"><a href={`#avance?section=${sectionId}&block=${card.block_id}`}>Crear subtest de este bloque</a><a href={`#avance?section=${sectionId}&block=${card.block_id}&mode=cases`}>Ampliar casos diagnósticos</a></div>
            <div className="library-bottom-next"><button disabled={index === 0} onClick={() => { setIndex(i => i - 1); document.getElementById("study")?.scrollIntoView(); }}>Anterior</button><button disabled={index >= cards.length - 1} onClick={() => { setIndex(i => i + 1); document.getElementById("study")?.scrollIntoView(); }}>Siguiente tarjeta <Icon name="arrow" size={16} /></button></div>
          </> : <p role="status">No hay tarjetas para esta selección. Elige otro bloque o nivel.</p>}
        </div>
      </div>
    </> : <>
      <div className="library-intro"><div><span className="library-bookmark"><Icon name="book" size={18} />Tu biblioteca ENARM</span><h1>Estudia por contraste</h1><p>Un síntoma. Varios diagnósticos posibles.<br />Aprende a encontrar la pista que cambia el manejo.</p></div><div className="library-method-preview"><div><span className="preview-cases">A <i>o</i> B</span><strong>Compara los casos</strong><p>Encuentra el dato que distingue.</p></div><div><span className="preview-connection" aria-hidden="true">↳</span><strong>Entiende la decisión</strong><p>Conecta mecanismo, hallazgos y manejo.</p></div></div></div>
      <div className="library-catalog-heading"><div><h2>{term ? "Encuentra tu problema clínico" : "Elige dónde empezar"}</h2><p>{number(manifest.counts.sections)} secciones · {number(manifest.counts.blocks)} grupos clínicos · {number(manifest.counts.cards)} tarjetas</p></div><label className="library-search"><span>Buscar síntoma o sección</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Amenorrea, fiebre, ginecología…" /></label></div>
      {matchingSections.length > 0 && <div className="library-section-index">{matchingSections.map(s => <button key={s.id} onClick={() => selectSection(s.id)}><span className="section-spine">{s.id}</span><span><strong>{s.title}</strong><small>{s.blocks} grupos · {number(s.cards)} tarjetas</small></span><Icon name="arrow" size={17} /></button>)}</div>}
      {matchingGroups.length > 0 && <section className="library-group-results" aria-label="Grupos clínicos encontrados"><h3>Grupos clínicos ({matchingGroups.length})</h3><div>{matchingGroups.map(g => <button key={g.id} onClick={() => selectSection(g.section_id, g.id)}><span><strong>{g.title}</strong><small>{manifest.sections.find(s => s.id === g.section_id)?.title} · Bloque {g.id}</small></span><Icon name="arrow" size={18} /></button>)}</div></section>}
      {term && matchingSections.length === 0 && matchingGroups.length === 0 && <p className="library-empty">No hay resultados para ese síntoma o sección. Prueba otro término.</p>}
      <section className="library-downloads" aria-labelledby="downloads-title"><div><Icon name="download" size={24} /><h2 id="downloads-title">Llévalo a Anki</h2><p>Los mismos casos en los dos formatos de tus mazos.</p></div><div>{manifest.downloads.map(d => <a key={d.family} href={`${root}${d.url}`} download><span><strong>{d.label}</strong><small>{number(d.cards)} tarjetas · .apkg</small></span><Icon name="download" size={20} /></a>)}</div></section>
    </>}
    <footer className="library-footer"><span>contraste.</span><p>{manifest.review_status === "cross-reviewed" ? "Contenido cotejado con las fuentes y con revisión cruzada." : "Contenido en preparación."} Material de estudio. Revisión clínica profesional pendiente.</p><a href={`${root}coverage.json`} download>Consultar cobertura</a></footer>
  </main>;
}
