import { useEffect, useState } from "react";

export type TimerState = {
  mode: "study" | "break";
  target: number | null;
  started: number;
  paused_at: number | null;
  paused_ms: number;
  alerted: boolean;
};
export const TIMER_KEY = "enarm-contraste-timer",
  BREAK_KEY = "enarm-contraste-break";

export function elapsedSeconds(timer: TimerState, now = Date.now()) {
  return Math.max(0, ((timer.paused_at ?? now) - timer.started - timer.paused_ms) / 1000);
}
export function readTimer(key: string): TimerState | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value &&
      (value.mode === "study" || value.mode === "break") &&
      Number.isFinite(value.started)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveTimer(key: string, timer: TimerState | null) {
  try {
    if (timer) localStorage.setItem(key, JSON.stringify(timer));
    else localStorage.removeItem(key);
  } catch {
    /* The timer still works in this tab. */
  }
}
export function startTimer(mode: TimerState["mode"], minutes: number | null): TimerState {
  if (minutes && "Notification" in window && Notification.permission === "default")
    void Notification.requestPermission().catch(() => {});
  return {
    mode,
    target: minutes ? minutes * 60 : null,
    started: Date.now(),
    paused_at: null,
    paused_ms: 0,
    alerted: false,
  };
}
export function pauseTimer(timer: TimerState, paused: boolean): TimerState {
  if (paused && timer.paused_at === null) return { ...timer, paused_at: Date.now() };
  if (!paused && timer.paused_at !== null)
    return { ...timer, paused_ms: timer.paused_ms + Date.now() - timer.paused_at, paused_at: null };
  return timer;
}
export function playAlarm() {
  try {
    const context = new AudioContext();
    [0, 0.35, 0.7].forEach((offset) => {
      const gain = context.createGain(),
        tone = context.createOscillator();
      gain.gain.setValueAtTime(0.06, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.3);
      tone.frequency.value = 880;
      tone.connect(gain);
      gain.connect(context.destination);
      tone.start(context.currentTime + offset);
      tone.stop(context.currentTime + offset + 0.3);
    });
    setTimeout(() => void context.close(), 1500);
  } catch {
    /* Sound is optional. */
  }
}
export function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted")
      new Notification(title, { body, tag: "enarm-timer" });
  } catch {
    /* The visible alert remains. */
  }
}
export const clock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = total % 60;
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
};
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** The timer in the corner of the screen. It stays visible while you study. */
export function TimerDock({
  timer,
  cards,
  onPause,
  onStop,
  onBreak,
}: {
  timer: TimerState;
  cards: number;
  onPause: (paused: boolean) => void;
  onStop: () => void;
  onBreak?: () => void;
}) {
  const now = useNow(true);
  const elapsed = elapsedSeconds(timer, now);
  const over = timer.target !== null && elapsed >= timer.target;
  const shown = timer.target === null ? elapsed : timer.target - elapsed;
  const label = timer.mode === "break" ? "Descanso" : "Sesión";
  return (
    <aside
      className={`timer-dock ${timer.mode} ${over ? "timer-over" : ""}`}
      aria-label={`Temporizador de ${label.toLowerCase()}`}
    >
      <div className="timer-dock-top">
        <span>
          {label}
          {timer.paused_at !== null ? " · en pausa" : ""}
        </span>
        {timer.mode === "study" && (
          <small>
            {cards} {cards === 1 ? "tarjeta" : "tarjetas"}
          </small>
        )}
      </div>
      <strong className="timer-dock-clock" role="timer" aria-live="off">
        {over ? "¡Tiempo!" : clock(shown)}
      </strong>
      {timer.target !== null && (
        <div className="timer-dock-bar">
          <i style={{ width: `${Math.min(100, (elapsed / timer.target) * 100)}%` }} />
        </div>
      )}
      {over && (
        <p role="alert">
          {timer.mode === "break"
            ? "Terminó tu descanso. ¿Seguimos?"
            : `Terminó tu tiempo: ${cards} ${cards === 1 ? "tarjeta" : "tarjetas"}.`}
        </p>
      )}
      <div className="timer-dock-actions">
        {!over && (
          <button type="button" onClick={() => onPause(timer.paused_at === null)}>
            {timer.paused_at === null ? "Pausar" : "Reanudar"}
          </button>
        )}
        {onBreak && timer.mode === "study" && (
          <button type="button" onClick={onBreak}>
            Descanso
          </button>
        )}
        <button type="button" onClick={onStop}>
          {over ? "Listo" : timer.mode === "break" ? "Terminar descanso" : "Detener"}
        </button>
      </div>
    </aside>
  );
}
