import { useEffect, useMemo, useState } from 'react';
import type { StudyManifest, StudySection } from '../library-types';
import type { ReviewContext } from '../storage';
import { createAssignment, estimatePlan, recordPractice } from '../coach/engine';
import { dateLabel, timezone } from '../coach/format';
import { useCoachStore, useStudyDay } from '../coach/hooks';
import { loadResources, loadSection } from '../coach/resources';
import { downloadBackup } from '../coach/storage';
import type { CoachIndex } from '../coach/types';
import { caseMeta, completionNotices, progressRows, topicErrors, type ProgressRow } from './model';
import { clinicalCases, difficultyLabels, type Difficulty } from './cases';
import TestSession, { type TestQuestion } from './TestSession';
import '../library.css';
import '../coach/coach.css';
import './learning.css';

const date = (value: string | null) => value ? dateLabel(value) : 'Sin iniciar';
function Counts({ row }: { row: ProgressRow }) {
  return <><span><strong>{row.practiced} de {row.total}</strong> flashcards practicadas · {row.remaining} pendientes</span>
    <progress aria-label={`Primera vuelta ${row.id}`} value={row.practiced} max={row.total || 1} />
    <small>{row.attempts} respuestas · {row.errors} {row.errors === 1 ? 'error' : 'errores'} · {row.difficult} difíciles</small>
    <small>Inicio: {date(row.started)} · Próximo repaso: {row.next_due ? date(row.next_due) : 'Después de practicar'}</small>
    {row.clinical_practiced > 0 && <small>{row.clinical_practiced} casos diagnósticos practicados</small>}
    {row.due > 0 && <small className="learning-due">{row.due} repasos para hoy o vencidos</small>}</>;
}

export default function Learning({ suspended, onReview }: { suspended: boolean; onReview: (context: ReviewContext) => void }) {
  const store = useCoachStore();
  const { state } = store;
  const day = useStudyDay(state.plan?.timezone || timezone());
  const [resources, setResources] = useState<{ manifest: StudyManifest; index: CoachIndex } | null>(null);
  const [loadError, setLoadError] = useState(''), [attempt, setAttempt] = useState(0);
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const [sectionId, setSectionId] = useState(params.get('section') || '');
  const [block, setBlock] = useState(params.get('block') || 'all');
  const [kind, setKind] = useState<'cards' | 'cases'>(params.get('mode') === 'cases' ? 'cases' : 'cards');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('easy');
  const [family, setFamily] = useState('all');
  const [section, setSection] = useState<StudySection | null>(null);
  const [sectionError, setSectionError] = useState(''), [sectionAttempt, setSectionAttempt] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [test, setTest] = useState<TestQuestion[] | null>(null);
  useEffect(() => {
    const abort = new AbortController(); setLoadError('');
    loadResources(abort.signal).then(data => { if (!abort.signal.aborted) { setResources(data); setSectionId(old => data.manifest.sections.some(s => s.id === old) ? old : data.manifest.sections[0].id); } }).catch(error => { if (!abort.signal.aborted) setLoadError((error as Error).message); });
    return () => abort.abort();
  }, [attempt]);
  useEffect(() => {
    if (!resources || !sectionId) return;
    let active = true; setSection(null); setSectionError('');
    loadSection(sectionId, resources.index.content_sha256).then(data => {
      if (!active) return;
      setSection(data); setBlock(old => old === 'all' || data.blocks.some(b => b.id === old) ? old : 'all');
    }).catch(error => { if (active) setSectionError((error as Error).message); });
    return () => { active = false; };
  }, [resources, sectionId, sectionAttempt]);
  const analytics = useMemo(() => resources ? progressRows(state, resources.index, day) : null, [state, resources, day]);
  const cases = useMemo(() => section ? clinicalCases(section) : [], [section]);
  const questions = useMemo<TestQuestion[]>(() => {
    if (!section || section.id !== sectionId) return [];
    return kind === 'cards' ? section.cards.filter(card => (block === 'all' || card.block_id === block) && (family === 'all' || card.family === family)).map(card => ({ id: card.id,
      label: `${card.family === 'eje' ? 'Eje Clínico' : `Patrones Madre ${card.level}`} · ${card.block_id} · ${card.topic_id ? section.cards.find(c => c.family === 'eje' && c.block_id === card.block_id)?.back.find(row => row.topic_id === card.topic_id)?.title || card.prompt : card.prompt}`, card }))
      : cases.filter(item => (block === 'all' || item.block_id === block) && (difficulty === 'all' || item.difficulty === difficulty)).map(clinical => ({ id: clinical.id, label: `${clinical.diagnosis} · ${difficultyLabels[clinical.difficulty]}`, clinical }));
  }, [section, sectionId, kind, block, family, cases, difficulty]);
  if (loadError) return <main id="study" className="learning-main"><div role="alert"><h1>No se pudo cargar tu avance.</h1><p>{loadError}</p><button onClick={() => setAttempt(old => old + 1)}>Reintentar carga</button></div></main>;
  if (!resources || !analytics || store.loading) return <main id="study" className="learning-main" role="status">Abriendo tu avance…</main>;
  const { manifest, index } = resources;
  const disabled = suspended || store.saving;
  const activeRow = analytics.sections.find(row => row.id === sectionId);
  const errors = topicErrors(state, index).filter(item => item.section_id === sectionId && (block === 'all' || item.block_id === block));
  const labelFor = (id: string) => cases.find(item => item.topic_id === id)?.diagnosis || (id.startsWith('block:') ? `Bloque ${id.slice(6)} · respuesta conjunta` : id);
  const errorIds = new Set(state.history.filter(item => item.rating === 1).map(item => item.card_id));
  const changeSection = (id: string) => { setSectionId(id); setSection(null); setBlock('all'); setSelected(new Set()); };
  const milestoneText = (notice: { kind: 'block' | 'section'; id: string }) => notice.kind === 'block'
    ? `Bloque completo: ${section?.blocks.find(b => b.id === notice.id)?.title || notice.id}. Practicaste todas sus flashcards.`
    : `Sección completa: ${manifest.sections.find(s => s.id === notice.id)?.title || notice.id}. Primera vuelta terminada.`;
  return <main id="study" tabIndex={-1} className="learning-main">
    <div className="learning-heading"><div><h1>Mi avance</h1><p>Ve lo que ya estudiaste. Elige lo que necesitas repetir.</p></div><p><strong>{analytics.sections.reduce((sum, row) => sum + row.practiced, 0)}</strong> de {index.cards.length} flashcards practicadas</p></div>
    {store.error && <div className="coach-save-error" role="alert"><strong>No se pudo guardar el progreso.</strong><p>{store.error}</p><button onClick={() => void store.reload()}>Cargar progreso guardado</button><button onClick={() => downloadBackup(store.pending || state)}>Exportar copia</button></div>}
    {test ? <TestSession questions={test} disabled={disabled} onClose={() => { setTest(null); setSelected(new Set()); }} onReview={question => onReview({ axisId: `libro-${sectionId}`, section: 'subtest', caseId: question.id, label: question.label })} onAnswer={async (question, grade, seconds, attemptId) => {
      const meta = index.cards.find(card => card.id === question.id) || caseMeta(question.id);
      if (!meta) return null;
      let notices: ReturnType<typeof completionNotices> = [];
      const saved = await store.commit(previous => {
        const prepared = previous.plan && !previous.days[day] ? { ...previous, days: { ...previous.days,
          [day]: createAssignment(previous, index, day, estimatePlan(previous, index, day).daily_minutes) } } : previous;
        const next = recordPractice(prepared, meta, grade, seconds, day, attemptId);
        notices = completionNotices(previous, next, index);
        return next;
      });
      return saved ? { due: saved.progress[question.id].due_day, notices: notices.map(milestoneText) } : null;
    }} /> : <div className="learning-layout">
      <aside className="learning-sections" aria-label="Avance por sección"><h2>Secciones</h2>{manifest.sections.map(info => {
        const row = analytics.sections.find(row => row.id === info.id)!;
        return <button key={info.id} data-testid={`section-progress-${info.id}`} aria-pressed={info.id === sectionId} onClick={() => changeSection(info.id)}><strong>{info.title}</strong><Counts row={row} /></button>;
      })}</aside>
      <div className="learning-workspace">
        <section className="learning-block-summary" aria-label="Avance de la sección"><h2>{manifest.sections.find(s => s.id === sectionId)?.title}</h2>{activeRow && <Counts row={activeRow} />}<p>Primera vuelta: cada flashcard cuenta una vez. Los casos diagnósticos se cuentan por separado.</p>
          {section && <details><summary>Ver avances por bloque</summary><div className="learning-blocks">{section.blocks.map(info => {
            const row = analytics.blocks.find(row => row.id === info.id)!;
            return <button key={info.id} onClick={() => { setBlock(info.id); setSelected(new Set()); }}><strong>{info.title}</strong><Counts row={row} /></button>;
          })}</div></details>}
        </section>
        <section className="learning-builder" aria-label="Crear subtest"><h2>Prepara tu subtest</h2><p>Selecciona preguntas de un bloque. Puedes repetirlas en esta misma sesión.</p>
          {sectionError ? <div role="alert"><p>{sectionError}</p><button onClick={() => setSectionAttempt(old => old + 1)}>Reintentar sección</button></div> : !section ? <p role="status">Cargando las preguntas…</p> : <>
            <label className="library-field">Bloque del subtest<select value={block} onChange={event => { setBlock(event.target.value); setSelected(new Set()); }}><option value="all">Todos los bloques</option>{section.blocks.map(info => <option key={info.id} value={info.id}>{info.id} · {info.title}</option>)}</select></label>
            <div className="learning-kind"><button aria-pressed={kind === 'cards'} onClick={() => { setKind('cards'); setSelected(new Set()); }}>Flashcards</button><button aria-pressed={kind === 'cases'} onClick={() => { setKind('cases'); setSelected(new Set()); }}>Casos diagnósticos</button></div>
            {kind === 'cards' ? <label className="library-field">Formato del subtest<select value={family} onChange={event => { setFamily(event.target.value); setSelected(new Set()); }}><option value="all">Todos los formatos</option><option value="eje">Eje Clínico</option><option value="madre">Patrones Madre</option></select></label> : <><label className="library-field">Dificultad del caso<select value={difficulty} onChange={event => { setDifficulty(event.target.value as Difficulty | 'all'); setSelected(new Set()); }}><option value="all">Todos los niveles</option>{Object.entries(difficultyLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><p className="learning-scope">Fácil: pista y opciones. Medio: opciones sin pista. Se puede confundir: escribe el diagnóstico antes de comparar. Los casos de la biblioteca conservan su viñeta en los tres modos.</p>{sectionId === '14' && (block === 'all' || block === '14.01') && <p className="learning-scope">Amenorrea primaria: 24 viñetas nuevas para ocho diagnósticos, incluidos Turner y Mayer-Rokitansky-Küster-Hauser. Cada diagnóstico tiene un caso fácil, uno medio y uno de contraste. Se agrupan por mecanismo, sin indicar un orden de frecuencia. Revisión clínica profesional pendiente.</p>}</>}
            <div className="learning-selection-actions"><button onClick={() => setSelected(new Set(questions.map(q => q.id)))}>Seleccionar todas</button><button onClick={() => setSelected(new Set(questions.filter(q => errorIds.has(q.id)).map(q => q.id)))}>Elegir mis errores</button><button onClick={() => setSelected(new Set(questions.filter(q => state.progress[q.id]?.due_day <= day).map(q => q.id)))}>Elegir repasos de hoy</button><button onClick={() => setSelected(new Set())}>Quitar selección</button></div>
            <div className="learning-question-list">{questions.map((question, i) => <label key={question.id}><input type="checkbox" checked={selected.has(question.id)} onChange={event => setSelected(old => { const next = new Set(old); if (event.target.checked) next.add(question.id); else next.delete(question.id); return next; })} /><span><strong>{i + 1}. {question.label}</strong><small>{state.progress[question.id] ? `Próximo repaso: ${date(state.progress[question.id].due_day)}` : 'Sin practicar'}{errorIds.has(question.id) ? ' · Tiene errores registrados' : ''}</small></span></label>)}</div>
            {!questions.length && <p>No hay preguntas para esta selección.</p>}
            <div className="learning-start"><span>{selected.size} preguntas seleccionadas</span><button className="coach-primary" disabled={!selected.size || disabled || !!store.error} onClick={() => setTest(questions.filter(q => selected.has(q.id)))}>Empezar subtest ({selected.size})</button></div>
          </>}
        </section>
        <section className="learning-errors"><h2>Temas con más errores</h2>{errors.length ? <ol>{errors.map(item => <li key={item.id}><span>{labelFor(item.id)}</span><strong>{item.errors} {item.errors === 1 ? 'error' : 'errores'}</strong></li>)}</ol> : <p>Aún no hay errores registrados en esta selección. «Difícil» se cuenta por separado.</p>}<p>Las respuestas conjuntas de Eje Clínico se registran por bloque. Los casos individuales identifican el diagnóstico.</p></section>
      </div>
    </div>}
  </main>;
}
