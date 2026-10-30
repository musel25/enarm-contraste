import { validateState } from "./engine";
import { SaveConflict } from "./storage";
import type { CoachState } from "./types";

export async function cloudRequest(code: string, path = "", mutation?: { expected_revision: number; state: CoachState; preserve: boolean }): Promise<CoachState | null> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/progress${path}`, { method: mutation ? "PUT" : "GET", headers: { Authorization: `Bearer ${code}`, ...(mutation ? { "Content-Type": "application/json" } : {}) }, cache: "no-store", signal: controller.signal, ...(mutation ? { body: JSON.stringify(mutation) } : {}) });
    if (response.status === 404 && !mutation) return null;
    const value = await response.json() as { state?: unknown; error?: string };
    if (response.status === 409 && validateState(value.state)) throw new SaveConflict(value.state);
    if (!response.ok) throw new Error(value.error || "El VPS no pudo guardar el progreso.");
    if (value.state === null && path === "/previous") return null;
    if (!validateState(value.state)) throw new Error("La respuesta del VPS no pasó la comprobación.");
    return value.state;
  } catch (failure) {
    if (failure instanceof SaveConflict) throw failure;
    if (failure instanceof TypeError || (failure as Error).name === "AbortError") throw new Error("No hay conexión con el VPS. Reintenta sin cerrar la página.");
    throw failure;
  } finally { clearTimeout(timer); }
}
