import { useCallback, useEffect, useRef, useState } from "react";
import { dayKey, emptyState } from "./engine";
import { SaveConflict } from "./storage";
import { CloudUnavailable, readCoach, writeCoach } from "./repository";
import type { CoachIndex, CoachState, Forecast } from "./types";

export function useCoachStore() {
  const [state, setState] = useState<CoachState>(emptyState);
  const ref = useRef(state);
  const lock = useRef(false);
  const preservePending = useRef(false);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<CoachState | null>(null);
  const [latest, setLatest] = useState<CoachState | null>(null);
  const reload = useCallback(async () => {
    try { const saved = await readCoach(); ref.current = saved; setState(saved); setError(""); setPending(null); setLatest(null); preservePending.current = false; }
    catch (failure) { if (failure instanceof CloudUnavailable && failure.cached) { ref.current = failure.cached; setState(failure.cached); } setError((failure as Error).message); }
    finally { setLoading(false); setGeneration(value => value + 1); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const commit = useCallback(async (change: (previous: CoachState) => CoachState, preserve = false): Promise<CoachState | null> => {
    if (lock.current) return null;
    lock.current = true; setSaving(true);
    let next: CoachState | null = null;
    try {
      next = change(ref.current);
      const saved = await writeCoach(ref.current.revision, next, preserve);
      ref.current = saved; setState(saved); setPending(null); setLatest(null); setError(""); return saved;
    } catch (failure) {
      setPending(next); setError((failure as Error).message);
      preservePending.current = preserve;
      if (failure instanceof SaveConflict) setLatest(failure.latest);
      return null;
    } finally { lock.current = false; setSaving(false); }
  }, []);
  return { state, loading, generation, saving, error, pending, latest, commit, reload, retry: () => pending ? commit(() => pending, preservePending.current) : reload() };
}

export function useStudyDay(timezone: string) {
  const [day, setDay] = useState(() => dayKey(timezone));
  useEffect(() => {
    const update = () => setDay(dayKey(timezone)); update();
    const id = setInterval(update, 30_000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { clearInterval(id); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [timezone]);
  return day;
}

export function useForecast(state: CoachState, index: CoachIndex, day: string) {
  const [calculation, setCalculation] = useState<{ state: CoachState; index: CoachIndex; day: string; result: Forecast | null; error: string } | null>(null);
  useEffect(() => {
    const worker = new Worker(new URL("./forecast.worker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => worker.postMessage({ state, index, day }), 120);
    worker.onmessage = event => {
      setCalculation({ state, index, day, result: event.data.result || null, error: event.data.result ? "" : event.data.error || "No se pudo calcular el plan." });
    };
    worker.onerror = () => setCalculation({ state, index, day, result: null, error: "No se pudo calcular el plan. Recarga la página." });
    return () => { clearTimeout(timer); worker.terminate(); };
  }, [state, index, day]);
  const current = calculation?.state === state && calculation.index === index && calculation.day === day;
  return { result: current ? calculation.result : null, pending: !current, error: current ? calculation.error : "" };
}
