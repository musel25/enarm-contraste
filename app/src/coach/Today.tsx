import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReviewContext } from "../storage";
import { Icon } from "../ui";
import { addDays, dayKey, dayLoad, logSession, scopeActive, recordStudy, redistributeBacklog, setDayLoad, setTag, studyQueue, summary, undoReview, type StudyKind } from "./engine";
import { CardFeedback, Confetti, playReward } from "./Feedback";
import { dateLabel, duration } from "./format";
import Session from "./Session";
import { completionNotices } from "../learning/model";
import { DayDetail, HeatLegend, Heatmap } from "./Calendar";
import { coverage, motivationFor, secondsPerCard } from "./insights";
import { BREAK_KEY, TIMER_KEY, TimerDock, elapsedSeconds, notify, pauseTimer, playAlarm, readTimer, saveTimer, startTimer, useNow, type TimerState } from "./Timer";
import type { CardTag, CoachIndex, CoachState, Forecast, Grade, Preferences, SessionScope } from "./types";
import "./today.css";
import type { StudyManifest } from "../library-types";
import SessionScopePicker, { emptyScope, scopeLabel } from "./SessionScope";

type Commit = (change: (previous: CoachState) => CoachState) => Promise<CoachState | null>;
type ActiveSession = { id: string; kind: StudyKind; day: string; started: number; answered: number; active: number };
const SESSION_KEY = "enarm-contraste-session";
const loads = [{ value: 1, label: "Normal" }, { value: 0.5, label: "Menos carga" }, { value: 0, label: "Descanso" }] as const;

function Progress({ label, done, goal, className = "" }: { label: string; done: number; goal: number; className?: string }) {
  const stops = Math.min(10, goal);
  return <div className={`coach-progress-track ${className} ${label === "Meta diaria" ? "daily-path" : ""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal || 1} aria-valuenow={done} aria-valuetext={`${done} de ${goal} tarjetas`}><span style={{ width: `${goal ? Math.min(100, done / goal * 100) : 0}%` }} />{label === "Meta diaria" && <div className="coach-path-stops" aria-hidden="true">{Array.from({ length: stops }, (_, i) => <i key={i} className={done >= Math.ceil((i + 1) * goal / stops) ? "reached" : ""}>{i === stops - 1 ? "⚑" : done >= Math.ceil((i + 1) * goal / stops) ? "✓" : ""}</i>)}</div>}</div>;
}
function newSession(kind: StudyKind, day: string): ActiveSession {
  return { id: crypto.randomUUID(), kind, day, started: Date.now(), answered: 0, active: 0 };
}
function readSession(day: string): ActiveSession | null {
  try { const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); return value?.day === day && (value.kind === "new" || value.kind === "review") ? value : null; }
  catch { return null; }
}

export default function Today({ state, index, manifest, day, saving, paused, forecast, calculating, connected, commit, onEdit, onBackup, onReview }: {
  state: CoachState; index: CoachIndex; manifest: StudyManifest; day: string; saving: boolean; paused: boolean;
  forecast: Forecast | null; calculating: boolean; connected: boolean; commit: Commit;
  onEdit: () => void; onBackup: () => void; onReview: (context: ReviewContext) => void;
}) {
  const stats = useMemo(() => summary(state, index, day), [state, index, day]);
  const plan = state.plan!;
  const prefs = state.preferences;
  const size = prefs.session_size ?? 0;
  const [kind, setKind] = useState<StudyKind>(() => readSession(day)?.kind ?? (stats.new_goal > stats.new_goal_done || !stats.reviews_pending ? "new" : "review"));
  const [extra, setExtra] = useState(0);
  const [session, setSession] = useState<ActiveSession>(() => readSession(day) ?? newSession(kind, day));
  const [summaryOpen, setSummaryOpen] = useState<ActiveSession | null>(null);
  const [timer, setTimerState] = useState<TimerState | null>(() => readTimer(TIMER_KEY));
  const [pause, setPauseState] = useState<TimerState | null>(() => readTimer(BREAK_KEY));
  const [selectedDay, setSelectedDay] = useState(day);
  const [settings, setSettings] = useState(false);
  const [scopeDraft, setScopeDraft] = useState<SessionScope>(emptyScope);
  const [spread, setSpread] = useState(3);
  const [feedback, setFeedback] = useState<{ id: string; grade: Grade; fresh: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [notice, setNotice] = useState("");
  const [cheer, setCheer] = useState<{ count: number; text: string } | null>(null);
  const action = useRef(false);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setTimer = (value: TimerState | null) => { saveTimer(TIMER_KEY, value); setTimerState(value); };
  const setPause = (value: TimerState | null) => { saveTimer(BREAK_KEY, value); setPauseState(value); };
  useEffect(() => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* The session still works in this tab. */ } }, [session]);
  useEffect(() => () => { if (delay.current) clearTimeout(delay.current); }, []);
  useEffect(() => {
    setFeedback(null); setCelebrate(false); setNotice(""); setSelectedDay(day); setExtra(0);
    if (delay.current) clearTimeout(delay.current); action.current = false;
    setSession(old => old.day === day ? old : newSession(old.kind, day));
  }, [day]);
  // Alert once when a countdown reaches zero.
  const now = useNow(!!(timer || pause));
  useEffect(() => {
    for (const [value, set, title] of [[timer, setTimer, "Terminó tu sesión de estudio"], [pause, setPause, "Terminó tu descanso"]] as const) {
      if (value && value.target !== null && !value.alerted && elapsedSeconds(value, now) >= value.target) {
        set({ ...value, alerted: true }); playAlarm();
        notify(title, value.mode === "study" ? `Respondiste ${session.answered} tarjetas en esta sesión.` : "Cuando quieras, seguimos con la siguiente tarjeta.");
      }
    }
  });

  const queue = useMemo(() => studyQueue(state, index, day, kind), [state, index, day, kind]);
  const scope = prefs.session_scope, scoped = scopeActive(scope);
  const scopedCounts = useMemo(() => scoped ? { fresh: studyQueue(state, index, day, "new").recommended, reviews: studyQueue(state, index, day, "review").ids.length } : null, [scoped, state, index, day]);
  const clearScope = () => void commit(previous => ({ ...previous, preferences: { ...previous.preferences, session_scope: undefined } }));
  const ids = kind === "new" ? queue.ids.slice(0, queue.recommended + extra) : queue.ids;
  const full = size > 0 && session.answered >= size;
  const onBreak = !!pause;
  const currentId = feedback?.id || (full || summaryOpen ? undefined : ids[0]);
  const meta = index.cards.find(c => c.id === currentId);
  const reduced = prefs.low_motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const complete = stats.today_goal > 0 && stats.today_done === stats.today_goal;
  const load = dayLoad(state, day), weeklyLoad = dayLoad({ plan }, day);
  const budgetMinutes = plan.mode === "deadline" && forecast?.feasible ? forecast.daily_minutes : plan.minutes_per_day;
  const pace = secondsPerCard(state);
  const span = useMemo(() => Array.from({ length: 30 }, (_, n) => addDays(day, n - 29)), [day]);
  const cover = useMemo(() => coverage(state, index), [state, index]);

  async function closeSession(current: ActiveSession, next: StudyKind = current.kind) {
    setSummaryOpen(null);
    setSession(newSession(next, day));
    if (!current.answered) return;
    const entry = { id: current.id, day: current.day, kind: current.kind, started_at: new Date(current.started).toISOString(),
      wall_seconds: Math.min(86_400, Math.round((Date.now() - current.started) / 1000)), active_seconds: Math.min(86_400, Math.round(current.active)),
      cards: current.answered, target_seconds: timer?.target ?? null };
    await commit(previous => logSession(previous, entry));
  }
  function switchKind(next: StudyKind) {
    if (next === kind || saving) return;
    // A tab click ends the short answer feedback at once.
    if (feedback) { if (delay.current) clearTimeout(delay.current); setFeedback(null); action.current = false; }
    setKind(next); setExtra(0); setNotice("");
    void closeSession(session, next);
  }
  async function rate(grade: Grade, seconds: number) {
    if (action.current || paused || saving || onBreak || !currentId) return;
    if (dayKey(plan.timezone) !== day) { setNotice("Cambió el día. Estamos preparando tu nueva sesión."); return; }
    action.current = true;
    const fresh = !state.progress[currentId];
    if (kind === "new" && ids.indexOf(currentId) >= queue.recommended) setExtra(left => Math.max(0, left - 1));
    const saved = await commit(previous => recordStudy(previous, index, currentId, grade, seconds, day, crypto.randomUUID()));
    if (!saved) { action.current = false; return; }
    const milestones = completionNotices(state, saved, { ...index, cards: index.cards.filter(card => plan.section_ids.includes(card.section_id) && plan.families.includes(card.family)) });
    setNotice(milestones.length ? milestones.map(item => `${item.kind === "block" ? "Bloque completo" : "Sección completa"}: ${item.id}. Primera vuelta de los formatos de tu plan terminada.`).join(" ") : "");
    const daily = !state.celebrated_days.includes(day) && saved.celebrated_days.includes(day);
    const course = !state.celebrated_plans.includes(plan.id) && saved.celebrated_plans.includes(plan.id);
    const answered = { ...session, answered: session.answered + 1, active: session.active + seconds };
    setSession(answered);
    const count = saved.history.filter(a => a.day === day).length;
    const text = motivationFor(count, prefs.motivation_every ?? 50);
    if (text) setCheer({ count, text });
    setFeedback({ id: currentId, grade, fresh });
    if (saved.preferences.sound) playReward();
    delay.current = setTimeout(() => {
      setCelebrate(daily || course); setFeedback(null); action.current = false;
      if (size > 0 && answered.answered >= size) setSummaryOpen(answered);
      requestAnimationFrame(() => { document.getElementById("library-card-question")?.focus({ preventScroll: true }); document.querySelector(".today-tabs")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" }); });
    }, reduced ? 90 : 650);
  }
  async function undo() {
    if (action.current) return;
    action.current = true;
    const saved = await commit(undoReview);
    if (saved) { setCelebrate(false); setNotice(""); setSession(old => ({ ...old, answered: Math.max(0, old.answered - 1) })); }
    action.current = false;
  }
  function changeLoad(value: number) {
    void commit(previous => setDayLoad(previous, index, day, value === dayLoad({ plan: previous.plan }, day) ? null : value, budgetMinutes));
  }
  function savePreferences(change: Partial<Preferences>) {
    void commit(previous => ({ ...previous, preferences: { ...previous.preferences, ...change } }));
  }
  function startStudyTimer() {
    if (!session.answered) setSession(old => ({ ...old, started: Date.now() }));
    setTimer(startTimer("study", prefs.timer_minutes || null));
  }
  function takeBreak() {
    if (timer) setTimer(pauseTimer(timer, true));
    setPause(startTimer("break", prefs.break_minutes ?? 5));
  }
  async function endBreak() {
    const value = pause;
    setPause(null);
    if (timer) setTimer(pauseTimer(timer, false));
    if (!value) return;
    const seconds = Math.round(elapsedSeconds(value));
    if (seconds < 5) return;
    await commit(previous => logSession(previous, { id: crypto.randomUUID(), day, kind: "break", started_at: new Date(value.started).toISOString(),
      wall_seconds: Math.min(86_400, seconds), active_seconds: 0, cards: 0, target_seconds: value.target }));
  }
  const tagChange = (id: string) => (change: Partial<CardTag>) => void commit(previous => setTag(previous, id, change));
  const sessionPace = pace ? Math.max(1, Math.floor((prefs.timer_minutes || 25) * 60 / pace)) : null;

  let focus: ReactNode;
  if (onBreak) focus = <section className="today-break" aria-live="polite"><span aria-hidden="true">☕</span><h2>Estás en descanso.</h2><p>La sesión espera. Estírate, toma agua y respira.</p><button className="coach-primary" onClick={() => void endBreak()}>Volver a estudiar</button></section>;
  else if (summaryOpen) {
    const minutes = Math.max(1, Math.round((Date.now() - summaryOpen.started) / 60_000));
    focus = <section className="today-session-summary" aria-live="polite">
      <span className="coach-kicker">SESIÓN COMPLETA</span><h2>Terminaste {summaryOpen.answered} tarjetas.</h2>
      <div className="coach-finish-stats"><span><strong>{summaryOpen.answered}</strong>tarjetas</span><span><strong>{minutes}</strong>min de sesión</span><span><strong>{summaryOpen.active > 0 ? Math.round(summaryOpen.answered / Math.max(1, summaryOpen.active / 60)) : "—"}</strong>por min activo</span></div>
      <div className="today-summary-actions"><button className="coach-primary" onClick={() => void closeSession(summaryOpen)}>Otra sesión de {size} <Icon name="arrow" size={16} /></button><button className="coach-edit-button" onClick={() => { void closeSession(summaryOpen); takeBreak(); }}>Tomar un descanso</button></div>
    </section>;
  } else if (meta) focus = <Session key={`${day}/${meta.id}`} meta={meta} index={index} state={state} day={day} paused={paused} busy={saving || !!feedback} onRate={rate} onReview={onReview} tag={state.tags?.[meta.id]} onTag={tagChange(meta.id)} />;
  else if (kind === "review") focus = <section className="coach-daily-finish" aria-live="polite">
    <div className="coach-finish-seal" aria-hidden="true"><Icon name="check" size={38} /></div>
    <span className="coach-kicker">REPASOS AL DÍA</span><h2>{scoped && stats.reviews_pending ? "No quedan repasos en tu selección." : "No quedan repasos para hoy."}</h2>
    {scoped && stats.reviews_pending > 0 && <p>Hay {stats.reviews_pending} repasos en otras secciones o formatos. <button className="text-button" disabled={saving} onClick={clearScope}>Usar todo mi plan</button></p>}
    <p>{stats.due_tomorrow} tarjetas tienen repaso mañana. {stats.new_goal > stats.new_goal_done ? `Aún tienes ${stats.new_goal - stats.new_goal_done} temas nuevos recomendados.` : ""}</p>
    {stats.new_goal > stats.new_goal_done && <button className="coach-primary" onClick={() => switchKind("new")}>Ir a temas nuevos <Icon name="arrow" size={17} /></button>}
  </section>;
  else if (kind === "new" && scoped && !complete && !(load === 0 && !extra && stats.today_goal === 0)) focus = <section className="coach-daily-finish" aria-live="polite">
    <div className="coach-finish-seal" aria-hidden="true"><Icon name="check" size={38} /></div>
    <span className="coach-kicker">TU SELECCIÓN</span><h2>{extra ? "No quedan tarjetas nuevas en tu selección." : "No quedan tarjetas recomendadas hoy en tu selección."}</h2>
    <p>{stats.new_goal > stats.new_goal_done ? `Tu meta de hoy tiene ${stats.new_goal - stats.new_goal_done} temas nuevos en otras secciones o formatos.` : "Tu selección está al día."}</p>
    <div className="today-summary-actions">
      {!extra && queue.ids.length > 0 && <button className="coach-primary" onClick={() => setExtra(Infinity)}>Seguir con temas nuevos de tu selección <Icon name="arrow" size={17} /></button>}
      <button className="coach-edit-button" disabled={saving} onClick={clearScope}>Usar todo mi plan</button>
    </div>
  </section>;
  else if (load === 0 && !extra && stats.today_goal === 0 && !stats.today_done) focus = <section className="coach-daily-finish today-rest" aria-live="polite">
    <span aria-hidden="true" className="today-rest-mark">☾</span><span className="coach-kicker">DÍA DE DESCANSO</span><h2>Hoy descansas. También es parte del plan.</h2>
    <p>Tu plan reparte las tarjetas en los días de estudio. Los repasos no se pierden.</p>
    <button className="coach-primary" onClick={() => setExtra(Infinity)}>Estudiar de todos modos <Icon name="arrow" size={17} /></button>
  </section>;
  else focus = <section className="coach-daily-finish" aria-live="polite">
    {celebrate && !reduced && <Confetti />}
    <div className={`coach-finish-seal ${celebrate ? "fresh" : ""}`} aria-hidden="true"><Icon name="check" size={38} /></div>
    <span className="coach-kicker">{complete ? "LO HICISTE" : "TU RITMO, TU PROGRESO"}</span>
    <h2>{complete ? "Tu meta de hoy está completa." : extra ? "No quedan tarjetas nuevas en tu plan." : stats.new_goal ? "Terminaste los temas nuevos de hoy." : "Hoy tienes espacio para respirar."}</h2>
    <p>{complete ? `Completaste ${stats.today_done} tarjetas de tu meta${stats.extra_done ? ` y ${stats.extra_done} extra` : ""}. Cada sesión construye la siguiente.` : stats.reviews_pending ? `Te quedan ${stats.reviews_pending} repasos. Puedes hacerlos ahora o más tarde.` : "No hay tarjetas nuevas pendientes en la meta de hoy."}</p>
    <div className="coach-finish-stats"><span><strong>{stats.new_done}</strong>nuevas</span><span><strong>{stats.reviews_done_today}</strong>repasos</span><span><strong>{Math.round(stats.today_seconds / 60)}</strong>min activos</span></div>
    {stats.covered === stats.total && stats.total > 0 && <p className="coach-course-milestone">✦ Primera vuelta completa. Practicaste todas las tarjetas de tu plan. Los repasos mantienen el camino.</p>}
    <p className="coach-tomorrow">{stats.due_tomorrow} tarjetas tienen repaso mañana. Tu próxima sesión se prepara al volver.</p>
    <div className="today-summary-actions">
      {stats.reviews_pending > 0 && <button className="coach-primary" onClick={() => switchKind("review")}>Ir a repasos ({stats.reviews_pending})</button>}
      {!extra && queue.ids.length > 0 && <button className={stats.reviews_pending ? "coach-edit-button" : "coach-primary"} disabled={saving || paused || !!feedback} onClick={() => setExtra(1)}>Una tarjeta más <Icon name="arrow" size={17} /></button>}
      {!extra && queue.ids.length > 1 && <button className="coach-edit-button" disabled={saving || paused || !!feedback} onClick={() => setExtra(Infinity)}>Seguir con temas nuevos</button>}
    </div>
    <small>Es opcional. Tu meta de hoy permanece completa.</small>
  </section>;

  return <main className={`coach-main coach-today ${prefs.low_motion ? "coach-low-motion" : ""}`} id="study" tabIndex={-1}>
    <div className="coach-today-heading"><div><span className="coach-kicker"><span className="coach-live-dot" />{dateLabel(day)}</span><h1 id="coach-today-title" tabIndex={-1}>Un poco más cerca<span>.</span></h1><p>Elige: temas nuevos o repasos. Tú decides el tamaño de la sesión.</p></div><button className="coach-edit-button" onClick={onEdit}><Icon name="branch" size={16} />Ajustar mi plan</button></div>
    <div className="today-load" role="group" aria-label="Carga de hoy"><span>¿Cómo está tu día?</span>{loads.map(option => <button key={option.value} aria-pressed={load === option.value} disabled={saving || paused} onClick={() => changeLoad(option.value)}>{option.label}</button>)}{weeklyLoad !== 1 && <small>Tu semana marca hoy como {weeklyLoad === 0 ? "descanso" : "día ligero"}.</small>}</div>
    <section className="coach-daily-banner" aria-label="Tu meta de hoy"><div className="coach-daily-count"><span className="coach-orbit" aria-hidden="true">{complete ? "✓" : "↗"}</span><div><span className="coach-overline">META DE HOY</span><strong>{stats.today_done}<span> / {stats.today_goal}</span><small> tarjetas</small></strong></div></div><div className="coach-daily-meter"><div><span>{complete ? "Tu esfuerzo de hoy ya cuenta." : stats.today_done ? "Una tarjeta a la vez. Ya avanzaste." : "Empieza con una. El resto viene después."}</span><strong>{stats.today_goal ? Math.round(stats.today_done / stats.today_goal * 100) : 0}%</strong></div><Progress label="Meta diaria" done={stats.today_done} goal={stats.today_goal} /><div className="coach-daily-detail"><span>{stats.remaining_seconds ? `≈ ${duration(stats.remaining_seconds)} pendientes` : complete ? "Objetivo cumplido" : "Sin tarjetas asignadas"}</span><span>{stats.new_goal} nuevas · {Math.max(0, stats.today_goal - stats.new_goal)} repasos{load < 1 ? ` · ${load ? "día ligero" : "descanso"}` : ""}</span></div></div></section>
    <div className="coach-mobile-course" aria-hidden="true"><span>Primera vuelta <strong>{stats.covered.toLocaleString("es-MX")} / {stats.total.toLocaleString("es-MX")}</strong></span><div><i style={{ width: `${stats.coverage_percent}%` }} /></div></div>
    <div className="coach-today-layout"><div className="coach-focus-column">
      <div className="today-tabs" role="tablist" aria-label="Tipo de sesión">
        <button role="tab" aria-selected={kind === "new"} onClick={() => switchKind("new")}><strong>Temas nuevos</strong><small>{stats.new_goal_done} de {stats.new_goal} recomendadas hoy{scopedCounts ? ` · ${scopedCounts.fresh} en tu selección` : ""}</small></button>
        <button role="tab" aria-selected={kind === "review"} onClick={() => switchKind("review")}><strong>Repasos</strong><small>{stats.reviews_pending ? `${stats.reviews_pending} pendientes` : "Al día"}{scopedCounts ? ` · ${scopedCounts.reviews} en tu selección` : ` · ${stats.reviews_done_today} hechos`}</small></button>
      </div>
      <div className="today-session-bar">
        <span>{kind === "new" ? "Sesión de temas nuevos" : "Sesión de repaso"} · <strong>{session.answered}{size ? ` de ${size}` : ""}</strong> {size ? "tarjetas" : session.answered === 1 ? "tarjeta" : "tarjetas"}</span>
        <div>
          {!timer && <button onClick={startStudyTimer}>⏱ {prefs.timer_minutes ? `Temporizador ${prefs.timer_minutes} min` : "Cronometrar sesión"}</button>}
          {!onBreak && <button onClick={takeBreak}>☕ Descanso</button>}
          {session.answered > 0 && !summaryOpen && <button onClick={() => setSummaryOpen(session)}>Terminar sesión</button>}
          <button aria-expanded={settings} onClick={() => { setScopeDraft(scope ?? emptyScope); setSettings(open => !open); }}>Personalizar</button>
        </div>
      </div>
      {scoped && <div className="today-scope" role="status"><span>Solo: <strong>{scopeLabel(scope!, manifest)}</strong></span><button className="text-button" disabled={saving} onClick={clearScope}>Quitar filtro</button></div>}
      {settings && <form className="today-settings" aria-label="Personalizar sesión" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const read = (name: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(data.get(name)) || 0))); savePreferences({ session_size: read("size", 0, 500), timer_minutes: read("timer", 0, 600), break_minutes: Math.max(1, read("break", 1, 120)), motivation_every: read("cheer", 0, 500), session_scope: scopeActive(scopeDraft) ? scopeDraft : undefined }); setExtra(0); setSettings(false); }}>
        <label>Tarjetas por sesión<input name="size" type="number" min={0} max={500} defaultValue={size} /><small>0 = sin límite</small></label>
        <label>Temporizador (min)<input name="timer" type="number" min={0} max={600} defaultValue={prefs.timer_minutes ?? 25} /><small>0 = solo cronómetro</small></label>
        <label>Descanso (min)<input name="break" type="number" min={1} max={120} defaultValue={prefs.break_minutes ?? 5} /></label>
        <label>Frase motivadora cada<input name="cheer" type="number" min={0} max={500} defaultValue={prefs.motivation_every ?? 50} /><small>tarjetas · 0 = nunca</small></label>
        <SessionScopePicker value={scopeDraft} onChange={setScopeDraft} manifest={manifest} index={index} sectionIds={plan.section_ids} planFamilies={plan.families} />
        <p className="today-pace">{pace ? <>Tu ritmo: <strong>≈ {Math.round(pace)} s</strong> por tarjeta. En {prefs.timer_minutes || 25} min haces ≈ <strong>{sessionPace}</strong> tarjetas.{size ? ` ${size} tarjetas toman ≈ ${duration(size * pace)}.` : ""}{stats.today_goal > stats.today_done ? ` Lo que falta de tu meta toma ≈ ${duration((stats.today_goal - stats.today_done) * pace)}.` : ""}</> : "Responde unas tarjetas más para calcular tu ritmo."}</p>
        <button className="coach-primary" type="submit" disabled={saving}>Guardar</button>
      </form>}
      {notice && <p role="status">{notice}</p>}
      {cheer && <div className="today-cheer" role="status"><span aria-hidden="true">✦</span><div><strong>{cheer.count} tarjetas hoy</strong><p>{cheer.text}</p></div><button className="text-button" onClick={() => setCheer(null)}>Gracias</button></div>}
      {feedback && <CardFeedback grade={feedback.grade} fresh={feedback.fresh} done={stats.today_done} goal={stats.today_goal} />}
      {focus}
      <div className="coach-session-bottom"><button className="text-button" disabled={!state.undo || saving || !!feedback || paused} onClick={() => void undo()}><span aria-hidden="true">↶ </span>Deshacer última respuesta</button><span>{saving ? "Guardando en el VPS…" : connected ? "Guardado en el VPS" : "Copia local · VPS sin conexión"}</span></div>
      {kind === "review" && stats.reviews_pending > 0 && <div className="coach-backlog" role="status"><strong>{stats.reviews_pending} repasos pendientes hoy.</strong><p>Si no los terminas, pasan a mañana. También puedes repartirlos en varios días.</p><div className="today-spread"><label>Repartir en<select value={spread} onChange={e => setSpread(Number(e.target.value))}>{[2, 3, 5, 7].map(n => <option key={n} value={n}>{n} días</option>)}</select></label><button disabled={saving || paused} onClick={() => void commit(previous => redistributeBacklog(previous, index, day, spread)).then(saved => { if (saved) setNotice(`Repartimos tus repasos en ${spread} días. Hoy quedan ${summary(saved, index, day).reviews_pending}.`); })}>Repartir</button></div></div>}
      {kind === "new" && stats.backlog_due > 0 && <div className="coach-backlog" role="status"><strong>{stats.backlog_due} repasos pendientes fuera de tu meta.</strong><p>Están en la pestaña Repasos. Puedes hacerlos o repartirlos en varios días.</p></div>}
    </div><aside className="coach-journey" aria-label="Tu progreso general">
      <section className="coach-course"><span className="coach-overline">TU META GRANDE</span><div className="coach-course-heading"><h2>Primera vuelta</h2><span aria-hidden="true">✦</span></div><strong className="coach-coverage-number">{Math.floor(stats.coverage_percent)}<small>%</small></strong><Progress label="Primera vuelta" done={stats.covered} goal={stats.total} className="course-track" /><p><strong>{stats.covered.toLocaleString("es-MX")}</strong> de {stats.total.toLocaleString("es-MX")} tarjetas practicadas</p>
        <dl className="today-coverage"><div><dt>Bloques completos</dt><dd>{cover.blocks_done} de {cover.blocks}</dd></div><div><dt>Bloques empezados</dt><dd>{cover.blocks_started}</dd></div><div><dt>Bloques por empezar</dt><dd>{cover.blocks - cover.blocks_started}</dd></div><div><dt>Secciones completas</dt><dd>{cover.sections_done} de {cover.sections}</dd></div><div><dt>Secciones empezadas</dt><dd>{cover.sections_started}</dd></div></dl>
        <div className="coach-course-forecast"><Icon name="branch" size={17} /><div><span>{plan.mode === "deadline" ? "Tu fecha objetivo" : "Llegada estimada"}</span><strong>{plan.mode === "deadline" ? dateLabel(plan.deadline_day!) : calculating ? "Actualizando…" : forecast?.finish_day ? dateLabel(forecast.finish_day) : "Ajusta tu plan"}</strong><small>{calculating ? "Calculando el ritmo…" : forecast?.feasible ? `${duration(forecast.daily_minutes * 60)} al día · incluye repasos` : "El plan necesita más tiempo."}</small></div></div><small>Practicada una vez no significa dominada. Sigue repasando.</small></section>
      <section className="coach-activity"><h2>Tu constancia</h2><Heatmap state={state} days={span} selected={selectedDay} onSelect={setSelectedDay} label="Actividad de los últimos 30 días" layout="grid" /><HeatLegend /><p>Últimos 30 días. El verde brilla más con cada 50 respuestas. Toca un día para ver su progreso.</p>
        <DayDetail state={state} index={index} day={selectedDay} today={day} /></section>
      <section className="coach-preferences"><label><input type="checkbox" checked={prefs.sound} disabled={saving || paused} onChange={e => savePreferences({ sound: e.target.checked })} />Sonido al completar</label><label><input type="checkbox" checked={prefs.low_motion} disabled={saving || paused} onChange={e => savePreferences({ low_motion: e.target.checked })} />Menos animaciones</label><button className="text-button" onClick={onBackup}>Copia de mi progreso <Icon name="arrow" size={15} /></button></section>
    </aside></div>
    {(pause || timer) && <TimerDock timer={(pause || timer)!} cards={session.answered} onPause={value => pause ? setPause(pauseTimer(pause, value)) : setTimer(pauseTimer(timer!, value))} onStop={() => pause ? void endBreak() : setTimer(null)} onBreak={pause ? undefined : takeBreak} />}
  </main>;
}
