import { useCallback, useEffect, useRef, useState } from "react";
import { dayKey, emptyState } from "./engine";
import { SaveConflict } from "./storage";
import { CloudUnavailable, readCoach, writeCoach } from "./repository";
import { migrateProfile, spaceState, updateSpace } from "./profile";
import { useStudySpace } from "./StudySpace";
import type { CoachIndex, CoachState, Forecast, StoredStudyState, StudyProfile } from "./types";

export function useCoachStore() {
  const space = useStudySpace();
  const [state, setState] = useState<CoachState>(emptyState);
  const [profile, setProfile] = useState(() => migrateProfile(emptyState()));
  const ref = useRef(profile);
  const lock = useRef(false);
  const preservePending = useRef(false);
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<CoachState | null>(null);
  const [latest, setLatest] = useState<CoachState | null>(null);
  const [pendingProfile, setPendingProfile] = useState<StudyProfile | null>(null);
  const accept = useCallback(
    (saved: StudyProfile) => {
      ref.current = saved;
      setProfile(saved);
      setState(spaceState(saved, space));
    },
    [space],
  );
  const reload = useCallback(async () => {
    try {
      const saved = await readCoach();
      accept(saved);
      setError("");
      setPending(null);
      setLatest(null);
      setPendingProfile(null);
      preservePending.current = false;
    } catch (failure) {
      if (failure instanceof CloudUnavailable && failure.cached) {
        accept(migrateProfile(failure.cached));
      }
      setError((failure as Error).message);
    } finally {
      setLoading(false);
      setGeneration((value) => value + 1);
    }
  }, [accept]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const commit = useCallback(
    async (
      change: (previous: CoachState) => CoachState,
      preserve = false,
    ): Promise<CoachState | null> => {
      if (lock.current) return null;
      lock.current = true;
      setSaving(true);
      let next: StudyProfile | null = null;
      try {
        next = updateSpace(ref.current, space, change(spaceState(ref.current, space)));
        const saved = await writeCoach(ref.current.revision, next, preserve);
        accept(saved);
        setPending(null);
        setLatest(null);
        setPendingProfile(null);
        setError("");
        return spaceState(saved, space);
      } catch (failure) {
        setPending(next ? spaceState(next, space) : null);
        setPendingProfile(next);
        setError((failure as Error).message);
        preservePending.current = preserve;
        if (failure instanceof SaveConflict)
          setLatest(spaceState(migrateProfile(failure.latest), space));
        return null;
      } finally {
        lock.current = false;
        setSaving(false);
      }
    },
    [space, accept],
  );
  const importProfile = useCallback(
    async (candidate: StoredStudyState) => {
      if (lock.current) return null;
      lock.current = true;
      setSaving(true);
      const next = { ...migrateProfile(candidate), revision: ref.current.revision };
      try {
        const saved = await writeCoach(ref.current.revision, next, true);
        accept(saved);
        setPending(null);
        setPendingProfile(null);
        setLatest(null);
        setError("");
        return saved;
      } catch (failure) {
        setPending(spaceState(next, space));
        setPendingProfile(next);
        preservePending.current = true;
        setError((failure as Error).message);
        if (failure instanceof SaveConflict)
          setLatest(spaceState(migrateProfile(failure.latest), space));
        return null;
      } finally {
        lock.current = false;
        setSaving(false);
      }
    },
    [accept, space],
  );
  return {
    state,
    profile,
    pendingProfile,
    importProfile,
    loading,
    generation,
    saving,
    error,
    pending,
    latest,
    commit,
    reload,
    retry: () =>
      pendingProfile
        ? preservePending.current
          ? importProfile(pendingProfile)
          : commit(() => spaceState(pendingProfile, space), false)
        : reload(),
  };
}

export function useStudyDay(timezone: string) {
  const [day, setDay] = useState(() => dayKey(timezone));
  useEffect(() => {
    const update = () => setDay(dayKey(timezone));
    update();
    const id = setInterval(update, 30_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [timezone]);
  return day;
}

export function useForecast(state: CoachState, index: CoachIndex, day: string) {
  const [calculation, setCalculation] = useState<{
    state: CoachState;
    index: CoachIndex;
    day: string;
    result: Forecast | null;
    error: string;
  } | null>(null);
  useEffect(() => {
    const worker = new Worker(new URL("./forecast.worker.ts", import.meta.url), { type: "module" });
    const timer = setTimeout(() => worker.postMessage({ state, index, day }), 120);
    worker.onmessage = (event) => {
      setCalculation({
        state,
        index,
        day,
        result: event.data.result || null,
        error: event.data.result ? "" : event.data.error || "No se pudo calcular el plan.",
      });
    };
    worker.onerror = () =>
      setCalculation({
        state,
        index,
        day,
        result: null,
        error: "No se pudo calcular el plan. Recarga la página.",
      });
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [state, index, day]);
  const current =
    calculation?.state === state && calculation.index === index && calculation.day === day;
  return {
    result: current ? calculation.result : null,
    pending: !current,
    error: current ? calculation.error : "",
  };
}
