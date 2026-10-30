import type { CardSource, StudySection } from '../library-types';
import type { PracticeSection } from './resources';
import { amenorrheaDiagnoses } from './amenorrhea';
export type Difficulty = 'easy' | 'medium' | 'contrast';
export const difficultyLabels: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Medio', contrast: 'Se puede confundir' };
export type DiagnosticCase = {
  id: string; section_id: string; block_id: string; topic_id: string; difficulty: Difficulty;
  diagnosis: string; vignette: string; discriminator: string; explanation: string;
  contrast: string; sources: CardSource[]; options: string[]; expanded: boolean; answer_kind?: 'diagnosis' | 'decision'; corrections?: string[];
};
function orderedOptions(names: string[], seed: string) {
  const unique = [...new Set(names)];
  if (unique.length === 1) unique.push('Otro diagnóstico');
  // Stable ordering avoids showing the correct diagnosis in the same position.
  const offset = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % unique.length;
  return [...unique.slice(offset), ...unique.slice(0, offset)];
}
export function clinicalCases(section: StudySection, bank?: PracticeSection | null): DiagnosticCase[] {
  if(bank) return bank.groups.flatMap(group => (['easy','medium','contrast'] as Difficulty[]).map(difficulty => {
    const variant = group.variants[difficulty];
    const id = `clinical/${group.block_id}/${group.id}/${difficulty}`;
    return { id, section_id:section.id, block_id:group.block_id, topic_id:group.id, difficulty,
      diagnosis:group.name, vignette:variant.vignette, discriminator:variant.discriminator,
      explanation:variant.explanation, contrast:`${variant.confusable_with}: ${variant.why_not}`,
      sources:group.sources, options:orderedOptions(bank.groups.filter(g=>g.block_id===group.block_id && g.answer_kind===group.answer_kind).map(g=>g.name),id),
      expanded:true, answer_kind:group.answer_kind, corrections:group.corrections };
  }));
  const cases: DiagnosticCase[] = [];
  const difficulties: Difficulty[] = ['easy', 'medium', 'contrast'];
  for (const card of section.cards.filter(card => card.family === 'eje')) {
    card.front.forEach((row, position) => {
      const answer = card.back[position];
      if (!answer?.title) return;
      const topic_id = answer.topic_id || `${card.block_id}-${position + 1}`;
      for (const difficulty of difficulties) {
        const id = `clinical/${card.block_id}/${topic_id}/${difficulty}`;
        cases.push({ id, section_id: section.id, block_id: card.block_id, topic_id, difficulty,
          diagnosis: answer.title, vignette: row.text, discriminator: answer.discriminator || row.highlight || '',
          explanation: answer.text, contrast: answer.limits || '', sources: answer.sources || card.sources,
          options: orderedOptions(card.back.map(a => a.title).filter(Boolean), id), expanded: false });
      }
    });
  }
  if (section.id === '14' && section.blocks.some(block => block.id === '14.01')) {
    for (const diagnosis of amenorrheaDiagnoses) difficulties.forEach((difficulty, i) => {
      const id = `clinical/14.01/${diagnosis.id}/${difficulty}`;
      cases.push({ id, section_id: '14', block_id: '14.01', topic_id: diagnosis.id, difficulty,
        diagnosis: diagnosis.name, vignette: diagnosis.cases[i], discriminator: diagnosis.discriminator,
        explanation: diagnosis.explanation, contrast: diagnosis.contrast, sources: diagnosis.sources,
        options: orderedOptions(amenorrheaDiagnoses.map(item => item.name), id), expanded: true });
    });
  }
  return cases;
}
