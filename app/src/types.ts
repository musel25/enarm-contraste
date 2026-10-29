export interface Source {
  id: string;
  label: string;
  detail: string;
  href?: string;
}

export interface ClinicalCase {
  id: string;
  diagnosis: string;
  category: string;
  vignette: string;
  discriminator: string;
  mechanism: string;
  decision: string;
  contrast: string;
  detail: { confirm: string; treatment: string; modifiers: string; limit: string };
  sources: string[];
}

export interface Scenario {
  id: string;
  title: string;
  from: number | null;
  vignette: string;
  changes: { field: string; before: string; after: string }[];
  unchanged: string[];
  diagnosis: string;
  decision: string;
  reason: string;
  severity: string;
  sources: string[];
}

export interface PracticeCard {
  id: string;
  type: string;
  vignette: string;
  question: string;
  answer: string;
  explanation: string;
  decision: string;
  limit: string;
  sources: string[];
}

export interface ClinicalAxis {
  id: string;
  title: string;
  area: string;
  question: string;
  shared: string;
  takeaway: string;
  coverage: string;
  glossary: string;
  cases: ClinicalCase[];
  variants: Scenario[];
  practice: PracticeCard[];
  sources: string[];
}
