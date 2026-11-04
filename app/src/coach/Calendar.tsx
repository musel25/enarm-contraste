import { useMemo } from "react";
import { dateLabel, duration } from "./format";
import { answersByDay, dayStats, heatLevel } from "./insights";
import type { CoachIndex, CoachState } from "./types";

const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday first

/** A study calendar. Each 50 answers make the green brighter. */
export function Heatmap({
  state,
  days,
  selected,
  onSelect,
  label,
  layout = "weeks",
}: {
  state: CoachState;
  days: string[];
  selected: string;
  onSelect: (day: string) => void;
  label: string;
  layout?: "weeks" | "grid";
}) {
  const counts = useMemo(() => answersByDay(state), [state]);
  const blanks = Array.from({ length: weekday(days[0]) });
  return (
    <div className={`heatmap heatmap-${layout}`} role="group" aria-label={label}>
      {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
        <span key={`h${i}`} className="heatmap-head" aria-hidden="true">
          {d}
        </span>
      ))}
      {blanks.map((_, i) => (
        <span key={`b${i}`} className="heatmap-blank" aria-hidden="true" />
      ))}
      {days.map((day) => {
        const count = counts.get(day) || 0;
        return (
          <button
            key={day}
            type="button"
            className={`heat-${heatLevel(count)}`}
            aria-pressed={day === selected}
            aria-label={`${dateLabel(day)}: ${count} respuestas`}
            title={`${dateLabel(day)}: ${count} respuestas`}
            onClick={() => onSelect(day)}
          >
            {layout === "grid" ? Number(day.slice(8)) : ""}
          </button>
        );
      })}
    </div>
  );
}
export function HeatLegend() {
  return (
    <div className="heat-legend" aria-hidden="true">
      <span>0</span>
      {[1, 2, 3, 4, 5].map((level) => (
        <i key={level} className={`heat-${level}`} />
      ))}
      <span>200+</span>
    </div>
  );
}

export function DayDetail({
  state,
  index,
  day,
  today,
  sectionTitle,
}: {
  state: CoachState;
  index: CoachIndex;
  day: string;
  today: string;
  sectionTitle?: (id: string) => string;
}) {
  const stats = useMemo(() => dayStats(state, index, day), [state, index, day]);
  return (
    <section
      className="day-detail"
      aria-label={`Progreso del ${dateLabel(day)}`}
      aria-live="polite"
    >
      <h3>{day === today ? "Hoy" : dateLabel(day)}</h3>
      {stats.answers === 0 ? (
        <p>
          {day === today
            ? "Aún no hay respuestas hoy."
            : "No estudiaste este día. También descansar cuenta."}
        </p>
      ) : (
        <>
          <dl>
            <div>
              <dt>Respuestas</dt>
              <dd>{stats.answers}</dd>
            </div>
            <div>
              <dt>Tarjetas distintas</dt>
              <dd>{stats.cards}</dd>
            </div>
            <div>
              <dt>Nuevas</dt>
              <dd>{stats.fresh}</dd>
            </div>
            <div>
              <dt>Repasos</dt>
              <dd>{stats.reviews}</dd>
            </div>
            <div>
              <dt>Errores en repasos</dt>
              <dd>{stats.errors}</dd>
            </div>
            <div>
              <dt>Primeras lecturas</dt>
              <dd>{stats.first_reads}</dd>
            </div>
            <div>
              <dt>Tiempo activo</dt>
              <dd>{duration(stats.active_seconds)}</dd>
            </div>
            {stats.sessions > 0 && (
              <div>
                <dt>Sesiones</dt>
                <dd>
                  {stats.sessions} · {duration(stats.session_seconds)}
                </dd>
              </div>
            )}
            {stats.break_seconds > 0 && (
              <div>
                <dt>Descansos</dt>
                <dd>{duration(stats.break_seconds)}</dd>
              </div>
            )}
            {stats.goal > 0 && (
              <div>
                <dt>Meta del día</dt>
                <dd>
                  {stats.goal_done} de {stats.goal}
                </dd>
              </div>
            )}
          </dl>
          <p className="day-detail-blocks">
            <strong>
              {stats.blocks.length} {stats.blocks.length === 1 ? "bloque" : "bloques"}
            </strong>{" "}
            en{" "}
            <strong>
              {stats.sections} {stats.sections === 1 ? "sección" : "secciones"}
            </strong>
          </p>
          <ul>
            {stats.blocks.slice(0, 6).map((block) => (
              <li key={block.id}>
                <span>
                  {block.id}
                  {sectionTitle ? ` · ${sectionTitle(block.section_id)}` : ""}
                </span>
                <strong>{block.answers}</strong>
              </li>
            ))}
          </ul>
          {stats.blocks.length > 6 && <small>y {stats.blocks.length - 6} bloques más</small>}
        </>
      )}
    </section>
  );
}
