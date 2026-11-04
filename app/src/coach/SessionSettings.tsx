import { useState } from "react";
import type { StudyManifest } from "../library-types";
import { duration } from "./format";
import { scopeActive } from "./engine";
import { secondsPerCard } from "./insights";
import SessionScopePicker, { emptyScope } from "./SessionScope";
import type { CoachIndex, CoachState, Preferences, SessionScope, StudySummary } from "./types";

export default function SessionSettings({
  state,
  index,
  manifest,
  stats,
  saving,
  onSave,
}: {
  state: CoachState;
  index: CoachIndex;
  manifest: StudyManifest;
  stats: StudySummary;
  saving: boolean;
  onSave: (change: Partial<Preferences>) => void;
}) {
  const prefs = state.preferences,
    plan = state.plan!,
    size = prefs.session_size ?? 0;
  const [scopeDraft, setScopeDraft] = useState<SessionScope>(prefs.session_scope ?? emptyScope);
  const pace = secondsPerCard(state);
  const sessionPace = pace
    ? Math.max(1, Math.floor(((prefs.timer_minutes || 25) * 60) / pace))
    : null;
  return (
    <form
      className="today-settings"
      aria-label="Personalizar sesión"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const read = (name: string, min: number, max: number) =>
          Math.max(min, Math.min(max, Math.round(Number(data.get(name)) || 0)));
        onSave({
          session_size: read("size", 0, 500),
          timer_minutes: read("timer", 0, 600),
          break_minutes: Math.max(1, read("break", 1, 120)),
          motivation_every: read("cheer", 0, 500),
          session_scope: scopeActive(scopeDraft) ? scopeDraft : undefined,
        });
      }}
    >
      <label>
        Tarjetas por sesión
        <input name="size" type="number" min={0} max={500} defaultValue={size} />
        <small>0 = sin límite</small>
      </label>
      <label>
        Temporizador (min)
        <input
          name="timer"
          type="number"
          min={0}
          max={600}
          defaultValue={prefs.timer_minutes ?? 25}
        />
        <small>0 = solo cronómetro</small>
      </label>
      <label>
        Descanso (min)
        <input
          name="break"
          type="number"
          min={1}
          max={120}
          defaultValue={prefs.break_minutes ?? 5}
        />
      </label>
      <label>
        Frase motivadora cada
        <input
          name="cheer"
          type="number"
          min={0}
          max={500}
          defaultValue={prefs.motivation_every ?? 50}
        />
        <small>tarjetas · 0 = nunca</small>
      </label>
      <SessionScopePicker
        value={scopeDraft}
        onChange={setScopeDraft}
        manifest={manifest}
        index={index}
        sectionIds={plan.section_ids}
        planFamilies={plan.families}
      />
      <p className="today-pace">
        {pace ? (
          <>
            Tu ritmo: <strong>≈ {Math.round(pace)} s</strong> por tarjeta. En{" "}
            {prefs.timer_minutes || 25} min haces ≈ <strong>{sessionPace}</strong> tarjetas.
            {size ? ` ${size} tarjetas toman ≈ ${duration(size * pace)}.` : ""}
            {stats.today_goal > stats.today_done
              ? ` Lo que falta de tu meta toma ≈ ${duration((stats.today_goal - stats.today_done) * pace)}.`
              : ""}
          </>
        ) : (
          "Responde unas tarjetas más para calcular tu ritmo."
        )}
      </p>
      <button className="coach-primary" type="submit" disabled={saving}>
        Guardar
      </button>
    </form>
  );
}
