import { cloudRequest } from "./cloud";
import { validateState } from "./engine";
import { cacheServerState, getProgressCode, readBeforeImport as readLocalPrevious, readCoach as readLocal, SaveConflict } from "./storage";
import type { CoachState } from "./types";

let activeCode: string | null = null;
export class CloudUnavailable extends Error { constructor(message: string, public cached: CoachState | null) { super(message); } }
export async function readCoach(): Promise<CoachState> {
  let cached: CoachState | null = null;
  try {
    const code = await getProgressCode();
    let localFailure: unknown;
    try { cached = await readLocal(); } catch (failure) { localFailure = failure; }
    let remote = await cloudRequest(code);
    if (!remote) {
      if (!cached) throw localFailure || new Error("No se pudo leer el progreso anterior.");
      try { remote = await cloudRequest(code, "", { expected_revision: 0, state: cached, preserve: false }); }
      catch (failure) { if (failure instanceof SaveConflict) remote = failure.latest; else throw failure; }
    }
    if (!remote) throw new Error("El progreso no está disponible.");
    activeCode = code;
    try { await cacheServerState(code, remote); } catch { /* The confirmed server snapshot remains authoritative. */ }
    return remote;
  } catch (failure) { throw new CloudUnavailable((failure as Error).message, cached); }
}

export async function writeCoach(expected: number, next: CoachState, preserve = false): Promise<CoachState> {
  if (!validateState(next)) throw new Error("El progreso no pasó la comprobación.");
  const code = await getProgressCode();
  if (code !== activeCode) throw new SaveConflict(await readLocal());
  const saved = await cloudRequest(code, "", { expected_revision: expected, state: next, preserve });
  if (!saved) throw new Error("No se confirmó el guardado en el VPS.");
  try { await cacheServerState(code, saved); } catch { /* A cache failure must not reverse a successful server save. */ }
  return saved;
}

export async function readBeforeImport(): Promise<CoachState | null> {
  const code = await getProgressCode();
  return await cloudRequest(code, "/previous") || await readLocalPrevious(code);
}

export async function connectProgress(code: string): Promise<void> {
  const current = await getProgressCode();
  const remote = await cloudRequest(code);
  if (!remote) throw new Error("No encontramos progreso con este código.");
  await cacheServerState(code, remote, current);
}
