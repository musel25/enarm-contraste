import { useMemo, useState } from "react";
import type { StudyManifest } from "../library-types";
import { readState, validPractice } from "../storage";
import { Icon } from "../ui";
import { addDays, dayKey, importLegacy, selectedCards } from "./engine";
import { useForecast } from "./hooks";
import { dateLabel, duration, timezone } from "./format";
import type { CoachIndex, CoachState, Forecast, StudyPlan } from "./types";

export default function PlanSetup({ state, manifest, index, saving, disabled = false, onSave, onCancel, onBackup }: {
  state: CoachState; manifest: StudyManifest; index: CoachIndex; saving: boolean; disabled?: boolean;
  onSave: (draft: CoachState, forecast: Forecast) => Promise<void>; onCancel?: () => void; onBackup?: () => void;
}) {
  const [id] = useState(() => state.plan?.id || crypto.randomUUID());
  const [mode, setMode] = useState<StudyPlan["mode"]>(state.plan?.mode || "deadline");
  const [zone] = useState(() => state.plan?.timezone || timezone());
  const today = dayKey(zone);
  const [deadline, setDeadline] = useState(state.plan?.deadline_day || addDays(today, 29));
  const [minutes, setMinutes] = useState(String(state.plan?.minutes_per_day || 60));
  const [sections, setSections] = useState(state.plan?.section_ids || manifest.sections.map(s => s.id));
  const [families, setFamilies] = useState<StudyPlan["families"]>(state.plan?.families || ["eje", "madre"]);
  const [legacy] = useState(() => readState<Record<string, "known" | "again">>("enarm-full-library-progress-v1", validPractice, {}));
  const [keepLegacy, setKeepLegacy] = useState(true);
  const draft = useMemo(() => {
    const plan: StudyPlan = { id, revision: (state.plan?.revision || 0) + 1, mode, start_day: state.plan?.start_day || today, deadline_day: mode === "deadline" ? deadline : null, minutes_per_day: Number(minutes), section_ids: sections, families, timezone: zone };
    let next: CoachState = { ...state, plan };
    if (!state.plan && keepLegacy) next = importLegacy(next, index, legacy, today);
    return next;
  }, [state, id, mode, today, deadline, minutes, sections, families, zone, keepLegacy, index, legacy]);
  const forecast = useForecast(draft, index, today);
  const count = selectedCards(index, draft.plan!).length;
  const valid = count > 0 && !forecast.pending && forecast.result?.feasible && !forecast.error;
  function toggleSection(id: string) { setSections(current => current.includes(id) ? current.filter(s => s !== id) : [...current, id]); }
  return <main className="coach-main coach-setup" id="study" tabIndex={-1}>
    <div className="coach-setup-intro"><span className="coach-kicker"><Icon name="spark" size={16} />Tu ritmo de estudio</span><h1>{state.plan ? "Ajusta tu plan." : "Tu plan. Un día a la vez."}</h1><p>Elige tu meta. Nosotros preparamos las tarjetas de hoy.<br />Tú solo necesitas empezar con la primera.</p></div>
    <div className="coach-setup-layout"><form className="coach-plan-form" onSubmit={event => { event.preventDefault(); if (valid && !disabled && !saving && forecast.result) void onSave(draft, forecast.result); }}>
      <div className="coach-plan-modes"><button type="button" aria-label="Fecha objetivo" aria-pressed={mode === "deadline"} onClick={() => setMode("deadline")}><Icon name="branch" size={18} />Fecha objetivo<small>Elige cuándo terminar</small></button><button type="button" aria-label="Tiempo diario" aria-pressed={mode === "time"} onClick={() => setMode("time")}><span aria-hidden="true">◷</span>Tiempo diario<small>Elige cuánto estudiar</small></button></div>
      {mode === "deadline" ? <label className="coach-field">Fecha objetivo<input aria-label="Fecha objetivo" type="date" min={today} value={deadline} required onChange={e => setDeadline(e.target.value)} /></label> : <label className="coach-field">Minutos por día<div className="coach-time-input"><input aria-label="Minutos por día" type="number" min="5" max="720" value={minutes} required onChange={e => setMinutes(e.target.value)} /><span>minutos</span></div></label>}
      <fieldset className="coach-family-picks"><legend>¿Qué quieres practicar?</legend>{([ ["eje", "Eje Clínico", "Comparar y distinguir"], ["madre", "Patrones Madre", "Reconocer, explicar y decidir"] ] as const).map(([value, title, detail]) => <label key={value}><input type="checkbox" checked={families.includes(value)} onChange={() => setFamilies(current => current.includes(value) ? current.filter(f => f !== value) : [...current, value])} /><span><strong>{title}</strong><small>{detail}</small></span></label>)}</fieldset>
      <details className="coach-topics"><summary>Elegir temas <span>{sections.length} de {manifest.sections.length} secciones</span></summary><button className="text-button" type="button" onClick={() => setSections(sections.length === manifest.sections.length ? [] : manifest.sections.map(s => s.id))}>{sections.length === manifest.sections.length ? "Quitar todas" : "Elegir todas"}</button><div>{manifest.sections.map(s => <label key={s.id}><input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSection(s.id)} />{s.title}</label>)}</div></details>
      {!state.plan && Object.keys(legacy).length > 0 && <label className="coach-legacy"><input type="checkbox" checked={keepLegacy} onChange={e => setKeepLegacy(e.target.checked)} />Conservar tarjetas marcadas antes. Se programarán repasos iniciales.</label>}
      <div className="coach-form-bottom"><button className="coach-primary" type="submit" disabled={!valid || saving || disabled}>{saving ? "Guardando…" : state.plan ? "Guardar mi plan" : "Empezar mi plan"}<Icon name="arrow" size={18} /></button>{onCancel && <button className="text-button" type="button" onClick={onCancel}>Volver a hoy</button>}</div>
      <p className="coach-device-note">Tu plan y tu progreso se guardan en el VPS. Usa tu código privado para continuar en otro dispositivo.</p>
      {!state.plan && onBackup && <button className="text-button coach-existing-backup" type="button" onClick={onBackup}>Ya tengo una copia de mi progreso</button>}
    </form><aside className="coach-plan-estimate" role="region" aria-label="Estimación del plan" aria-live="polite">
      <span className="coach-estimate-art" aria-hidden="true"><i /><i /><i /><b>✓</b></span>
      <p>Tu primera vuelta</p><strong>{forecast.pending ? "Calculando tu ritmo…" : !valid ? "Ajusta tu meta" : mode === "deadline" ? `${duration(forecast.result!.daily_minutes * 60)} al día` : dateLabel(forecast.result!.finish_day!)}</strong>
      <span>{count.toLocaleString("es-MX")} tarjetas seleccionadas</span>
      <div className="coach-estimate-detail">{forecast.error || (!forecast.pending && !valid ? "Elige al menos un tema y formato. Amplía la fecha o aumenta el tiempo si el plan no cabe." : mode === "deadline" ? `Para terminar tu primera vuelta${deadline ? ` el ${dateLabel(deadline)}` : ""}.` : `Con ${minutes} minutos al día, esta es la fecha estimada de tu primera vuelta.`)}</div>
      <ul><li>Tarjetas nuevas y repasos espaciados.</li><li>El ritmo se ajusta con tus tiempos reales.</li><li>Las estimaciones suponen respuestas «Bien».</li></ul>
      <small>Primera vuelta significa practicar cada tarjeta una vez. Los repasos continúan después.</small>
    </aside></div>
  </main>;
}
