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

export async function readBeforeImport(code: string): Promise<CoachState | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = db.transaction("state", "readonly").objectStore("state");
    const owner = store.get("legacy-recovery-code");
    owner.onsuccess = () => {
      if (owner.result !== code) { resolve(null); return; }
      const request = store.get("before-import");
      request.onsuccess = () => resolve(validateState(request.result) ? request.result : null);
      request.onerror = () => reject(new Error("No se pudo leer la copia anterior."));
    };
    owner.onerror = () => reject(new Error("No se pudo leer el perfil de la copia anterior."));
  });
}

export const validCode = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export async function getProgressCode(): Promise<string> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
    let code = "";
    const request = store.get("progress-code");
    request.onsuccess = () => {
      try {
        if (request.result !== undefined && !validCode(request.result)) throw new Error("Código guardado no válido.");
        code = request.result || btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        if (request.result === undefined) { store.put(code, "progress-code"); store.put(code, "legacy-recovery-code"); }
      } catch { tx.abort(); }
    };
    tx.oncomplete = () => resolve(code);
    tx.onabort = () => reject(new Error("No se pudo conservar el código de progreso en este navegador."));
    tx.onerror = () => {};
  });
}

export async function cacheServerState(code: string, state: CoachState, switchFrom?: string): Promise<void> {
  if (!validCode(code) || !validateState(state)) throw new Error("Progreso no válido.");
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
    const request = store.get("progress-code");
    let failure: Error | null = null;
    request.onsuccess = () => {
      if (request.result !== (switchFrom || code)) { failure = new Error("Cambió el perfil en otra pestaña. Recarga antes de continuar."); tx.abort(); return; }
      const current = store.get("current");
      current.onsuccess = () => {
        try {
          if (switchFrom) { store.put(switchFrom, "previous-code"); store.put(code, "progress-code"); }
          if (switchFrom || !validateState(current.result) || current.result.revision <= state.revision) store.put(state, "current");
        } catch { tx.abort(); }
      };
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(failure || new Error("No se pudo guardar la copia de este navegador."));
    tx.onerror = () => {};
  });
}

export async function previousProgressCode(): Promise<string | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("state").objectStore("state").get("previous-code");
    request.onsuccess = () => resolve(validCode(request.result) ? request.result : null);
    request.onerror = () => reject(new Error("No se pudo leer el perfil anterior."));
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

/** True when this browser already holds a progress profile. It never creates one. */
export async function hasProgressCode(): Promise<boolean> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("state").objectStore("state").get("progress-code");
    request.onsuccess = () => resolve(validCode(request.result));
    request.onerror = () => reject(new Error("No se pudo leer el perfil de este navegador."));
  });
}

/** Uses the progress of a signed-in account on this browser. The old code stays recoverable. */
export async function adoptCode(code: string, state: CoachState | null, username: string): Promise<void> {
  if (!validCode(code) || (state && !validateState(state))) throw new Error("Progreso no válido.");
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
    const request = store.get("progress-code");
    request.onsuccess = () => {
      if (validCode(request.result) && request.result !== code) store.put(request.result, "previous-code");
      store.put(code, "progress-code");
      store.put(username, "account-username");
      if (state) store.put(state, "current"); else store.delete("current");
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error("No se pudo guardar la sesión en este navegador."));
    tx.onerror = () => {};
  });
}

export async function setAccountName(username: string | null): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
    if (username) store.put(username, "account-username"); else store.delete("account-username");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error("No se pudo guardar el usuario en este navegador."));
  });
}

export async function getAccountName(): Promise<string | null> {
  const db = await open();
  return new Promise(resolve => {
    const request = db.transaction("state").objectStore("state").get("account-username");
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => resolve(null);
  });
}

/** Removes the account and its cached progress from this browser. The VPS keeps everything. */
export async function signOut(): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state");
    for (const key of ["progress-code", "account-username", "current", "previous-code", "before-import", "legacy-recovery-code"]) store.delete(key);
    tx.oncomplete = () => { localStorage.removeItem(GUEST_KEY); resolve(); };
    tx.onabort = () => reject(new Error("No se pudo cerrar la sesión en este navegador."));
  });
}
export const GUEST_KEY = "enarm-contraste-guest";
