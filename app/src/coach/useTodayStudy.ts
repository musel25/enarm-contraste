import { useEffect, useMemo, useRef, useState } from "react";
import {
  dayKey,
  dayLoad,
  logSession,
  scopeActive,
  scopeRemaining,
  recordStudy,
  setDayLoad,
  setTag,
  studyQueue,
  summary,
  undoReview,
  type StudyKind,
} from "./engine";
import { playReward } from "./Feedback";
import { completionNotices } from "../learning/model";
import { motivationFor } from "./insights";
import { useStudyTimers } from "./useStudyTimers";
import type {
  CardTag,
  CoachCommit,
  CoachIndex,
  CoachState,
  Forecast,
  Grade,
  Preferences,
} from "./types";
type ActiveSession = {
  id: string;
  kind: StudyKind;
  day: string;
  started: number;
  answered: number;
  active: number;
};
const SESSION_KEY = "enarm-contraste-session";

function newSession(kind: StudyKind, day: string): ActiveSession {
  return { id: crypto.randomUUID(), kind, day, started: Date.now(), answered: 0, active: 0 };
}
function readSession(day: string): ActiveSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return value?.day === day && (value.kind === "new" || value.kind === "review") ? value : null;
  } catch {
    return null;
  }
}

export function useTodayStudy({
  state,
  index,
  day,
  saving,
  paused,
  forecast,
  commit,
}: {
  state: CoachState;
  index: CoachIndex;
  day: string;
  saving: boolean;
  paused: boolean;
  forecast: Forecast | null;
  commit: CoachCommit;
}) {
  const stats = useMemo(() => summary(state, index, day), [state, index, day]);
  const plan = state.plan!;
  const prefs = state.preferences;
  const size = prefs.session_size ?? 0;
  const [kind, setKind] = useState<StudyKind>(
    () =>
      readSession(day)?.kind ??
      (stats.new_goal > stats.new_goal_done || !stats.reviews_pending ? "new" : "review"),
  );
  const [extra, setExtra] = useState(0);
  const [session, setSession] = useState<ActiveSession>(
    () => readSession(day) ?? newSession(kind, day),
  );
  const [summaryOpen, setSummaryOpen] = useState<ActiveSession | null>(null);
  const { timer, pause, setTimer, setPause, startStudyTimer, takeBreak, endBreak } = useStudyTimers(
    {
      prefs,
      day,
      answered: session.answered,
      commit,
      onStart: () => {
        if (!session.answered) setSession((old) => ({ ...old, started: Date.now() }));
      },
    },
  );
  const [settings, setSettings] = useState(false);
  const [spread, setSpread] = useState(3);
  const [feedback, setFeedback] = useState<{ id: string; grade: Grade; fresh: boolean } | null>(
    null,
  );
  const [celebrate, setCelebrate] = useState(false);
  const [notice, setNotice] = useState("");
  const [cheer, setCheer] = useState<{ count: number; text: string } | null>(null);
  const action = useRef(false);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      /* The session still works in this tab. */
    }
  }, [session]);
  useEffect(
    () => () => {
      if (delay.current) clearTimeout(delay.current);
    },
    [],
  );
  useEffect(() => {
    setFeedback(null);
    setCelebrate(false);
    setNotice("");
    setExtra(0);
    if (delay.current) clearTimeout(delay.current);
    action.current = false;
    setSession((old) => (old.day === day ? old : newSession(old.kind, day)));
  }, [day]);

  const queue = useMemo(() => studyQueue(state, index, day, kind), [state, index, day, kind]);
  const scope = prefs.session_scope,
    scoped = scopeActive(scope);
  const scopedCounts = useMemo(
    () =>
      scoped
        ? {
            fresh: studyQueue(state, index, day, "new").recommended,
            reviews: studyQueue(state, index, day, "review").ids.length,
            ...scopeRemaining(state, index),
          }
        : null,
    [scoped, state, index, day],
  );
  const clearScope = () =>
    void commit((previous) => ({
      ...previous,
      preferences: { ...previous.preferences, session_scope: undefined },
    }));
  const ids = kind === "new" ? queue.ids.slice(0, queue.recommended + extra) : queue.ids;
  const full = size > 0 && session.answered >= size;
  const onBreak = !!pause;
  const currentId = feedback?.id || (full || summaryOpen ? undefined : ids[0]);
  const meta = index.cards.find((c) => c.id === currentId);
  const reduced = prefs.low_motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const complete = stats.today_goal > 0 && stats.today_done === stats.today_goal;
  const load = dayLoad(state, day),
    weeklyLoad = dayLoad({ plan }, day);
  const budgetMinutes =
    plan.mode === "deadline" && forecast?.feasible ? forecast.daily_minutes : plan.minutes_per_day;

  async function closeSession(current: ActiveSession, next: StudyKind = current.kind) {
    setSummaryOpen(null);
    setSession(newSession(next, day));
    if (!current.answered) return;
    const entry = {
      id: current.id,
      day: current.day,
      kind: current.kind,
      started_at: new Date(current.started).toISOString(),
      wall_seconds: Math.min(86_400, Math.round((Date.now() - current.started) / 1000)),
      active_seconds: Math.min(86_400, Math.round(current.active)),
      cards: current.answered,
      target_seconds: timer?.target ?? null,
    };
    await commit((previous) => logSession(previous, entry));
  }
  function switchKind(next: StudyKind) {
    if (next === kind || saving) return;
    // A tab click ends the short answer feedback at once.
    if (feedback) {
      if (delay.current) clearTimeout(delay.current);
      setFeedback(null);
      action.current = false;
    }
    setKind(next);
    setExtra(0);
    setNotice("");
    void closeSession(session, next);
  }
  async function rate(grade: Grade, seconds: number) {
    if (action.current || paused || saving || onBreak || !currentId) return;
    if (dayKey(plan.timezone) !== day) {
      setNotice("Cambió el día. Estamos preparando tu nueva sesión.");
      return;
    }
    action.current = true;
    const fresh = !state.progress[currentId];
    if (kind === "new" && ids.indexOf(currentId) >= queue.recommended)
      setExtra((left) => Math.max(0, left - 1));
    const saved = await commit((previous) =>
      recordStudy(previous, index, currentId, grade, seconds, day, crypto.randomUUID()),
    );
    if (!saved) {
      action.current = false;
      return;
    }
    const milestones = completionNotices(state, saved, {
      ...index,
      cards: index.cards.filter(
        (card) => plan.section_ids.includes(card.section_id) && plan.families.includes(card.family),
      ),
    });
    setNotice(
      milestones.length
        ? milestones
            .map(
              (item) =>
                `${item.kind === "block" ? "Bloque completo" : "Sección completa"}: ${item.id}. Primera vuelta de los formatos de tu plan terminada.`,
            )
            .join(" ")
        : "",
    );
    const daily = !state.celebrated_days.includes(day) && saved.celebrated_days.includes(day);
    const course =
      !state.celebrated_plans.includes(plan.id) && saved.celebrated_plans.includes(plan.id);
    const answered = {
      ...session,
      answered: session.answered + 1,
      active: session.active + seconds,
    };
    setSession(answered);
    const count = saved.history.filter((a) => a.day === day).length;
    const text = motivationFor(count, prefs.motivation_every ?? 50);
    if (text) setCheer({ count, text });
    setFeedback({ id: currentId, grade, fresh });
    if (saved.preferences.sound) playReward();
    delay.current = setTimeout(
      () => {
        setCelebrate(daily || course);
        setFeedback(null);
        action.current = false;
        if (size > 0 && answered.answered >= size) setSummaryOpen(answered);
        requestAnimationFrame(() => {
          document.getElementById("library-card-question")?.focus({ preventScroll: true });
          document
            .querySelector(".today-tabs")
            ?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
        });
      },
      reduced ? 90 : 650,
    );
  }
  async function undo() {
    if (action.current) return;
    action.current = true;
    const saved = await commit(undoReview);
    if (saved) {
      setCelebrate(false);
      setNotice("");
      setSession((old) => ({ ...old, answered: Math.max(0, old.answered - 1) }));
    }
    action.current = false;
  }
  function changeLoad(value: number) {
    void commit((previous) =>
      setDayLoad(
        previous,
        index,
        day,
        value === dayLoad({ plan: previous.plan }, day) ? null : value,
        budgetMinutes,
      ),
    );
  }
  function savePreferences(change: Partial<Preferences>) {
    void commit((previous) => ({
      ...previous,
      preferences: { ...previous.preferences, ...change },
    }));
  }
  const tagChange = (id: string) => (change: Partial<CardTag>) =>
    void commit((previous) => setTag(previous, id, change));

  return {
    stats,
    plan,
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
    ids,
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
  };
}
