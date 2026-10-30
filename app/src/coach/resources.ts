import { isManifest, isSection, type StudyManifest, type StudySection } from "../library-types";
import type { CoachIndex } from "./types";

const root = `${import.meta.env.BASE_URL}study/`;
const sections = new Map<string, Promise<StudySection>>();
const object = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function validIndex(value: unknown): value is CoachIndex {
  if (!object(value) || value.schema_version !== 1 || typeof value.content_sha256 !== "string" || !Array.isArray(value.cards) || value.cards.length === 0) return false;
  const ids = new Set<string>();
  return value.cards.every((card, order) => {
    if (!object(card) || typeof card.id !== "string" || ids.has(card.id) || typeof card.section_id !== "string" || typeof card.block_id !== "string" || !["eje", "madre"].includes(String(card.family)) || !Number.isInteger(card.level) || card.order !== order || typeof card.new_seconds !== "number" || typeof card.review_seconds !== "number" || !Number.isFinite(card.new_seconds) || !Number.isFinite(card.review_seconds) || card.review_seconds < 1 || card.new_seconds <= card.review_seconds) return false;
    ids.add(card.id); return true;
  });
}

export async function loadResources(signal?: AbortSignal): Promise<{ manifest: StudyManifest; index: CoachIndex }> {
  const response = await fetch(`${root}manifest.json`, { cache: "no-cache", signal });
  if (!response.ok) throw new Error("No se pudo cargar el temario.");
  const manifest: unknown = await response.json();
  if (!isManifest(manifest)) throw new Error("El temario no es válido.");
  const planner = (manifest as StudyManifest & { planner?: { url: string; sha256: string; cards: number } }).planner;
  if (!planner || planner.url !== "index.json" || typeof planner.sha256 !== "string") throw new Error("El índice de estudio no está disponible.");
  const indexResponse = await fetch(`${root}index.json?v=${planner.sha256}`, { signal });
  if (!indexResponse.ok) throw new Error("No se pudo cargar el índice.");
  const buffer = await indexResponse.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hash = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
  if (hash !== planner.sha256) throw new Error("El índice cambió. Vuelve a cargarlo.");
  const index: unknown = JSON.parse(new TextDecoder().decode(buffer));
  if (!validIndex(index) || index.content_sha256 !== manifest.content_sha256 || index.cards.length !== planner.cards) throw new Error("El índice no coincide con el temario.");
  return { manifest, index };
}

export function loadSection(id: string, hash: string): Promise<StudySection> {
  if (!/^\d{2}$/.test(id)) return Promise.reject(new Error("Sección no válida."));
  const key = `${hash}/${id}`;
  if (!sections.has(key)) {
    const request = fetch(`${root}sections/${id}.json?v=${hash}`).then(async response => {
      if (!response.ok) throw new Error("No se pudo cargar la tarjeta.");
      const data: unknown = await response.json();
      if (!isSection(data) || data.id !== id) throw new Error("La tarjeta no es válida.");
      return data;
    }).catch(error => { sections.delete(key); throw error; });
    sections.set(key, request);
  }
  return sections.get(key)!;
}
