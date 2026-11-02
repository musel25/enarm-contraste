import { cloudRequest } from "./cloud";
import { emptyState } from "./engine";
import { SaveConflict, adoptCode, getProgressCode, setAccountName } from "./storage";

async function call(path: string, body?: unknown, code?: string): Promise<Record<string, unknown>> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/account${path}`, {
      method: body === undefined ? "GET" : "POST", cache: "no-store", signal: controller.signal,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(code ? { Authorization: `Bearer ${code}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "El VPS no respondió. Inténtalo de nuevo.");
    return value;
  } catch (failure) {
    if (failure instanceof TypeError || (failure as Error).name === "AbortError") throw new Error("No hay conexión con el VPS. Inténtalo de nuevo.");
    throw failure;
  } finally { clearTimeout(timer); }
}

/** Opens the progress of an account on this browser. */
export async function login(username: string, password: string): Promise<string> {
  const value = await call("/login", { username, password });
  const code = String(value.code), name = String(value.username);
  const state = await cloudRequest(code);
  await adoptCode(code, state, name);
  return name;
}

/** Links a username and password to the progress of this browser. */
export async function register(username: string, password: string): Promise<string> {
  const code = await getProgressCode();
  // The profile must exist on the VPS before another device can open it.
  if (!await cloudRequest(code)) {
    try { await cloudRequest(code, "", { expected_revision: 0, state: emptyState(), preserve: false }); }
    catch (failure) { if (!(failure instanceof SaveConflict)) throw failure; }
  }
  const value = await call("", { username, password }, code);
  await setAccountName(String(value.username));
  return String(value.username);
}

export async function changePassword(password: string, newPassword: string): Promise<void> {
  await call("/password", { password, new_password: newPassword }, await getProgressCode());
}

/** Reads the username linked to this browser's progress, or null. */
export async function accountName(): Promise<string | null> {
  const value = await call("", undefined, await getProgressCode());
  const name = typeof value.username === "string" ? value.username : null;
  await setAccountName(name);
  return name;
}
