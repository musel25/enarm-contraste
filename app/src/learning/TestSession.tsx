import { useEffect, useRef, useState } from 'react';
import StudyCard from '../StudyCard';
import type { StudyCardData } from '../library-types';
import type { Grade } from '../coach/types';
import { dateLabel } from '../coach/format';
import type { DiagnosticCase } from './cases';
import { difficultyLabels } from './cases';
import type { DecisionQuestion } from './decisions';

export type TestQuestion = { id: string; label: string; card?: StudyCardData; clinical?: DiagnosticCase; decision?: DecisionQuestion };
export type AnswerResult = { due: string; notices: string[] };
type Result = { question: TestQuestion; grade: Grade; due: string };

export default function TestSession({ questions, disabled, onAnswer, onClose, onReview }: {
  questions: TestQuestion[]; disabled: boolean;
  onAnswer: (question: TestQuestion, grade: Grade, seconds: number, attemptId: string) => Promise<AnswerResult | null>;
  onClose: () => void; onReview: (question: TestQuestion) => void;
}) {
  const [queue, setQueue] = useState(questions), [position, setPosition] = useState(0);
  const [results, setResults] = useState<Result[]>([]), [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState<TestQuestion[]>([]);
  const [repeats, setRepeats] = useState<Set<string>>(new Set());
  const [answer, setAnswer] = useState<{ grade: Grade; due: string } | null>(null);
  const [notices, setNotices] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false), [draft, setDraft] = useState('');
  const [retry, setRetry] = useState<{ grade: Grade; id: string; seconds: number } | null>(null);
  const lock = useRef(false), elapsed = useRef(0);
  const root = useRef<HTMLElement>(null);
  const question = queue[position];
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const heading = root.current?.querySelector<HTMLHeadingElement>('h2');
      heading?.focus({ preventScroll: true });
      root.current?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [position, queue, finished]);
  useEffect(() => {
    elapsed.current = 0;
    setAnswer(null); setNotices([]); setRevealed(false); setDraft(''); setRetry(null);
  }, [position, queue]);
  useEffect(() => {
    let active = document.visibilityState === 'visible' && !disabled && !busy && !answer;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (active) elapsed.current += now - last;
      last = now;
      active = document.visibilityState === 'visible' && !disabled && !busy && !answer;
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { tick(); clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [position, queue, disabled, busy, answer]);
  async function rate(grade: Grade) {
    if (lock.current || disabled || answer) return;
    lock.current = true; setBusy(true);
    const attempt = retry || { grade, id: crypto.randomUUID(), seconds: Math.min(86_400, Math.max(0, elapsed.current / 1000)) };
    try {
      const saved = await onAnswer(question, attempt.grade, attempt.seconds, attempt.id);
      if (!saved) { setRetry(attempt); return; }
      setRetry(null); setAnswer({ grade: attempt.grade, due: saved.due }); setNotices(saved.notices);
      setResults(old => [...old, { question, grade: attempt.grade, due: saved.due }]);
      if (attempt.grade <= 2) setRepeats(old => new Set(old).add(question.id));
    } finally { setBusy(false); lock.current = false; }
  }
  function startRound(next: TestQuestion[]) {
    setQueue(next); setPosition(0); setResults([]); setRepeats(new Set()); setSkipped([]); setFinished(false);
  }
  function skip() {
    if(busy || disabled || retry || answer) return;
    setSkipped(old => [...old, question]);
    if(position + 1 === queue.length) setFinished(true); else setPosition(old=>old+1);
  }
  function finish() {
    if(busy || disabled || retry) return;
    setSkipped(old => [...old,...queue.slice(position + (answer ? 1 : 0))]);
    setFinished(true);
  }
  function repeatSelected() {
    const next = queue.filter(item => repeats.has(item.id));
    if (!next.length) return;
    startRound(next);
  }
  if (finished) return <section ref={root} className="learning-results">
    <h2 tabIndex={-1}>Resultado del subtest</h2>
    <p>{results.length} respuestas guardadas · {results.filter(item => item.grade >= 3).length} aciertos · {results.filter(item => item.grade === 1).length} errores</p>
    <p>Elige las preguntas que quieres repetir en esta sesión.</p>
    <div className="learning-question-list">{results.map(result => <label key={result.question.id}><input type="checkbox" checked={repeats.has(result.question.id)} onChange={event => setRepeats(old => { const next = new Set(old); if (event.target.checked) next.add(result.question.id); else next.delete(result.question.id); return next; })} /><span><strong>{result.question.label}</strong><small>{result.grade === 1 ? 'Error' : result.grade === 2 ? 'Difícil' : 'Acierto'} · Próximo repaso: {dateLabel(result.due)}</small></span></label>)}</div>
    {skipped.length > 0 && <div className="learning-skipped"><p>{skipped.length} preguntas omitidas. No cuentan como practicadas.</p><ul>{skipped.map(item=><li key={item.id}>{item.label}</li>)}</ul><button disabled={disabled} onClick={()=>startRound(skipped)}>Volver a las omitidas</button></div>}
    {!results.length && <p>No respondiste preguntas. Vuelve para preparar otro subtest.</p>}
    <div className="learning-actions"><button className="coach-primary" disabled={!repeats.size || disabled} onClick={repeatSelected}>Repetir seleccionadas</button><button onClick={onClose}>Volver a mi avance</button></div>
  </section>;
  const clinical = question.clinical;
  const decision = question.decision;
  const selfRating = <div className="learning-self-grade"><p>Compara tu respuesta antes de calificar.</p><button disabled={busy || disabled || !!retry} onClick={() => void rate(1)}>Me equivoqué</button><button disabled={busy || disabled || !!retry} onClick={() => void rate(2)}>Me costó recordarla</button><button disabled={busy || disabled || !!retry} onClick={() => void rate(3)}>Acerté</button></div>;
  return <section ref={root} className="learning-test" aria-label="Subtest en curso">
    <div className="learning-test-bar"><strong>Pregunta {position + 1} de {queue.length}</strong><button disabled={busy || disabled || !!retry} onClick={finish}>Terminar subtest</button></div>
    <progress aria-label="Preguntas respondidas" value={results.length} max={queue.length} />
    {!answer && <div className="learning-actions"><button disabled={busy || disabled || !!retry} onClick={skip}>Omitir por ahora</button><small>Sin calificación ni avance. Puedes volver al terminar.</small></div>}
    {question.card && <StudyCard key={`${question.id}/${position}`} card={question.card} initialHighlight={false} onRate={() => {}} onReview={() => onReview(question)} ratingArea={answer ? <p>Respuesta guardada.</p> : selfRating} />}
    {clinical && <article className="library-card learning-case">
      <div className="library-card-bar"><span>{difficultyLabels[clinical.difficulty]} · {clinical.expanded ? 'Caso ampliado' : 'Caso de la biblioteca'}</span><span>Bloque {clinical.block_id}</span></div>
      <div className="library-front"><h2 tabIndex={-1}>{clinical.answer_kind === 'decision' ? '¿Qué acción o clasificación corresponde?' : '¿Cuál es el diagnóstico?'}</h2><p className="learning-vignette">{clinical.vignette}</p>
        {clinical.difficulty === 'easy' && clinical.discriminator && <p className="learning-hint"><strong>Pista para empezar</strong> {clinical.discriminator}</p>}
        {clinical.difficulty === 'contrast' ? <><label className="learning-recall">Escribe tu diagnóstico y el dato que lo distingue<textarea value={draft} disabled={!!answer || revealed} onChange={event => setDraft(event.target.value)} rows={3} /></label>{!revealed && <button className="coach-primary" disabled={!draft.trim() || disabled} onClick={() => setRevealed(true)}>Comparar diagnóstico</button>}</> : !answer && <div className="learning-diagnoses">{clinical.options.map(option => <button key={option} disabled={busy || disabled || !!retry} onClick={() => void rate(option === clinical.diagnosis ? 3 : 1)}>{option}</button>)}</div>}
      </div>
      {(answer || revealed) && <div className="library-answer"><h3>{clinical.diagnosis}</h3><p>{clinical.explanation}</p><p className="learning-hint"><strong>Dato que distingue</strong> {clinical.discriminator}</p>{clinical.contrast && <p>{clinical.contrast}</p>}
        {revealed && !answer && selfRating}
        <details><summary>Fuentes del caso</summary><ul>{clinical.sources.map((source, i) => <li key={i}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}{source.pages?.length ? ` · pp. ${source.pages.join(', ')}` : ''}</li>)}</ul></details>
        {clinical.corrections?.map(note=><p key={note} className="learning-hint">Actualización de la fuente: {note}</p>)}
        {clinical.expanded && <small>Ampliación didáctica. Revisión clínica profesional pendiente.</small>}
      </div>}
    </article>}
    {decision && <article className="library-card learning-case learning-decision">
      <div className="library-card-bar"><span>Patrones Madre · Decisión {decision.step} de {decision.steps}</span><span>Bloque {decision.block_id}</span></div>
      <ol className="decision-track" aria-label="Pasos de esta ruta">{Array.from({length:decision.steps},(_,i)=><li key={i} aria-current={i+1===decision.step?'step':undefined} className={i+1<decision.step?'past':''}>{i+1}</li>)}</ol>
      <div className="library-front"><h2 tabIndex={-1}>{decision.prompt}</h2><p className="learning-vignette decision-context">{decision.context}</p>
        {decision.options.length ? !answer && <div className="learning-diagnoses">{decision.options.map(option=><button key={option} disabled={busy||disabled||!!retry} onClick={()=>void rate(option===decision.answer?3:1)}>{option}</button>)}</div> : <><label className="learning-recall">Escribe tu siguiente decisión<textarea value={draft} disabled={!!answer||revealed} onChange={event=>setDraft(event.target.value)} rows={3}/></label>{!revealed&&<button className="coach-primary" disabled={!draft.trim()||disabled} onClick={()=>setRevealed(true)}>Comparar decisión</button>}</>}
      </div>
      {(answer||revealed)&&<div className="library-answer"><h3>{decision.answer}</h3><p>{decision.explanation}</p>{answer?.grade===1&&<p>Revisa esta bifurcación. La siguiente pregunta continúa con la decisión correcta.</p>}{revealed&&!answer&&selfRating}
        {decision.corrections?.map(note=><p key={note} className="learning-hint">Actualización de la fuente: {note}</p>)}
        <details><summary>Fuentes de esta decisión</summary><ul>{decision.sources.map((source,i)=><li key={i}>{source.url?<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>:source.label}{source.pages?.length?` · pp. ${source.pages.join(', ')}`:''}</li>)}</ul></details><small>Ruta didáctica basada en fuentes. Revisión clínica profesional pendiente.</small>
      </div>}
    </article>}
    {retry && <div role="alert"><p>No se guardó la respuesta. Conservamos esta pregunta.</p><button disabled={busy || disabled} onClick={() => void rate(retry.grade)}>Reintentar respuesta</button></div>}
    {answer && <div className="learning-answer-result" role="status"><strong>{answer.grade === 1 ? 'Error registrado.' : answer.grade === 2 ? 'Dificultad registrada.' : 'Respuesta correcta.'}</strong><p>Próximo repaso: {dateLabel(answer.due)}. Puedes repetirla hoy.</p><label><input type="checkbox" checked={repeats.has(question.id)} onChange={event => setRepeats(old => { const next = new Set(old); if (event.target.checked) next.add(question.id); else next.delete(question.id); return next; })} />Repetir esta pregunta al terminar</label><button className="coach-primary" disabled={disabled} onClick={() => position + 1 === queue.length ? setFinished(true) : setPosition(old => old + 1)}>{position + 1 === queue.length ? 'Ver resultado' : 'Siguiente pregunta'}</button></div>}
    {notices.map(notice => <p className="learning-milestone" role="status" key={notice}>{notice}</p>)}
  </section>;
}
