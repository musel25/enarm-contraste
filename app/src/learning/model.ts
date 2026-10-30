import type { CoachCard, CoachIndex, CoachState } from '../coach/types';

export type ProgressRow = {
  id: string; total: number; practiced: number; remaining: number;
  clinical_practiced: number; attempts: number; errors: number; difficult: number;
  started: string | null; next_due: string | null; due: number;
};
export function caseMeta(id: string, order = 0): CoachCard | null {
  const parts = /^clinical\/(\d{2}\.\d{2})\/([^/]+)\/(easy|medium|contrast)$/.exec(id);
  return parts ? { id, section_id: parts[1].slice(0, 2), block_id: parts[1], family: 'eje', level: 0,
    order, new_seconds: 90, review_seconds: 35 } : null;
}
function blank(id: string): ProgressRow {
  return { id, total: 0, practiced: 0, remaining: 0, clinical_practiced: 0, attempts: 0,
    errors: 0, difficult: 0, started: null, next_due: null, due: 0 };
}
export function progressRows(state: CoachState, index: CoachIndex, day: string) {
  const sections = new Map<string, ProgressRow>(), blocks = new Map<string, ProgressRow>();
  const cards = new Map(index.cards.map(card => [card.id, card]));
  const rowsFor = (card: CoachCard) => {
    if (!sections.has(card.section_id)) sections.set(card.section_id, blank(card.section_id));
    if (!blocks.has(card.block_id)) blocks.set(card.block_id, blank(card.block_id));
    return [sections.get(card.section_id)!, blocks.get(card.block_id)!];
  };
  for (const card of index.cards) for (const row of rowsFor(card)) row.total++;
  for (const [id, memory] of Object.entries(state.progress)) {
    const card = cards.get(id) || caseMeta(id);
    if (!card) continue;
    for (const row of rowsFor(card)) {
      if (id.startsWith('clinical/')) row.clinical_practiced++;
      else row.practiced++;
      if (memory.due_day <= day) row.due++;
      if (!row.next_due || memory.due_day < row.next_due) row.next_due = memory.due_day;
    }
  }
  for (const attempt of state.history) {
    const card = cards.get(attempt.card_id) || caseMeta(attempt.card_id);
    if (!card) continue;
    for (const row of rowsFor(card)) {
      row.attempts++;
      if (attempt.rating === 1) row.errors++;
      if (attempt.rating === 2) row.difficult++;
      if (!row.started || attempt.day < row.started) row.started = attempt.day;
    }
  }
  for (const row of [...sections.values(), ...blocks.values()]) row.remaining = row.total - row.practiced;
  return { sections: [...sections.values()], blocks: [...blocks.values()] };
}
export function completionNotices(before: CoachState, after: CoachState, index: CoachIndex) {
  const previous = progressRows(before, index, '0000-00-00');
  const next = progressRows(after, index, '0000-00-00');
  return (['blocks', 'sections'] as const).flatMap(key => next[key]
    .filter(row => row.total > 0 && row.remaining === 0 && previous[key].find(old => old.id === row.id)?.remaining !== 0)
    .map(row => ({ kind: key === 'blocks' ? 'block' as const : 'section' as const, id: row.id })));
}
export function topicErrors(state: CoachState, index: CoachIndex) {
  const cards = new Map(index.cards.map(card => [card.id, card]));
  const errors = new Map<string, { id: string; block_id: string; section_id: string; errors: number }>();
  for (const attempt of state.history) {
    if (attempt.rating !== 1) continue;
    const card = cards.get(attempt.card_id) || caseMeta(attempt.card_id);
    if (!card) continue;
    // An Eje answer covers several diagnoses. Do not invent topic-level results.
    const id = attempt.card_id.startsWith('clinical/') ? attempt.card_id.split('/')[2]
      : card.family === 'madre' && card.level >= 2 ? attempt.card_id.split('/')[2] : `block:${card.block_id}`;
    const row = errors.get(id) || { id, block_id: card.block_id, section_id: card.section_id, errors: 0 };
    row.errors++; errors.set(id, row);
  }
  return [...errors.values()].sort((a, b) => b.errors - a.errors || a.id.localeCompare(b.id));
}
