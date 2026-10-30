import { useEffect, useState } from "react";
import { Modal } from "../ui";
import { downloadBackup, parseBackup, readBeforeImport } from "./storage";
import type { CoachIndex, CoachState } from "./types";

export default function BackupPanel({ state, index, saving, onImport, onClose }: {
  state: CoachState; index: CoachIndex; saving: boolean;
  onImport: (state: CoachState) => Promise<boolean>; onClose: () => void;
}) {
  const [candidate, setCandidate] = useState<CoachState | null>(null);
  const [error, setError] = useState("");
  const [previous, setPrevious] = useState<CoachState | null>(null);
  useEffect(() => { readBeforeImport().then(setPrevious).catch(() => {}); }, []);
  async function choose(file?: File) {
    setCandidate(null); setError("");
    if (!file) return;
    try {
      const next = await parseBackup(file);
      const ids = new Set(index.cards.map(c => c.id));
      const sections = new Set(index.cards.map(c => c.section_id));
      if (Object.keys(next.progress).some(id => !ids.has(id)) || next.history.some(a => !ids.has(a.card_id)) || next.plan?.section_ids.some(id => !sections.has(id))) throw new Error("Esta copia usa otro temario. Tu progreso sigue intacto.");
      setCandidate(next);
    } catch (failure) { setError((failure as Error).message); }
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
