export interface CardSource { label: string; pages?: number[]; url?: string }
export interface StudyCardData {
  id: string;
  family: "eje" | "madre";
  level: number;
  section_id: string;
  block_id: string;
  topic_id?: string;
  prompt: string;
  context: string;
  front: { text: string; highlight?: string }[];
  back: { title: string; text: string; topic_id?: string; discriminator?: string; action?: string; reason?: string; limits?: string; sources?: CardSource[] }[];
  sources: CardSource[];
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
  counts: { sections: number; blocks: number; cards: number; topic_occurrences: number; eje: number; madre: number };
  sections: { id: string; title: string; blocks: number; cards: number; url: string }[];
  downloads: { family: string; label: string; url: string; cards: number }[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalText(value: Record<string, unknown>, keys: string[]) {
  return keys.every(key => value[key] === undefined || typeof value[key] === "string");
}
function sources(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(s => record(s) && typeof s.label === "string" &&
    (s.pages === undefined || (Array.isArray(s.pages) && s.pages.every(p => Number.isInteger(p) && p > 0))) &&
    (s.url === undefined || (typeof s.url === "string" && s.url.startsWith("https://"))));
}
function rows(value: unknown, answer = false): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(row => record(row) && typeof row.text === "string" &&
    optionalText(row, ["highlight", "discriminator", "action", "reason", "limits", "topic_id"]) &&
    (row.sources === undefined || sources(row.sources)) && (!answer || typeof row.title === "string"));
}
export function isManifest(value: unknown): value is StudyManifest {
  return record(value) && value.schema_version === 1 && typeof value.content_sha256 === "string" &&
    record(value.counts) && ["sections", "blocks", "cards", "eje", "madre", "topic_occurrences"].every(key => typeof (value.counts as Record<string, unknown>)[key] === "number") &&
    Array.isArray(value.sections) && value.sections.length > 0 && value.sections.every(s => record(s) && typeof s.id === "string" && typeof s.title === "string" && s.url === `sections/${s.id}.json`) &&
    Array.isArray(value.downloads) && value.downloads.every(d => record(d) && typeof d.label === "string" && ["enarm-eje.apkg", "enarm-madre.apkg"].includes(String(d.url)));
}
export function isSection(value: unknown): value is StudySection {
  return record(value) && typeof value.id === "string" && typeof value.title === "string" &&
    Array.isArray(value.blocks) && value.blocks.length > 0 && value.blocks.every(b => record(b) && typeof b.id === "string" && typeof b.title === "string") &&
    Array.isArray(value.cards) && value.cards.length > 0 && value.cards.every(c => record(c) && typeof c.id === "string" && (c.family === "eje" || c.family === "madre") && typeof c.level === "number" && typeof c.block_id === "string" && typeof c.prompt === "string" && typeof c.context === "string" && rows(c.front) && rows(c.back, true) && sources(c.sources));
}
