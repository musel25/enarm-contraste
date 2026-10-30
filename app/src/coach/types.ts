import type { Card } from 'ts-fsrs';

export type Grade = 1 | 2 | 3 | 4;
export type SerializedFSRS = Omit<Card, 'due' | 'last_review'> & {
  due: string;
  last_review?: string;
};
export type CoachCard = {
  id: string;
  section_id: string;
  block_id: string;
  family: 'eje' | 'madre';
  level: number;
  order: number;
  new_seconds: number;
  review_seconds: number;
};
export type CoachIndex = { schema_version: 1; content_sha256: string; cards: CoachCard[] };
export type StudyPlan = {
  id: string;
  revision: number;
  mode: 'deadline' | 'time';
  start_day: string;
  deadline_day: string | null;
  minutes_per_day: number;
  section_ids: string[];
  families: ('eje' | 'madre')[];
  timezone: string;
};
export type Memory = {
  card: SerializedFSRS | null;
  due_day: string;
  introduced_day: string;
  last_rating: Grade | null;
  imported: boolean;
};
export type Attempt = {
  id: string;
  card_id: string;
  day: string;
  rating: Grade;
  elapsed_seconds: number;
  was_new: boolean;
  estimated_seconds: number;
};
export type Assignment = {
  day: string;
  plan_key: string;
  ids: string[];
  new_ids: string[];
  costs: Record<string, number>;
  budget_seconds: number;
  extra_ids: string[];
};
export type CoachState = {
  version: 1;
  revision: number;
  plan: StudyPlan | null;
  progress: Record<string, Memory>;
  history: Attempt[];
  days: Record<string, Assignment>;
  celebrated_days: string[];
  celebrated_plans: string[];
  preferences: { sound: boolean; low_motion: boolean };
  undo: { attempt_id: string; previous: Memory | null } | null;
};
export type Forecast = {
  feasible: boolean;
  finish_day: string | null;
  daily_minutes: number;
  total_seconds: number;
  remaining_new: number;
  reason?: string;
};
export type StudySummary = {
  today_done: number;
  today_goal: number;
  pending_ids: string[];
  extra_done: number;
  new_done: number;
  reviews_done: number;
  covered: number;
  total: number;
  coverage_percent: number;
  today_seconds: number;
  remaining_seconds: number;
  backlog_due: number;
  correct_today: number;
  attempts_today: number;
  due_tomorrow: number;
};
