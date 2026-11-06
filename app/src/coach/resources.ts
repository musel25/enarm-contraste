import {
  isManifest,
  isSection,
  validIndex,
  type StudyManifest,
  type StudySection,
} from "../library-types";
import type { CoachIndex } from "./types";

const root = `${import.meta.env.BASE_URL}study/`;
const roots = new Map<string, string>();
const sections = new Map<string, Promise<StudySection>>();
export async function loadResources(
  signal?: AbortSignal,
  layer: 1 | 2 = 1,
): Promise<{ manifest: StudyManifest; index: CoachIndex }> {
  const base = layer === 2 ? `${root}layers/capa2/` : root;
  const manifest = await loadManifest(signal, layer);
  const planner = (
    manifest as StudyManifest & { planner?: { url: string; sha256: string; cards: number } }
  ).planner;
  if (!planner || planner.url !== "index.json" || typeof planner.sha256 !== "string")
    throw new Error("El índice de estudio no está disponible.");
  const indexResponse = await fetch(`${base}index.json?v=${planner.sha256}`, { signal });
  if (!indexResponse.ok) throw new Error("No se pudo cargar el índice.");
  const buffer = await indexResponse.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hash = [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
  if (hash !== planner.sha256) throw new Error("El índice cambió. Vuelve a cargarlo.");
  const index: unknown = JSON.parse(new TextDecoder().decode(buffer));
  if (
    !validIndex(index) ||
    index.content_sha256 !== manifest.content_sha256 ||
    index.cards.length !== planner.cards ||
    index.cards.some((card) => card.id.startsWith("capa2/") !== (layer === 2)) ||
    index.cards.some((card) => !manifest.sections.some((section) => section.id === card.section_id))
  )
    throw new Error("El índice no coincide con el temario.");
  return { manifest, index };
}

export async function loadManifest(signal?: AbortSignal, layer: 1 | 2 = 1): Promise<StudyManifest> {
  const base = layer === 2 ? `${root}layers/capa2/` : root;
  const response = await fetch(`${base}manifest.json`, { cache: "no-cache", signal });
  if (!response.ok) throw new Error("No se pudo cargar el temario.");
  const manifest: unknown = await response.json();
  if (!isManifest(manifest)) throw new Error("El temario no es válido.");
  if (roots.has(manifest.content_sha256) && roots.get(manifest.content_sha256) !== base)
    throw new Error("Las capas necesitan índices independientes.");
  roots.set(manifest.content_sha256, base);
  return manifest;
}

export function loadSection(id: string, hash: string): Promise<StudySection> {
  if (!/^\d{2}$/.test(id)) return Promise.reject(new Error("Sección no válida."));
  const key = `${hash}/${id}`;
  if (!sections.has(key)) {
    const base = roots.get(hash) || root;
    const request = fetch(`${base}sections/${id}.json?v=${hash}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar la tarjeta.");
        const data: unknown = await response.json();
        if (
          !isSection(data) ||
          data.id !== id ||
          data.cards.some((card) => card.id.startsWith("capa2/") !== (base !== root))
        )
          throw new Error("La tarjeta no es válida.");
        return data;
      })
      .catch((error) => {
        sections.delete(key);
        throw error;
      });
    sections.set(key, request);
  }
  return sections.get(key)!;
}
