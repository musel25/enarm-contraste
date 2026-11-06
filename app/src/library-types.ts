import { isClinicalObjective } from "./coach/objectives";
import type { ClinicalObjective, CoachIndex } from "./coach/types";

export interface CardSource {
  label: string;
  pages?: number[];
  url?: string;
}
export interface StudyCardData {
  id: string;
  family: "eje" | "madre" | "creadas";
  level: number;
  section_id: string;
  block_id: string;
  topic_id?: string;
  prompt: string;
  context: string;
  front: { text: string; highlight?: string }[];
  back: {
    title: string;
    text: string;
    topic_id?: string;
    discriminator?: string;
    action?: string;
    reason?: string;
    limits?: string;
    sources?: CardSource[];
    corrections?: string[];
  }[];
  sources: CardSource[];
  corrections?: string[];
  objective?: ClinicalObjective;
  related_sections?: string[];
}
export interface StudySection {
  id: string;
  title: string;
  blocks: { id: string; title: string; topics: number }[];
  cards: StudyCardData[];
}
export interface StudyManifest {
  schema_version: number;
  content_sha256: string;
  review_status: string;
  professional_review: string;
  coverage?: {
    sections: number;
    required_sections: number;
    scenarios: number;
    section_hashes: Record<string, string>;
  };
  counts: {
    sections: number;
    blocks: number;
    cards: number;
    topic_occurrences: number;
    eje: number;
    madre: number;
  };
  sections: { id: string; title: string; blocks: number; cards: number; url: string }[];
  groups?: {
    id: string;
    title: string;
    section_id: string;
    problem: string;
    related_sections?: string[];
  }[];
  downloads: { family: string; label: string; url: string; cards: number }[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalText(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => value[key] === undefined || typeof value[key] === "string");
}
function notes(value: unknown): boolean {
  return (
    value === undefined || (Array.isArray(value) && value.every((note) => typeof note === "string"))
  );
}
function sources(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (s) =>
        record(s) &&
        typeof s.label === "string" &&
        (s.pages === undefined ||
          (Array.isArray(s.pages) && s.pages.every((p) => Number.isInteger(p) && p > 0))) &&
        (s.url === undefined || (typeof s.url === "string" && s.url.startsWith("https://"))),
    )
  );
}
function rows(value: unknown, answer = false): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (row) =>
        record(row) &&
        typeof row.text === "string" &&
        optionalText(row, [
          "highlight",
          "discriminator",
          "action",
          "reason",
          "limits",
          "topic_id",
        ]) &&
        notes(row.corrections) &&
        (row.sources === undefined || sources(row.sources)) &&
        (!answer || typeof row.title === "string"),
    )
  );
}
export function isManifest(value: unknown): value is StudyManifest {
  return (
    record(value) &&
    value.schema_version === 1 &&
    (value.coverage === undefined ||
      (record(value.coverage) &&
        [value.coverage.sections, value.coverage.required_sections, value.coverage.scenarios].every(
          (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0,
        ) &&
        typeof value.coverage.sections === "number" &&
        typeof value.coverage.required_sections === "number" &&
        value.coverage.sections <= value.coverage.required_sections &&
        record(value.coverage.section_hashes) &&
        Object.entries(value.coverage.section_hashes).every(
          ([id, hash]) =>
            /^[0-9]{2}$/.test(id) && typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash),
        ))) &&
    typeof value.content_sha256 === "string" &&
    record(value.counts) &&
    ["sections", "blocks", "cards", "eje", "madre", "topic_occurrences"].every(
      (key) => typeof (value.counts as Record<string, unknown>)[key] === "number",
    ) &&
    Array.isArray(value.sections) &&
    value.sections.length > 0 &&
    value.sections.every(
      (s) =>
        record(s) &&
        typeof s.id === "string" &&
        typeof s.title === "string" &&
        s.url === `sections/${s.id}.json`,
    ) &&
    (value.groups === undefined ||
      (Array.isArray(value.groups) &&
        value.groups.every(
          (g) =>
            record(g) &&
            ["id", "title", "section_id", "problem"].every((key) => typeof g[key] === "string") &&
            (g.related_sections === undefined ||
              (Array.isArray(g.related_sections) &&
                g.related_sections.every((id) => typeof id === "string" && /^\d{2}$/.test(id)))),
        ))) &&
    Array.isArray(value.downloads) &&
    value.downloads.every(
      (d) =>
        record(d) &&
        typeof d.label === "string" &&
        typeof d.url === "string" &&
        ["enarm-eje.apkg", "enarm-madre.apkg"].includes(d.url),
    )
  );
}
export function isSection(value: unknown): value is StudySection {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.every(
      (b) => record(b) && typeof b.id === "string" && typeof b.title === "string",
    ) &&
    Array.isArray(value.cards) &&
    value.cards.length > 0 &&
    value.cards.every(
      (c) =>
        record(c) &&
        typeof c.id === "string" &&
        c.id.length <= 512 &&
        c.section_id === value.id &&
        (c.family === "eje" || c.family === "madre") &&
        typeof c.level === "number" &&
        typeof c.block_id === "string" &&
        (value.blocks as Record<string, unknown>[]).some((block) => block.id === c.block_id) &&
        typeof c.prompt === "string" &&
        typeof c.context === "string" &&
        rows(c.front) &&
        rows(c.back, true) &&
        sources(c.sources) &&
        notes(c.corrections) &&
        (c.objective === undefined || isClinicalObjective(c.objective)) &&
        (c.related_sections === undefined ||
          (Array.isArray(c.related_sections) &&
            c.related_sections.every((s) => typeof s === "string" && /^\d{2}$/.test(s)))),
    )
  );
}

export function validIndex(value: unknown): value is CoachIndex {
  if (
    !record(value) ||
    value.schema_version !== 1 ||
    typeof value.content_sha256 !== "string" ||
    !Array.isArray(value.cards) ||
    value.cards.length === 0
  )
    return false;
  const ids = new Set<string>();
  return value.cards.every((card, order) => {
    if (
      !record(card) ||
      typeof card.id !== "string" ||
      ids.has(card.id) ||
      typeof card.section_id !== "string" ||
      typeof card.block_id !== "string" ||
      (card.family !== "eje" && card.family !== "madre") ||
      (card.objective !== undefined && !isClinicalObjective(card.objective)) ||
      typeof card.level !== "number" ||
      !Number.isInteger(card.level) ||
      card.order !== order ||
      typeof card.new_seconds !== "number" ||
      typeof card.review_seconds !== "number" ||
      !Number.isFinite(card.new_seconds) ||
      !Number.isFinite(card.review_seconds) ||
      card.review_seconds < 1 ||
      card.new_seconds <= card.review_seconds
    )
      return false;
    ids.add(card.id);
    return true;
  });
}
