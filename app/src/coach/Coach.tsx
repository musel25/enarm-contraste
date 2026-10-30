import { useEffect, useState } from "react";
import type { StudyManifest } from "../library-types";
import type { ReviewContext } from "../storage";
import "../library.css";
import "./coach.css";
import BackupPanel from "./BackupPanel";
import { createAssignment } from "./engine";
import { timezone } from "./format";
import { useCoachStore, useForecast, useStudyDay } from "./hooks";
import PlanSetup from "./PlanSetup";
import { loadResources } from "./resources";
import { downloadBackup } from "./storage";
import Today from "./Today";
import type { CoachIndex, CoachState, Forecast } from "./types";

function ReadyCoach({ manifest, index, suspended, onReview }: { manifest: StudyManifest; index: CoachIndex; suspended: boolean; onReview: (context: ReviewContext) => void }) {
  const store = useCoachStore();
  const { state, loading, saving, error, pending, latest, commit, reload } = store;
  const day = useStudyDay(state.plan?.timezone || timezone());
  const forecast = useForecast(state, index, day);
  const [editing, setEditing] = useState(false), [backup, setBackup] = useState(false);
  useEffect(() => {
    if (loading || !state.plan || state.days[day] || saving || error || forecast.pending || !forecast.result) return;
    void commit(previous => ({ ...previous, days: { ...previous.days, [day]: createAssignment(previous, index, day, forecast.result!.feasible ? forecast.result!.daily_minutes : previous.plan!.minutes_per_day) } }));
  }, [state, loading, saving, day, error, forecast.pending, forecast.result, index, commit]);
  async function savePlan(draft: CoachState, estimate: Forecast) {
    const saved = await commit(previous => {
      const next = { ...draft, revision: previous.revision, plan: { ...draft.plan!, minutes_per_day: estimate.daily_minutes } };
      return { ...next, days: { ...next.days, [day]: createAssignment(next, index, day, estimate.daily_minutes) } };
    });
    if (saved) {
      setEditing(false);
      requestAnimationFrame(() => { document.getElementById("coach-today-title")?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); });
    }
  }
  if (loading) return <main className="coach-main coach-loading" id="study" role="status">Abriendo tu progreso…</main>;
  return <>
    {error && <div className="coach-save-error" role="alert"><strong>{latest ? "Otra pestaña guardó progreso nuevo." : "Tu progreso no se pudo guardar."}</strong><p>{error} No avances hasta resolverlo.</p><div>{latest ? <button onClick={() => void reload()}>Cargar progreso más reciente</button> : <button onClick={() => void store.retry()}>Reintentar guardado</button>}<button onClick={() => downloadBackup(pending || state)}>Exportar copia de este intento</button></div></div>}
    {!state.plan || editing ? <PlanSetup state={state} manifest={manifest} index={index} saving={saving} disabled={!!error || backup} onSave={savePlan} onBackup={() => setBackup(true)} onCancel={state.plan ? () => setEditing(false) : undefined} /> : !state.days[day] ? <main id="study" className="coach-main coach-loading" role="status">Preparando la meta de hoy…</main> : <Today state={state} index={index} day={day} saving={saving} paused={suspended || backup || !!error} forecast={forecast.result} calculating={forecast.pending} commit={commit} onEdit={() => setEditing(true)} onBackup={() => setBackup(true)} onReview={onReview} />}
    {backup && <BackupPanel state={pending || state} index={index} saving={saving || !!error} onClose={() => setBackup(false)} onImport={async candidate => { const saved = await commit(() => candidate, true); return !!saved; }} />}
  </>;
}

export default function Coach({ suspended, onReview }: { suspended: boolean; onReview: (context: ReviewContext) => void }) {
  const [resources, setResources] = useState<{ manifest: StudyManifest; index: CoachIndex } | null>(null);
  const [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    loadResources(controller.signal).then(data => { if (!controller.signal.aborted) setResources(data); }).catch(failure => { if (!controller.signal.aborted) setError((failure as Error).message); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <main id="study" className="coach-main coach-load-error" role="alert"><h1>No se pudo preparar tu sesión.</h1><p>{error}</p><button className="coach-primary" onClick={() => setAttempt(x => x + 1)}>Reintentar carga</button></main>;
  if (!resources) return <main id="study" className="coach-main coach-loading" role="status">Preparando tu espacio de estudio…</main>;
  return <ReadyCoach {...resources} suspended={suspended} onReview={onReview} />;
}
