import type { ReactNode } from "react";
import type { ReviewContext } from "../storage";
import { Icon } from "../ui";
import { redistributeBacklog, summary } from "./engine";
import { CardFeedback, Confetti } from "./Feedback";
import { dateLabel, duration } from "./format";
import Session from "./Session";
import { TimerDock, pauseTimer } from "./Timer";
import type { CoachIndex, CoachState, Forecast } from "./types";
import "./today.css";
import type { StudyManifest } from "../library-types";
import { scopeLabel } from "./SessionScope";
import SessionSettings from "./SessionSettings";
import TodayJourney from "./TodayJourney";
import Progress from "./Progress";
import { useTodayStudy } from "./useTodayStudy";

type Commit = (change: (previous: CoachState) => CoachState) => Promise<CoachState | null>;
const loads = [
  { value: 1, label: "Normal" },
  { value: 0.5, label: "Menos carga" },
  { value: 0, label: "Descanso" },
] as const;

export default function Today({
  state,
  index,
  manifest,
  day,
  saving,
  paused,
  forecast,
  calculating,
  connected,
  commit,
  onEdit,
  onBackup,
  onReview,
}: {
  state: CoachState;
  index: CoachIndex;
  manifest: StudyManifest;
  day: string;
  saving: boolean;
  paused: boolean;
  forecast: Forecast | null;
  calculating: boolean;
  connected: boolean;
  commit: Commit;
  onEdit: () => void;
  onBackup: () => void;
  onReview: (context: ReviewContext) => void;
}) {
  const {
    stats,
    prefs,
    size,
    kind,
    extra,
    setExtra,
    session,
    summaryOpen,
    setSummaryOpen,
    timer,
    pause,
    setTimer,
    setPause,
    startStudyTimer,
    takeBreak,
    endBreak,
    settings,
    setSettings,
    spread,
    setSpread,
    feedback,
    celebrate,
    notice,
    setNotice,
    cheer,
    setCheer,
    queue,
    scope,
    scoped,
    scopedCounts,
    clearScope,
    onBreak,
    meta,
    reduced,
    complete,
    load,
    weeklyLoad,
    closeSession,
    switchKind,
    rate,
    undo,
    changeLoad,
    savePreferences,
    tagChange,
  } = useTodayStudy({ state, index, day, saving, paused, forecast, commit });

  let focus: ReactNode;
  if (onBreak)
    focus = (
      <section className="today-break" aria-live="polite">
        <span aria-hidden="true">☕</span>
        <h2>Estás en descanso.</h2>
        <p>La sesión espera. Estírate, toma agua y respira.</p>
        <button className="coach-primary" onClick={() => void endBreak()}>
          Volver a estudiar
        </button>
      </section>
    );
  else if (summaryOpen) {
    const minutes = Math.max(1, Math.round((Date.now() - summaryOpen.started) / 60_000));
    focus = (
      <section className="today-session-summary" aria-live="polite">
        <span className="coach-kicker">SESIÓN COMPLETA</span>
        <h2>Terminaste {summaryOpen.answered} tarjetas.</h2>
        <div className="coach-finish-stats">
          <span>
            <strong>{summaryOpen.answered}</strong>tarjetas
          </span>
          <span>
            <strong>{minutes}</strong>min de sesión
          </span>
          <span>
            <strong>
              {summaryOpen.active > 0
                ? Math.round(summaryOpen.answered / Math.max(1, summaryOpen.active / 60))
                : "—"}
            </strong>
            por min activo
          </span>
        </div>
        <div className="today-summary-actions">
          <button className="coach-primary" onClick={() => void closeSession(summaryOpen)}>
            Otra sesión de {size} <Icon name="arrow" size={16} />
          </button>
          <button
            className="coach-edit-button"
            onClick={() => {
              void closeSession(summaryOpen);
              takeBreak();
            }}
          >
            Tomar un descanso
          </button>
        </div>
      </section>
    );
  } else if (meta)
    focus = (
      <Session
        key={`${day}/${meta.id}`}
        meta={meta}
        index={index}
        state={state}
        day={day}
        paused={paused}
        busy={saving || !!feedback}
        onRate={rate}
        onReview={onReview}
        tag={state.tags?.[meta.id]}
        onTag={tagChange(meta.id)}
      />
    );
  else if (kind === "review")
    focus = (
      <section className="coach-daily-finish" aria-live="polite">
        <div className="coach-finish-seal" aria-hidden="true">
          <Icon name="check" size={38} />
        </div>
        <span className="coach-kicker">REPASOS AL DÍA</span>
        <h2>
          {scoped && stats.reviews_pending
            ? "No quedan repasos en tu selección."
            : "No quedan repasos para hoy."}
        </h2>
        {scoped && stats.reviews_pending > 0 && (
          <p>
            Hay {stats.reviews_pending} repasos en otras secciones o formatos.{" "}
            <button className="text-button" disabled={saving} onClick={clearScope}>
              Usar todo mi plan
            </button>
          </p>
        )}
        <p>
          {stats.due_tomorrow} tarjetas tienen repaso mañana.{" "}
          {stats.new_goal > stats.new_goal_done
            ? `Aún tienes ${stats.new_goal - stats.new_goal_done} temas nuevos recomendados.`
            : ""}
        </p>
        {stats.new_goal > stats.new_goal_done && (
          <button className="coach-primary" onClick={() => switchKind("new")}>
            Ir a temas nuevos <Icon name="arrow" size={17} />
          </button>
        )}
      </section>
    );
  else if (
    kind === "new" &&
    scoped &&
    !complete &&
    !(load === 0 && !extra && stats.today_goal === 0)
  )
    focus = (
      <section className="coach-daily-finish" aria-live="polite">
        <div className="coach-finish-seal" aria-hidden="true">
          <Icon name="check" size={38} />
        </div>
        <span className="coach-kicker">TU SELECCIÓN</span>
        <h2>
          {extra
            ? "No quedan tarjetas nuevas en tu selección."
            : "No quedan tarjetas recomendadas hoy en tu selección."}
        </h2>
        {scopedCounts && scopedCounts.left > 0 && (
          <p>
            <strong>
              Faltan {scopedCounts.left.toLocaleString("es-MX")} de{" "}
              {scopedCounts.total.toLocaleString("es-MX")} tarjetas
            </strong>{" "}
            para terminar tu selección.
          </p>
        )}
        <p>
          {stats.new_goal > stats.new_goal_done
            ? `Tu meta de hoy tiene ${stats.new_goal - stats.new_goal_done} temas nuevos en otras secciones o formatos.`
            : "Tu selección está al día."}
        </p>
        <div className="today-summary-actions">
          {!extra && queue.ids.length > 0 && (
            <button className="coach-primary" onClick={() => setExtra(Infinity)}>
              Seguir con temas nuevos de tu selección <Icon name="arrow" size={17} />
            </button>
          )}
          <button className="coach-edit-button" disabled={saving} onClick={clearScope}>
            Usar todo mi plan
          </button>
        </div>
      </section>
    );
  else if (load === 0 && !extra && stats.today_goal === 0 && !stats.today_done)
    focus = (
      <section className="coach-daily-finish today-rest" aria-live="polite">
        <span aria-hidden="true" className="today-rest-mark">
          ☾
        </span>
        <span className="coach-kicker">DÍA DE DESCANSO</span>
        <h2>Hoy descansas. También es parte del plan.</h2>
        <p>Tu plan reparte las tarjetas en los días de estudio. Los repasos no se pierden.</p>
        <button className="coach-primary" onClick={() => setExtra(Infinity)}>
          Estudiar de todos modos <Icon name="arrow" size={17} />
        </button>
      </section>
    );
  else
    focus = (
      <section className="coach-daily-finish" aria-live="polite">
        {celebrate && !reduced && <Confetti />}
        <div className={`coach-finish-seal ${celebrate ? "fresh" : ""}`} aria-hidden="true">
          <Icon name="check" size={38} />
        </div>
        <span className="coach-kicker">{complete ? "LO HICISTE" : "TU RITMO, TU PROGRESO"}</span>
        <h2>
          {complete
            ? "Tu meta de hoy está completa."
            : extra
              ? "No quedan tarjetas nuevas en tu plan."
              : stats.new_goal
                ? "Terminaste los temas nuevos de hoy."
                : "Hoy tienes espacio para respirar."}
        </h2>
        <p>
          {complete
            ? `Completaste ${stats.today_done} tarjetas de tu meta${stats.extra_done ? ` y ${stats.extra_done} extra` : ""}. Cada sesión construye la siguiente.`
            : stats.reviews_pending
              ? `Te quedan ${stats.reviews_pending} repasos. Puedes hacerlos ahora o más tarde.`
              : "No hay tarjetas nuevas pendientes en la meta de hoy."}
        </p>
        <div className="coach-finish-stats">
          <span>
            <strong>{stats.new_done}</strong>nuevas
          </span>
          <span>
            <strong>{stats.reviews_done_today}</strong>repasos
          </span>
          <span>
            <strong>{Math.round(stats.today_seconds / 60)}</strong>min activos
          </span>
        </div>
        {stats.covered === stats.total && stats.total > 0 && (
          <p className="coach-course-milestone">
            ✦ Primera vuelta completa. Practicaste todas las tarjetas de tu plan. Los repasos
            mantienen el camino.
          </p>
        )}
        <p className="coach-tomorrow">
          {stats.due_tomorrow} tarjetas tienen repaso mañana. Tu próxima sesión se prepara al
          volver.
        </p>
        <div className="today-summary-actions">
          {stats.reviews_pending > 0 && (
            <button className="coach-primary" onClick={() => switchKind("review")}>
              Ir a repasos ({stats.reviews_pending})
            </button>
          )}
          {!extra && queue.ids.length > 0 && (
            <button
              className={stats.reviews_pending ? "coach-edit-button" : "coach-primary"}
              disabled={saving || paused || !!feedback}
              onClick={() => setExtra(1)}
            >
              Una tarjeta más <Icon name="arrow" size={17} />
            </button>
          )}
          {!extra && queue.ids.length > 1 && (
            <button
              className="coach-edit-button"
              disabled={saving || paused || !!feedback}
              onClick={() => setExtra(Infinity)}
            >
              Seguir con temas nuevos
            </button>
          )}
        </div>
        <small>Es opcional. Tu meta de hoy permanece completa.</small>
      </section>
    );

  return (
    <main
      className={`coach-main coach-today ${prefs.low_motion ? "coach-low-motion" : ""}`}
      id="study"
      tabIndex={-1}
    >
      <div className="coach-today-heading">
        <div>
          <span className="coach-kicker">
            <span className="coach-live-dot" />
            {dateLabel(day)}
          </span>
          <h1 id="coach-today-title" tabIndex={-1}>
            Un poco más cerca<span>.</span>
          </h1>
          <p>Elige: temas nuevos o repasos. Tú decides el tamaño de la sesión.</p>
        </div>
        <button className="coach-edit-button" onClick={onEdit}>
          <Icon name="branch" size={16} />
          Ajustar mi plan
        </button>
      </div>
      <div className="today-load" role="group" aria-label="Carga de hoy">
        <span>¿Cómo está tu día?</span>
        {loads.map((option) => (
          <button
            key={option.value}
            aria-pressed={load === option.value}
            disabled={saving || paused}
            onClick={() => changeLoad(option.value)}
          >
            {option.label}
          </button>
        ))}
        {weeklyLoad !== 1 && (
          <small>Tu semana marca hoy como {weeklyLoad === 0 ? "descanso" : "día ligero"}.</small>
        )}
      </div>
      <section className="coach-daily-banner" aria-label="Tu meta de hoy">
        <div className="coach-daily-count">
          <span className="coach-orbit" aria-hidden="true">
            {complete ? "✓" : "↗"}
          </span>
          <div>
            <span className="coach-overline">META DE HOY</span>
            <strong>
              {stats.today_done}
              <span> / {stats.today_goal}</span>
              <small> tarjetas</small>
            </strong>
          </div>
        </div>
        <div className="coach-daily-meter">
          <div>
            <span>
              {complete
                ? "Tu esfuerzo de hoy ya cuenta."
                : stats.today_done
                  ? "Una tarjeta a la vez. Ya avanzaste."
                  : "Empieza con una. El resto viene después."}
            </span>
            <strong>
              {stats.today_goal ? Math.round((stats.today_done / stats.today_goal) * 100) : 0}%
            </strong>
          </div>
          <Progress label="Meta diaria" done={stats.today_done} goal={stats.today_goal} />
          <div className="coach-daily-detail">
            <span>
              {stats.remaining_seconds
                ? `≈ ${duration(stats.remaining_seconds)} pendientes`
                : complete
                  ? "Objetivo cumplido"
                  : "Sin tarjetas asignadas"}
            </span>
            <span>
              {stats.new_goal} nuevas · {Math.max(0, stats.today_goal - stats.new_goal)} repasos
              {load < 1 ? ` · ${load ? "día ligero" : "descanso"}` : ""}
            </span>
          </div>
        </div>
      </section>
      <div className="coach-mobile-course" aria-hidden="true">
        <span>
          Primera vuelta{" "}
          <strong>
            {stats.covered.toLocaleString("es-MX")} / {stats.total.toLocaleString("es-MX")}
          </strong>
        </span>
        <div>
          <i style={{ width: `${stats.coverage_percent}%` }} />
        </div>
      </div>
      <div className="coach-today-layout">
        <div className="coach-focus-column">
          <div className="today-tabs" role="tablist" aria-label="Tipo de sesión">
            <button role="tab" aria-selected={kind === "new"} onClick={() => switchKind("new")}>
              <strong>Temas nuevos</strong>
              <small>
                {stats.new_goal_done} de {stats.new_goal} recomendadas hoy
                {scopedCounts ? ` · ${scopedCounts.fresh} en tu selección` : ""}
              </small>
              {scopedCounts && (
                <small className="today-scope-left">
                  {scopedCounts.left
                    ? `Faltan ${scopedCounts.left.toLocaleString("es-MX")} de ${scopedCounts.total.toLocaleString("es-MX")} para terminar tu selección`
                    : "✓ Terminaste tu selección"}
                </small>
              )}
            </button>
            <button
              role="tab"
              aria-selected={kind === "review"}
              onClick={() => switchKind("review")}
            >
              <strong>Repasos</strong>
              <small>
                {stats.reviews_pending ? `${stats.reviews_pending} pendientes` : "Al día"}
                {scopedCounts
                  ? ` · ${scopedCounts.reviews} en tu selección`
                  : ` · ${stats.reviews_done_today} hechos`}
              </small>
            </button>
          </div>
          <div className="today-session-bar">
            <span>
              {kind === "new" ? "Sesión de temas nuevos" : "Sesión de repaso"} ·{" "}
              <strong>
                {session.answered}
                {size ? ` de ${size}` : ""}
              </strong>{" "}
              {size ? "tarjetas" : session.answered === 1 ? "tarjeta" : "tarjetas"}
            </span>
            <div>
              {!timer && (
                <button onClick={startStudyTimer}>
                  ⏱{" "}
                  {prefs.timer_minutes
                    ? `Temporizador ${prefs.timer_minutes} min`
                    : "Cronometrar sesión"}
                </button>
              )}
              {!onBreak && <button onClick={takeBreak}>☕ Descanso</button>}
              {session.answered > 0 && !summaryOpen && (
                <button onClick={() => setSummaryOpen(session)}>Terminar sesión</button>
              )}
              <button
                aria-expanded={settings}
                onClick={() => {
                  setSettings((open) => !open);
                }}
              >
                Personalizar
              </button>
            </div>
          </div>
          {scoped && (
            <div className="today-scope" role="status">
              <span>
                Solo: <strong>{scopeLabel(scope!, manifest)}</strong>
              </span>
              <button className="text-button" disabled={saving} onClick={clearScope}>
                Quitar filtro
              </button>
            </div>
          )}
          {settings && (
            <SessionSettings
              state={state}
              index={index}
              manifest={manifest}
              stats={stats}
              saving={saving}
              onSave={(change) => {
                savePreferences(change);
                setExtra(0);
                setSettings(false);
              }}
            />
          )}
          {notice && <p role="status">{notice}</p>}
          {cheer && (
            <div className="today-cheer" role="status">
              <span aria-hidden="true">✦</span>
              <div>
                <strong>{cheer.count} tarjetas hoy</strong>
                <p>{cheer.text}</p>
              </div>
              <button className="text-button" onClick={() => setCheer(null)}>
                Gracias
              </button>
            </div>
          )}
          {feedback && (
            <CardFeedback
              grade={feedback.grade}
              fresh={feedback.fresh}
              done={stats.today_done}
              goal={stats.today_goal}
            />
          )}
          {focus}
          <div className="coach-session-bottom">
            <button
              className="text-button"
              disabled={!state.undo || saving || !!feedback || paused}
              onClick={() => void undo()}
            >
              <span aria-hidden="true">↶ </span>Deshacer última respuesta
            </button>
            <span>
              {saving
                ? "Guardando en el VPS…"
                : connected
                  ? "Guardado en el VPS"
                  : "Copia local · VPS sin conexión"}
            </span>
          </div>
          {kind === "review" && stats.reviews_pending > 0 && (
            <div className="coach-backlog" role="status">
              <strong>{stats.reviews_pending} repasos pendientes hoy.</strong>
              <p>Si no los terminas, pasan a mañana. También puedes repartirlos en varios días.</p>
              <div className="today-spread">
                <label>
                  Repartir en
                  <select value={spread} onChange={(e) => setSpread(Number(e.target.value))}>
                    {[2, 3, 5, 7].map((n) => (
                      <option key={n} value={n}>
                        {n} días
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={saving || paused}
                  onClick={() =>
                    void commit((previous) =>
                      redistributeBacklog(previous, index, day, spread),
                    ).then((saved) => {
                      if (saved)
                        setNotice(
                          `Repartimos tus repasos en ${spread} días. Hoy quedan ${summary(saved, index, day).reviews_pending}.`,
                        );
                    })
                  }
                >
                  Repartir
                </button>
              </div>
            </div>
          )}
          {kind === "new" && stats.backlog_due > 0 && (
            <div className="coach-backlog" role="status">
              <strong>{stats.backlog_due} repasos pendientes fuera de tu meta.</strong>
              <p>Están en la pestaña Repasos. Puedes hacerlos o repartirlos en varios días.</p>
            </div>
          )}
        </div>
        <TodayJourney
          state={state}
          index={index}
          stats={stats}
          day={day}
          forecast={forecast}
          calculating={calculating}
          saving={saving}
          paused={paused}
          onBackup={onBackup}
          savePreferences={savePreferences}
        />
      </div>
      {(pause || timer) && (
        <TimerDock
          timer={(pause || timer)!}
          cards={session.answered}
          onPause={(value) =>
            pause ? setPause(pauseTimer(pause, value)) : setTimer(pauseTimer(timer!, value))
          }
          onStop={() => (pause ? void endBreak() : setTimer(null))}
          onBreak={pause ? undefined : takeBreak}
        />
      )}
    </main>
  );
}
