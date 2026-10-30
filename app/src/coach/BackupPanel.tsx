import { useEffect, useRef, useState } from "react";
import { Modal } from "../ui";
import { downloadBackup, parseBackup, readBeforeImport } from "./storage";
import type { CoachIndex, CoachState } from "./types";
import { caseMeta } from "../learning/model";
import { clinicalCases } from "../learning/cases";
import { loadSection } from "./resources";

export default function BackupPanel({ state, index, saving, onImport, onClose }: {
  state: CoachState; index: CoachIndex; saving: boolean;
  onImport: (state: CoachState) => Promise<boolean>; onClose: () => void;
}) {
  const [candidate, setCandidate] = useState<CoachState | null>(null);
  const [error, setError] = useState("");
  const [previous, setPrevious] = useState<CoachState | null>(null);
  const validation = useRef(0);
  useEffect(() => { readBeforeImport().then(setPrevious).catch(() => {}); }, []);
  async function choose(file?: File) {
    const request = ++validation.current;
    setCandidate(null); setError("");
    if (!file) return;
    try {
      const next = await parseBackup(file);
      const ids = new Set(index.cards.map(c => c.id));
      const sections = new Set(index.cards.map(c => c.section_id));
      const referenced = new Set([...Object.keys(next.progress), ...next.history.map(a => a.card_id), ...Object.values(next.days).flatMap(day => [...day.ids, ...day.extra_ids])]);
      const extra = [...referenced].filter(id => !ids.has(id));
      const clinicalSections = new Set<string>();
      for (const id of extra) {
        const meta = caseMeta(id);
        if (!meta || !sections.has(meta.section_id)) throw new Error("Esta copia usa otro temario. Tu progreso sigue intacto.");
        clinicalSections.add(meta.section_id);
      }
      const loaded = await Promise.all([...clinicalSections].map(id => loadSection(id, index.content_sha256)));
      for (const section of loaded) for (const item of clinicalCases(section)) ids.add(item.id);
      if ([...referenced].some(id => !ids.has(id)) || next.plan?.section_ids.some(id => !sections.has(id))) throw new Error("Esta copia usa otro temario. Tu progreso sigue intacto.");
      if (request === validation.current) setCandidate(next);
    } catch (failure) { if (request === validation.current) setError((failure as Error).message); }
  }
  return <Modal title="Tu progreso, contigo" onClose={onClose}>
    <p>El progreso se guarda en este dispositivo. Exporta una copia para conservarlo o llevarlo a otro navegador.</p>
    <button className="coach-primary" onClick={() => downloadBackup(state)}>Exportar mi progreso</button>
    <div className="coach-import"><label className="coach-field">Importar una copia<input type="file" accept=".json,application/json" onChange={e => void choose(e.target.files?.[0])} disabled={saving} /></label>
      {error && <p role="alert">{error}</p>}
      {candidate && <div className="coach-import-preview"><strong>Copia comprobada</strong><p>{candidate.history.length} respuestas · {Object.keys(candidate.progress).length} tarjetas practicadas.</p><p>Reemplazará el plan de este dispositivo. Guardaremos una copia del estado anterior.</p><button className="coach-primary" disabled={saving} onClick={() => void onImport(candidate).then(saved => { if (saved) onClose(); })}>Reemplazar con esta copia</button></div>}
    </div>
    {previous && <button className="text-button" onClick={() => downloadBackup(previous)}>Exportar la copia anterior a la última importación</button>}
  </Modal>;
}
