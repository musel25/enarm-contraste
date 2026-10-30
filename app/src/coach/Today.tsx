import { useEffect, useMemo, useRef, useState } from "react";
import type { ReviewContext } from "../storage";
import { Icon } from "../ui";
import { addDays, addExtra, dayKey, recordReview, summary, undoReview } from "./engine";
import { CardFeedback, Confetti, playReward } from "./Feedback";
import { dateLabel, duration } from "./format";
import Session from "./Session";
import type { CoachIndex, CoachState, Forecast, Grade } from "./types";

type Commit = (change: (previous: CoachState) => CoachState) => Promise<CoachState | null>;
function Progress({ label, done, goal, className = "" }: { label: string; done: number; goal: number; className?: string }) {
  const stops = Math.min(10, goal);
  return <div className={`coach-progress-track ${className} ${label === "Meta diaria" ? "daily-path" : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal || 1} aria-valuenow={done} aria-valuetext={`${done} de ${goal} tarjetas`}><span style={{ width: `${goal ? Math.min(100, done / goal * 100) : 0}%` }} />{label === "Meta diaria" && <div className="coach-path-stops" aria-hidden="true">{Array.from({ length: stops }, (_, i) => <i key={i} className={done >= Math.ceil((i + 1) * goal / stops) ? "reached" : ""}>{i === stops - 1 ? "⚑" : done >= Math.ceil((i + 1) * goal / stops) ? "✓" : ""}</i>)}</div>}</div>;
}

export default function Today({ state, index, day, saving, paused, forecast, calculating, commit, onEdit, onBackup, onReview }: {
  state: CoachState; index: CoachIndex; day: string; saving: boolean; paused: boolean;
  forecast: Forecast | null; calculating: boolean; commit: Commit;
  onEdit: () => void; onBackup: () => void; onReview: (context: ReviewContext) => void;
}) {
  const stats = useMemo(() => summary(state, index, day), [state, index, day]);
  const done = new Set(state.history.filter(a => a.day === day).map(a => a.card_id));
  const pending = [...stats.pending_ids, ...(state.days[day]?.extra_ids || []).filter(id => !done.has(id))];
  const [feedback, setFeedback] = useState<{ id: string; grade: Grade; daily: boolean; course: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [notice, setNotice] = useState("");
  const action = useRef(false);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (delay.current) clearTimeout(delay.current); }, []);
  useEffect(() => { setFeedback(null); setCelebrate(false); setNotice(""); if (delay.current) clearTimeout(delay.current); action.current = false; }, [day]);
  const currentId = feedback?.id || pending[0];
  const meta = index.cards.find(c => c.id === currentId);
  const reduced = state.preferences.low_motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const plan = state.plan!;
  const complete = stats.today_goal > 0 && stats.today_done === stats.today_goal;
  async function rate(grade: Grade, seconds: number) {
    if (action.current || paused || saving || !currentId) return;
    if (dayKey(plan.timezone) !== day) { setNotice("Cambió el día. Estamos preparando tu nueva sesión."); return; }
    action.current = true;
    const saved = await commit(previous => recordReview(previous, index, currentId, grade, seconds, day, crypto.randomUUID()));
    if (!saved) { action.current = false; return; }
    const daily = !state.celebrated_days.includes(day) && saved.celebrated_days.includes(day);
    const course = !state.celebrated_plans.includes(plan.id) && saved.celebrated_plans.includes(plan.id);
    setFeedback({ id: currentId, grade, daily, course });
    if (saved.preferences.sound) playReward();
    delay.current = setTimeout(() => {
      setCelebrate(daily || course); setFeedback(null); action.current = false;
      requestAnimationFrame(() => { document.getElementById("library-card-question")?.focus({ preventScroll: true }); document.querySelector(".coach-session")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" }); });
    }, reduced ? 90 : 650);
  }
  async function undo() {
    if (action.current) return;
    action.current = true;
    await commit(undoReview); setCelebrate(false); action.current = false;
  }
  const activity = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(day, i - 13);
    return { date, count: new Set(state.history.filter(a => a.day === date).map(a => a.card_id)).size };
  });
  return <main className={`coach-main coach-today ${state.preferences.low_motion ? "coach-low-motion" : ""}`} id="study" tabIndex={-1}>
    <div className="coach-today-heading"><div><span className="coach-kicker"><span className="coach-live-dot" />{dateLabel(day)}</span><h1>Un poco más cerca<span>.</span></h1><p>Tu siguiente paso ya está listo.</p></div><button className="coach-edit-button" onClick={onEdit}><Icon name="branch" size={16} />Ajustar mi plan</button></div>
    <section className="coach-daily-banner" aria-label="Tu meta de hoy"><div className="coach-daily-count"><span className="coach-orbit" aria-hidden="true">{complete ? "✓" : "↗"}</span><div><span className="coach-overline">META DE HOY</span><strong>{stats.today_done}<span> / {stats.today_goal}</span><small> tarjetas</small></strong></div></div><div className="coach-daily-meter"><div><span>{complete ? "Tu esfuerzo de hoy ya cuenta." : stats.today_done ? "Una tarjeta a la vez. Ya avanzaste." : "Empieza con una. El resto viene después."}</span><strong>{stats.today_goal ? Math.round(stats.today_done / stats.today_goal * 100) : 0}%</strong></div><Progress label="Meta diaria" done={stats.today_done} goal={stats.today_goal} /><div className="coach-daily-detail"><span>{stats.remaining_seconds ? `≈ ${duration(stats.remaining_seconds)} pendientes` : complete ? "Objetivo cumplido" : "Sin tarjetas asignadas"}</span><span>{state.days[day]?.new_ids.length || 0} nuevas · {Math.max(0, stats.today_goal - (state.days[day]?.new_ids.length || 0))} repasos</span></div></div></section>
    <div className="coach-mobile-course" aria-hidden="true"><span>Primera vuelta <strong>{stats.covered.toLocaleString("es-MX")} / {stats.total.toLocaleString("es-MX")}</strong></span><div><i style={{ width: `${stats.coverage_percent}%` }} /></div></div>
    <div className="coach-today-layout"><div className="coach-focus-column">
      {notice && <p role="status">{notice}</p>}
      {feedback && <CardFeedback grade={feedback.grade} done={stats.today_done} goal={stats.today_goal} />}
      {meta ? <Session key={`${day}/${meta.id}`} meta={meta} index={index} state={state} day={day} paused={paused} busy={saving || !!feedback} onRate={rate} onReview={onReview} /> : <section className="coach-daily-finish" aria-live="polite">
        {celebrate && !reduced && <Confetti />}
        <div className={`coach-finish-seal ${celebrate ? "fresh" : ""}`} aria-hidden="true"><Icon name="check" size={38} /></div>
        <span className="coach-kicker">{complete ? "LO HICISTE" : "TU RITMO, TU PROGRESO"}</span><h2>{complete ? "Tu meta de hoy está completa." : "Hoy tienes espacio para respirar."}</h2>
        <p>{complete ? `Completaste ${stats.today_done} tarjetas de tu meta${stats.extra_done ? ` y ${stats.extra_done} extra` : ""}. Cada sesión construye la siguiente.` : "No hay tarjetas que quepan o estén pendientes en la sesión de hoy. Puedes ajustar tu plan o practicar una extra."}</p>
        <div className="coach-finish-stats"><span><strong>{stats.new_done}</strong>nuevas</span><span><strong>{stats.reviews_done}</strong>repasos</span><span><strong>{Math.round(stats.today_seconds / 60)}</strong>min activos</span></div>
        {stats.covered === stats.total && stats.total > 0 && <p className="coach-course-milestone">✦ Primera vuelta completa. Practicaste todas las tarjetas de tu plan. Los repasos mantienen el camino.</p>}
        <p className="coach-tomorrow">{stats.due_tomorrow} tarjetas tienen repaso mañana. Tu próxima sesión se prepara al volver.</p>
        <button className="coach-primary" disabled={saving || paused || !!feedback} onClick={() => void commit(previous => addExtra(previous, index, day)).then(saved => { if (saved && (saved.days[day]?.extra_ids.length || 0) === (state.days[day]?.extra_ids.length || 0)) setNotice("Ya no quedan tarjetas nuevas ni repasos pendientes para hoy."); })}>Una tarjeta más <Icon name="arrow" size={17} /></button><small>Es opcional. Tu meta de hoy permanece completa.</small>
      </section>}
      <div className="coach-session-bottom"><button className="text-button" disabled={!state.undo || saving || !!feedback || paused} onClick={() => void undo()}><span aria-hidden="true">↶ </span>Deshacer última respuesta</button><span>Guardado en este dispositivo{saving ? " · guardando…" : ""}</span></div>
      {stats.backlog_due > 0 && <div className="coach-backlog" role="status"><strong>{stats.backlog_due} repasos pendientes fuera de tu meta.</strong><p>El tiempo de hoy no alcanza para todos. Aumenta el tiempo diario o añade tarjetas extra. Los repasos vencidos van primero.</p></div>}
    </div><aside className="coach-journey" aria-label="Tu progreso general">
      <section className="coach-course"><span className="coach-overline">TU META GRANDE</span><div className="coach-course-heading"><h2>Primera vuelta</h2><span aria-hidden="true">✦</span></div><strong className="coach-coverage-number">{Math.floor(stats.coverage_percent)}<small>%</small></strong><Progress label="Primera vuelta" done={stats.covered} goal={stats.total} className="course-track" /><p><strong>{stats.covered.toLocaleString("es-MX")}</strong> de {stats.total.toLocaleString("es-MX")} tarjetas practicadas</p><div className="coach-course-forecast"><Icon name="branch" size={17} /><div><span>{plan.mode === "deadline" ? "Tu fecha objetivo" : "Llegada estimada"}</span><strong>{plan.mode === "deadline" ? dateLabel(plan.deadline_day!) : calculating ? "Actualizando…" : forecast?.finish_day ? dateLabel(forecast.finish_day) : "Ajusta tu plan"}</strong><small>{calculating ? "Calculando el ritmo…" : forecast?.feasible ? `${duration(forecast.daily_minutes * 60)} al día · incluye repasos` : "El plan necesita más tiempo."}</small></div></div><small>Practicada una vez no significa dominada. Sigue repasando.</small></section>
      <section className="coach-activity"><h2>Tu constancia</h2><div className="coach-activity-dots" aria-label="Actividad de los últimos 14 días">{activity.map(a => <span key={a.date} className={a.count ? "studied" : ""} title={`${dateLabel(a.date)}: ${a.count} tarjetas`} aria-label={`${dateLabel(a.date)}: ${a.count} tarjetas`}>{a.count ? "✓" : "·"}</span>)}</div><p>Últimos 14 días. Cada sesión cuenta.</p><dl><div><dt>Respuestas de hoy</dt><dd>{stats.attempts_today}</dd></div><div><dt>Marcadas Bien / Fácil</dt><dd>{stats.correct_today}</dd></div><div><dt>Constancia de hoy</dt><dd className="coach-points">+{stats.attempts_today * 10}</dd></div>{stats.extra_done > 0 && <div><dt>Tarjetas extra</dt><dd>{stats.extra_done}</dd></div>}</dl></section>
      <section className="coach-preferences"><label><input type="checkbox" checked={state.preferences.sound} disabled={saving || paused} onChange={e => { const sound = e.target.checked; void commit(previous => ({ ...previous, preferences: { ...previous.preferences, sound } })); }} />Sonido al completar</label><label><input type="checkbox" checked={state.preferences.low_motion} disabled={saving || paused} onChange={e => { const low_motion = e.target.checked; void commit(previous => ({ ...previous, preferences: { ...previous.preferences, low_motion } })); }} />Menos animaciones</label><button className="text-button" onClick={onBackup}>Copia de mi progreso <Icon name="arrow" size={15} /></button></section>
    </aside></div>
  </main>;
}
