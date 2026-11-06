import { useEffect, useRef, useState } from "react";
import { Modal } from "../ui";
import { downloadBackup, parseBackup } from "./storage";
import { readBeforeImport } from "./repository";
import type { StoredStudyState, StudyProfile } from "./types";
import { layerOf, migrateProfile, personalOriginsMatchIndex, studySpaces } from "./profile";
import { caseMeta } from "../learning/model";
import { clinicalCases } from "../learning/cases";
import { loadResources, loadSection } from "./resources";

export default function BackupPanel({
  state,
  saving,
  onImport,
  onClose,
}: {
  state: StudyProfile;
  saving: boolean;
  onImport: (state: StoredStudyState) => Promise<boolean>;
  onClose: () => void;
}) {
  const [candidate, setCandidate] = useState<StudyProfile | null>(null);
  const [error, setError] = useState("");
  const [previous, setPrevious] = useState<StoredStudyState | null>(null);
  const validation = useRef(0);
  useEffect(() => {
    readBeforeImport()
      .then(setPrevious)
      .catch(() => {});
  }, []);
  async function choose(file?: File) {
    const request = ++validation.current;
    setCandidate(null);
    setError("");
    if (!file) return;
    try {
      const next = migrateProfile(await parseBackup(file));
      for (const space of studySpaces) {
        const part = next.workspaces[space];
        if (
          !part.plan &&
          !Object.keys(part.progress).length &&
          !part.history.length &&
          !Object.keys(part.days).length &&
          !Object.values(next.created_cards).some((c) => c.layer === layerOf(space))
        )
          continue;
        const layerIndex = (await loadResources(undefined, layerOf(space))).index;
        if (!personalOriginsMatchIndex(next, layerOf(space), layerIndex))
          throw new Error(
            "El origen de una flashcard no coincide con el temario. Tu progreso sigue intacto.",
          );
        const published = layerIndex.cards.filter((c) => c.family !== "creadas");
        const ids = new Set(published.map((c) => c.id));
        if (space === "capa1") for (const id of next.legacy_layer1_ids ?? []) ids.add(id);
        const sections = new Set(published.map((c) => c.section_id));
        for (const card of Object.values(next.created_cards).filter(
          (c) => c.layer === layerOf(space),
        )) {
          if (!sections.has(card.section_id))
            throw new Error("Esta copia usa otro temario. Tu progreso sigue intacto.");
          ids.add(card.id);
        }
        const referenced = new Set([
          ...Object.keys(part.progress),
          ...(part.suspended_cards ?? []),
          ...part.history.map((a) => a.card_id),
          ...Object.values(part.days).flatMap((day) => [...day.ids, ...day.extra_ids]),
        ]);
        const extra = [...referenced].filter((id) => !ids.has(id));
        const clinicalSections = new Set<string>();
        for (const id of extra) {
          const meta = caseMeta(id);
          if (!meta || !sections.has(meta.section_id))
            throw new Error("Esta copia usa otro temario. Tu progreso sigue intacto.");
          clinicalSections.add(meta.section_id);
        }
        const loaded = await Promise.all(
          [...clinicalSections].map((id) => loadSection(id, layerIndex.content_sha256)),
        );
        for (const section of loaded) for (const item of clinicalCases(section)) ids.add(item.id);
        if (
          [...referenced].some((id) => !ids.has(id)) ||
          part.plan?.section_ids.some((id) => !sections.has(id))
        )
          throw new Error("Esta copia usa otro temario. Tu progreso sigue intacto.");
      }
      if (request === validation.current) setCandidate(next);
    } catch (failure) {
      if (request === validation.current) setError((failure as Error).message);
    }
  }
  return (
    <Modal title="Tu progreso, contigo" onClose={onClose}>
      <p>
        El progreso se guarda en el VPS. También puedes exportar una copia del plan y las
        respuestas. Tu código privado permite continuar en otro dispositivo.
      </p>
      <button className="coach-primary" onClick={() => downloadBackup(state)}>
        Exportar mi progreso
      </button>
      <div className="coach-import">
        <label className="coach-field">
          Importar una copia
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => void choose(e.target.files?.[0])}
            disabled={saving}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        {candidate && (
          <div className="coach-import-preview">
            <strong>Copia comprobada</strong>
            <p>
              {Object.values(candidate.workspaces).reduce((n, s) => n + s.history.length, 0)}{" "}
              respuestas ·{" "}
              {Object.values(candidate.workspaces).reduce(
                (n, s) => n + Object.keys(s.progress).length,
                0,
              )}{" "}
              tarjetas practicadas.
            </p>
            <p>
              Reemplazará el plan de este perfil en todos tus dispositivos. Guardaremos una copia
              del estado anterior en el VPS.
            </p>
            <button
              className="coach-primary"
              disabled={saving}
              onClick={() =>
                void onImport(candidate).then((saved) => {
                  if (saved) onClose();
                })
              }
            >
              Reemplazar con esta copia
            </button>
          </div>
        )}
      </div>
      {previous && (
        <button className="text-button" onClick={() => downloadBackup(previous)}>
          Exportar la copia anterior a la última importación
        </button>
      )}
    </Modal>
  );
}
