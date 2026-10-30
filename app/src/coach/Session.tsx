import { useEffect, useMemo, useRef, useState } from "react";
import StudyCard from "../StudyCard";
import type { StudyCardData } from "../library-types";
import type { ReviewContext } from "../storage";
import { recordReview, dayDiff } from "./engine";
import { loadSection } from "./resources";
import type { CoachCard, CoachIndex, CoachState, Grade } from "./types";

function useActiveTimer(key: string, paused: boolean) {
  const total = useRef(0), started = useRef<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { total.current = 0; started.current = null; setSeconds(0); }, [key]);
  useEffect(() => {
    const synchronize = () => {
      const now = performance.now();
      if (started.current !== null) total.current += now - started.current;
      started.current = !paused && document.visibilityState === "visible" ? now : null;
      setSeconds(Math.floor(total.current / 1000));
    };
    synchronize();
    const timer = setInterval(synchronize, 1000); document.addEventListener("visibilitychange", synchronize);
    return () => { if (started.current !== null) total.current += performance.now() - started.current; started.current = null; clearInterval(timer); document.removeEventListener("visibilitychange", synchronize); };
  }, [paused, key]);
  return { seconds, elapsed: () => Math.min(86_400, Math.max(0, (total.current + (started.current === null ? 0 : performance.now() - started.current)) / 1000)) };
}

const ratings: { value: Grade; name: string; note: string }[] = [ { value: 1, name: "Otra vez", note: "No la recordé" }, { value: 2, name: "Difícil", note: "Costó recordarla" }, { value: 3, name: "Bien", note: "La recordé" }, { value: 4, name: "Fácil", note: "Sin esfuerzo" } ];

export default function Session({ meta, index, state, day, paused, busy, onRate, onReview }: {
  meta: CoachCard; index: CoachIndex; state: CoachState; day: string; paused: boolean; busy: boolean;
  onRate: (rating: Grade, seconds: number) => Promise<void>; onReview: (context: ReviewContext) => void;
}) {
  const [data, setData] = useState<StudyCardData | null>(null), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0), [manualPause, setManualPause] = useState(false), [revealed, setRevealed] = useState(false);
  const valid = data?.id === meta.id ? data : null;
  useEffect(() => {
    let current = true; setError(""); setData(null); setRevealed(false); setManualPause(false);
    loadSection(meta.section_id, index.content_sha256).then(section => {
      const card = section.cards.find(card => card.id === meta.id);
      if (!card) throw new Error("La tarjeta no está disponible.");
      if (current) setData(card);
    }).catch(failure => { if (current) setError((failure as Error).message); });
    return () => { current = false; };
  }, [meta.id, meta.section_id, index.content_sha256, attempt]);
  const timer = useActiveTimer(`${day}/${meta.id}`, paused || busy || manualPause || !valid);
  const previews = useMemo(() => ratings.map(rating => {
    try { const next = recordReview(state, index, meta.id, rating.value, 0, day, `preview-${rating.value}-${meta.id}`); const delta = dayDiff(day, next.progress[meta.id].due_day); return delta === 1 ? "Mañana" : `En ${delta} días`; }
    catch { return "Próximo repaso"; }
  }), [state, index, meta.id, day]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (!revealed || paused || busy || manualPause || !valid || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const grade = Number(event.key);
      if (grade >= 1 && grade <= 4 && event.key.length === 1) { event.preventDefault(); void onRate(grade as Grade, timer.elapsed()); }
    };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  });
  if (error) return <div className="coach-load-error" role="alert"><h2>No se pudo cargar la tarjeta.</h2><p>{error}</p><button className="coach-primary" onClick={() => setAttempt(x => x + 1)}>Reintentar tarjeta</button></div>;
  if (!valid) return <div className="coach-loading" role="status">Preparando tu siguiente tarjeta…</div>;
  return <div className={`coach-session ${manualPause ? "session-paused" : ""}`}>
    <div className="coach-session-toolbar"><span>{state.days[day]?.new_ids.includes(meta.id) ? "Nueva" : "Repaso"} · {meta.family === "eje" ? "Eje Clínico" : `Patrones Madre ${meta.level}`}</span><div><span className="coach-clock" aria-label="Tiempo activo">{Math.floor(timer.seconds / 60)}:{String(timer.seconds % 60).padStart(2, "0")}</span><button onClick={() => setManualPause(value => !value)}>{manualPause ? "Reanudar" : "Pausar"}</button></div></div>
    {manualPause && <div className="coach-pause-screen"><span aria-hidden="true">Ⅱ</span><h2>Tu sesión está en pausa.</h2><p>El reloj se detiene. Retoma cuando estés lista.</p><button className="coach-primary" onClick={() => setManualPause(false)}>Reanudar</button></div>}<div hidden={manualPause}><StudyCard key={valid.id} card={valid} initialHighlight={false} onRate={() => {}} onReveal={() => setRevealed(true)} onReview={() => onReview({ axisId: `libro-${meta.section_id}`, section: "coach", caseId: meta.id, label: `Sesión diaria · ${meta.id}` })} ratingArea={<div className="coach-rating-area"><h3>¿Cómo fue recordarla?</h3><div className="coach-grade-buttons">{ratings.map((rating, i) => <button key={rating.value} className={`grade-${rating.value}`} disabled={busy || paused} onClick={() => void onRate(rating.value, timer.elapsed())}><span>{rating.name}</span><small>{previews[i]}</small><kbd aria-hidden="true">{rating.value}</kbd></button>)}</div><p>«Otra vez» cuenta como práctica. Se programa un repaso, sin marcarla como acierto.</p></div>} /></div>
  </div>;
}
