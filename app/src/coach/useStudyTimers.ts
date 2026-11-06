import { useEffect, useState } from "react";
import { logSession } from "./engine";
import {
  BREAK_KEY,
  TIMER_KEY,
  elapsedSeconds,
  notify,
  pauseTimer,
  playAlarm,
  readTimer,
  saveTimer,
  startTimer,
  useNow,
  type TimerState,
} from "./Timer";
import type { CoachCommit, Preferences } from "./types";

export function useStudyTimers({
  prefs,
  scope,
  day,
  answered,
  commit,
  onStart,
}: {
  prefs: Preferences;
  scope: string;
  day: string;
  answered: number;
  commit: CoachCommit;
  onStart: () => void;
}) {
  const timerKey = `${TIMER_KEY}:${scope}`;
  const breakKey = `${BREAK_KEY}:${scope}`;
  // Global legacy timers have no space ownership. Preserve their stored values,
  // but do not turn them into a new space's study or break log.
  const [timer, setTimerState] = useState<TimerState | null>(() => readTimer(timerKey));
  const [pause, setPauseState] = useState<TimerState | null>(() => readTimer(breakKey));

  const setTimer = (value: TimerState | null) => {
    saveTimer(timerKey, value);
    setTimerState(value);
  };
  const setPause = (value: TimerState | null) => {
    saveTimer(breakKey, value);
    setPauseState(value);
  };

  // Alert once when a countdown reaches zero.
  const now = useNow(!!(timer || pause));
  useEffect(() => {
    for (const [value, set, title] of [
      [timer, setTimer, "Terminó tu sesión de estudio"],
      [pause, setPause, "Terminó tu descanso"],
    ] as const) {
      if (
        value &&
        value.target !== null &&
        !value.alerted &&
        elapsedSeconds(value, now) >= value.target
      ) {
        set({ ...value, alerted: true });
        playAlarm();
        notify(
          title,
          value.mode === "study"
            ? `Respondiste ${answered} tarjetas en esta sesión.`
            : "Cuando quieras, seguimos con la siguiente tarjeta.",
        );
      }
    }
  });

  function startStudyTimer() {
    onStart();
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
    await commit((previous) =>
      logSession(previous, {
        id: crypto.randomUUID(),
        day,
        kind: "break",
        started_at: new Date(value.started).toISOString(),
        wall_seconds: Math.min(86_400, seconds),
        active_seconds: 0,
        cards: 0,
        target_seconds: value.target,
      }),
    );
  }

  return { timer, pause, setTimer, setPause, startStudyTimer, takeBreak, endBreak };
}
