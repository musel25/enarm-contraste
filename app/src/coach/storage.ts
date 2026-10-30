import { emptyState, validateState } from "./engine";
import type { CoachState } from "./types";

export const DATABASE = "enarm-coach-v1";
let connection: Promise<IDBDatabase> | null = null;
export class SaveConflict extends Error {
  constructor(public latest: CoachState) { super("El progreso cambió en otra pestaña."); }
}

function open(): Promise<IDBDatabase> {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };
    request.onerror = () => reject(new Error("No se pudo abrir el progreso de este dispositivo."));
    request.onblocked = () => reject(new Error("Cierra la otra pestaña e inténtalo de nuevo."));
  }).catch(error => { connection = null; throw error; });
  return connection;
}

export async function readCoach(): Promise<CoachState> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("state", "readonly").objectStore("state").get("current");
    request.onsuccess = () => {
      if (request.result === undefined) resolve(emptyState());
      else if (validateState(request.result)) resolve(request.result);
      else reject(new Error("El progreso guardado no es válido. Conserva tu copia antes de reemplazarlo."));
    };
    request.onerror = () => reject(new Error("No se pudo leer el progreso."));
  });
}

export async function writeCoach(expectedRevision: number, next: CoachState, preserve = false): Promise<CoachState> {
  if (!validateState(next)) throw new Error("El progreso no pasó la comprobación.");
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("state", "readwrite");
    const store = transaction.objectStore("state");
    let saved: CoachState | null = null;
    let failure: Error | null = null;
    const request = store.get("current");
    request.onsuccess = () => {
      const current = request.result === undefined ? emptyState() : request.result;
      if (!validateState(current)) { failure = new Error("El progreso guardado no es válido. No se reemplazó."); transaction.abort(); return; }
      if (current.revision !== expectedRevision) { failure = new SaveConflict(current); transaction.abort(); return; }
      if (preserve) store.put(current, "before-import");
      try {
        saved = { ...next, revision: expectedRevision + 1 };
        store.put(saved, "current");
      } catch { failure = new Error("No se guardó el intento. Reintenta o exporta tu copia."); transaction.abort(); }
    };
    transaction.oncomplete = () => saved ? resolve(saved) : reject(new Error("No se pudo guardar."));
    transaction.onabort = () => reject(failure || new Error("No se guardó el intento. Reintenta o exporta tu copia."));
    transaction.onerror = () => { failure ||= new Error("No se guardó el intento. Reintenta o exporta tu copia."); };
  });
}

export async function readBeforeImport(): Promise<CoachState | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("state", "readonly").objectStore("state").get("before-import");
    request.onsuccess = () => resolve(validateState(request.result) ? request.result : null);
    request.onerror = () => reject(new Error("No se pudo leer la copia anterior."));
  });
}

export function downloadBackup(state: CoachState) {
  const blob = new Blob([JSON.stringify({ format: "enarm-coach", exported_at: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `enarm-progreso-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function parseBackup(file: File): Promise<CoachState> {
  if (file.size > 20_000_000) throw new Error("La copia supera el tamaño permitido.");
  let data: unknown;
  try { data = JSON.parse(await file.text()); } catch { throw new Error("El archivo no contiene una copia JSON válida."); }
  const value = data as { format?: unknown; state?: unknown };
  if (!value || value.format !== "enarm-coach" || !validateState(value.state)) throw new Error("La copia no contiene un plan válido. Tu progreso sigue intacto.");
  return value.state;
}
