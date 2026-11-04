import { addDays, dayDiff, isError, selectedCards } from "./engine";
import type { CoachIndex, CoachState } from "./types";

/** Calendar shade: one step for each 50 answers, up to five steps. */
export function heatLevel(answers: number): number {
  return answers <= 0 ? 0 : Math.min(5, 1 + Math.floor(answers / 50));
}
export type DayStats = {
  day: string;
  answers: number;
  cards: number;
  fresh: number;
  reviews: number;
  errors: number;
  first_reads: number;
  active_seconds: number;
  sessions: number;
  session_seconds: number;
  break_seconds: number;
  goal: number;
  goal_done: number;
  blocks: { id: string; section_id: string; answers: number }[];
  sections: number;
};
export function dayStats(state: CoachState, index: CoachIndex, day: string): DayStats {
  const meta = new Map(index.cards.map((card) => [card.id, card]));
  const attempts = state.history.filter((a) => a.day === day);
  const firsts = new Map<string, boolean>();
  for (const attempt of attempts)
    if (!firsts.has(attempt.card_id)) firsts.set(attempt.card_id, attempt.was_new);
  const blocks = new Map<string, { id: string; section_id: string; answers: number }>();
  for (const attempt of attempts) {
    const parts = /^clinical\/((\d{2})\.\d{2})\//.exec(attempt.card_id);
    const card = meta.get(attempt.card_id);
    const id = card?.block_id ?? parts?.[1],
      section_id = card?.section_id ?? parts?.[2];
    if (!id || !section_id) continue;
    const row = blocks.get(id) ?? { id, section_id, answers: 0 };
    row.answers++;
    blocks.set(id, row);
  }
  const sessions = (state.sessions ?? []).filter((s) => s.day === day);
  const assignment = state.days[day];
  const done = new Set(attempts.map((a) => a.card_id));
  return {
    day,
    answers: attempts.length,
    cards: firsts.size,
    fresh: [...firsts.values()].filter(Boolean).length,
    reviews: [...firsts.values()].filter((x) => !x).length,
    errors: attempts.filter(isError).length,
    first_reads: attempts.filter((a) => a.was_new && a.rating === 1).length,
    active_seconds: attempts.reduce((sum, a) => sum + a.elapsed_seconds, 0),
    sessions: sessions.filter((s) => s.kind !== "break").length,
    session_seconds: sessions
      .filter((s) => s.kind !== "break")
      .reduce((sum, s) => sum + s.wall_seconds, 0),
    break_seconds: sessions
      .filter((s) => s.kind === "break")
      .reduce((sum, s) => sum + s.wall_seconds, 0),
    goal: assignment?.ids.length ?? 0,
    goal_done: assignment?.ids.filter((id) => done.has(id)).length ?? 0,
    blocks: [...blocks.values()].sort((a, b) => b.answers - a.answers || a.id.localeCompare(b.id)),
    sections: new Set([...blocks.values()].map((b) => b.section_id)).size,
  };
}
export function answersByDay(state: CoachState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const attempt of state.history) counts.set(attempt.day, (counts.get(attempt.day) || 0) + 1);
  return counts;
}
/** Days from the first answer (or the plan start) to today. */
export function studyRange(state: CoachState, today: string): string[] {
  const first =
    [state.plan?.start_day, ...state.history.map((a) => a.day)]
      .filter((d): d is string => !!d && d <= today)
      .sort()[0] ?? today;
  const length = Math.min(3_660, dayDiff(first, today) + 1);
  return Array.from({ length }, (_, n) => addDays(today, n - length + 1));
}
export type Coverage = {
  blocks: number;
  blocks_done: number;
  blocks_started: number;
  sections: number;
  sections_done: number;
  sections_started: number;
};
/** First-pass coverage of the plan by block and by section. */
export function coverage(state: CoachState, index: CoachIndex): Coverage {
  const cards = state.plan ? selectedCards(index, state.plan) : index.cards;
  const blocks = new Map<string, { section: string; total: number; done: number }>();
  for (const card of cards) {
    const row = blocks.get(card.block_id) ?? { section: card.section_id, total: 0, done: 0 };
    row.total++;
    if (state.progress[card.id]) row.done++;
    blocks.set(card.block_id, row);
  }
  const sections = new Map<string, { total: number; done: number; started: number }>();
  for (const row of blocks.values()) {
    const section = sections.get(row.section) ?? { total: 0, done: 0, started: 0 };
    section.total++;
    if (row.done === row.total) section.done++;
    if (row.done > 0) section.started++;
    sections.set(row.section, section);
  }
  const values = [...blocks.values()],
    groups = [...sections.values()];
  return {
    blocks: values.length,
    blocks_done: values.filter((b) => b.done === b.total).length,
    blocks_started: values.filter((b) => b.done > 0).length,
    sections: groups.length,
    sections_done: groups.filter((s) => s.done === s.total).length,
    sections_started: groups.filter((s) => s.started > 0).length,
  };
}
/** Median active seconds per answer over the last 200 timed answers. */
export function secondsPerCard(state: CoachState): number | null {
  const times = state.history
    .filter((a) => a.elapsed_seconds >= 3)
    .slice(-200)
    .map((a) => a.elapsed_seconds)
    .sort((a, b) => a - b);
  if (times.length < 5) return null;
  const middle = Math.floor(times.length / 2);
  return times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
}
export type SlowCard = { id: string; answers: number; average: number; estimate: number };
/** Questions with the longest average active time. */
export function slowCards(state: CoachState, index: CoachIndex, limit = 15): SlowCard[] {
  const meta = new Map(index.cards.map((card) => [card.id, card]));
  const rows = new Map<string, { total: number; answers: number; estimate: number }>();
  for (const attempt of state.history) {
    if (attempt.elapsed_seconds < 3) continue;
    const row = rows.get(attempt.card_id) ?? {
      total: 0,
      answers: 0,
      estimate: meta.get(attempt.card_id)?.review_seconds ?? attempt.estimated_seconds,
    };
    row.total += attempt.elapsed_seconds;
    row.answers++;
    rows.set(attempt.card_id, row);
  }
  return [...rows.entries()]
    .map(([id, row]) => ({
      id,
      answers: row.answers,
      average: row.total / row.answers,
      estimate: row.estimate,
    }))
    .sort((a, b) => b.average - a.average || a.id.localeCompare(b.id))
    .slice(0, limit);
}
export const motivation = [
  "Cada tarjeta es un paso real. Mira cuántas llevas ya.",
  "Tu constancia de hoy es tu ventaja de mañana.",
  "No necesitas hacerlo perfecto. Solo seguir. Y lo estás haciendo.",
  "Mira todo lo que ya sabes ahora y no sabías esta mañana.",
  "Tu cerebro está construyendo conexiones nuevas. Dale un respiro si lo necesitas.",
  "Un bloque a la vez. Así se aprende medicina.",
  "Lo difícil de hoy será lo fácil del examen.",
  "Estás más cerca que ayer. Eso es lo que cuenta.",
  "Respira, toma agua y sigue con calma. Vas muy bien.",
  "La futura doctora te lo va a agradecer.",
  "Cada error de hoy es una pregunta que no fallarás en el ENARM.",
  "Eres más constante de lo que crees. Los números lo muestran.",
];
export function motivationFor(count: number, every: number): string | null {
  if (count <= 0 || every <= 0 || count % every) return null;
  return motivation[(count / every - 1) % motivation.length];
}
