import { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui";
import { DayDetail, HeatLegend, Heatmap } from "./Calendar";
import { addDays } from "./engine";
import { dateLabel, duration } from "./format";
import { coverage } from "./insights";
import Progress from "./Progress";
import type { CoachIndex, CoachState, Forecast, Preferences, StudySummary } from "./types";

export default function TodayJourney({
  state,
  index,
  stats,
  day,
  forecast,
  calculating,
  saving,
  paused,
  onBackup,
  savePreferences,
}: {
  state: CoachState;
  index: CoachIndex;
  stats: StudySummary;
  day: string;
  forecast: Forecast | null;
  calculating: boolean;
  saving: boolean;
  paused: boolean;
  onBackup: () => void;
  savePreferences: (change: Partial<Preferences>) => void;
}) {
  const plan = state.plan!,
    prefs = state.preferences;
  const [selectedDay, setSelectedDay] = useState(day);
  useEffect(() => setSelectedDay(day), [day]);
  const span = useMemo(() => Array.from({ length: 30 }, (_, n) => addDays(day, n - 29)), [day]);
  const cover = useMemo(() => coverage(state, index), [state, index]);
  return (
    <aside className="coach-journey" aria-label="Tu progreso general">
      <section className="coach-course">
        <span className="coach-overline">TU META GRANDE</span>
        <div className="coach-course-heading">
          <h2>Primera vuelta</h2>
          <span aria-hidden="true">✦</span>
        </div>
        <strong className="coach-coverage-number">
          {Math.floor(stats.coverage_percent)}
          <small>%</small>
        </strong>
        <Progress
          label="Primera vuelta"
          done={stats.covered}
          goal={stats.total}
          className="course-track"
        />
        <p>
          <strong>{stats.covered.toLocaleString("es-MX")}</strong> de{" "}
          {stats.total.toLocaleString("es-MX")} tarjetas practicadas
        </p>
        <dl className="today-coverage">
          <div>
            <dt>Bloques completos</dt>
            <dd>
              {cover.blocks_done} de {cover.blocks}
            </dd>
          </div>
          <div>
            <dt>Bloques empezados</dt>
            <dd>{cover.blocks_started}</dd>
          </div>
          <div>
            <dt>Bloques por empezar</dt>
            <dd>{cover.blocks - cover.blocks_started}</dd>
          </div>
          <div>
            <dt>Secciones completas</dt>
            <dd>
              {cover.sections_done} de {cover.sections}
            </dd>
          </div>
          <div>
            <dt>Secciones empezadas</dt>
            <dd>{cover.sections_started}</dd>
          </div>
        </dl>
        <div className="coach-course-forecast">
          <Icon name="branch" size={17} />
          <div>
            <span>{plan.mode === "deadline" ? "Tu fecha objetivo" : "Llegada estimada"}</span>
            <strong>
              {plan.mode === "deadline"
                ? dateLabel(plan.deadline_day!)
                : calculating
                  ? "Actualizando…"
                  : forecast?.finish_day
                    ? dateLabel(forecast.finish_day)
                    : "Ajusta tu plan"}
            </strong>
            <small>
              {calculating
                ? "Calculando el ritmo…"
                : forecast?.feasible
                  ? `${duration(forecast.daily_minutes * 60)} al día · incluye repasos`
                  : "El plan necesita más tiempo."}
            </small>
          </div>
        </div>
        <small>Practicada una vez no significa dominada. Sigue repasando.</small>
      </section>
      <section className="coach-activity">
        <h2>Tu constancia</h2>
        <Heatmap
          state={state}
          days={span}
          selected={selectedDay}
          onSelect={setSelectedDay}
          label="Actividad de los últimos 30 días"
          layout="grid"
        />
        <HeatLegend />
        <p>
          Últimos 30 días. El verde brilla más con cada 50 respuestas. Toca un día para ver su
          progreso.
        </p>
        <DayDetail state={state} index={index} day={selectedDay} today={day} />
      </section>
      <section className="coach-preferences">
        <label>
          <input
            type="checkbox"
            checked={prefs.sound}
            disabled={saving || paused}
            onChange={(e) => savePreferences({ sound: e.target.checked })}
          />
          Sonido al completar
        </label>
        <label>
          <input
            type="checkbox"
            checked={prefs.low_motion}
            disabled={saving || paused}
            onChange={(e) => savePreferences({ low_motion: e.target.checked })}
          />
          Menos animaciones
        </label>
        <button className="text-button" onClick={onBackup}>
          Copia de mi progreso <Icon name="arrow" size={15} />
        </button>
      </section>
    </aside>
  );
}
