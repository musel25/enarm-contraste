import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../ui";
import { login, register } from "./account";
import { GUEST_KEY, hasProgressCode } from "./storage";
import "./account.css";

export function AccountForm({ mode, onDone }: { mode: "login" | "register"; onDone: (username: string) => void }) {
  const [username, setUsername] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit() {
    setError("");
    if (mode === "register" && password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try { onDone(mode === "login" ? await login(username, password) : await register(username, password)); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="account-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <label className="coach-field">Usuario<input aria-label="Usuario" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={40} /></label>
    <label className="coach-field">Contraseña<input aria-label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} /></label>
    {mode === "register" && <label className="coach-field">Repite la contraseña<input aria-label="Repite la contraseña" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} /></label>}
    {mode === "register" && <p className="account-hint">Usa de 3 a 40 letras sin espacios para el usuario. La contraseña necesita al menos 8 caracteres.</p>}
    {error && <p className="account-error" role="alert">{error}</p>}
    <button className="coach-primary" type="submit" disabled={busy}>{busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear mi cuenta"}<Icon name="arrow" size={17} /></button>
  </form>;
}

/** Asks for a username and password on a browser without saved progress. */
export default function AccountGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "gate" | "ready">("checking");
  const [mode, setMode] = useState<"login" | "register">("login");
  useEffect(() => {
    if (localStorage.getItem(GUEST_KEY) === "1") { setStatus("ready"); return; }
    hasProgressCode().then(found => setStatus(found ? "ready" : "gate")).catch(() => setStatus("ready"));
  }, []);
  if (status === "checking") return <main id="study" className="coach-main coach-loading" role="status">Abriendo tu espacio…</main>;
  if (status === "ready") return <>{children}</>;
  return <main id="study" className="coach-main account-gate" tabIndex={-1}>
    <div className="account-card">
      <span className="coach-kicker"><Icon name="spark" size={16} />Tu progreso, en todos tus dispositivos</span>
      <h1>{mode === "login" ? "Entra para seguir donde te quedaste." : "Crea tu cuenta."}</h1>
      <p>Tu usuario y tu contraseña abren el mismo plan en tu laptop y en tu celular.</p>
      <div className="account-tabs" role="tablist"><button role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Entrar</button><button role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Crear cuenta</button></div>
      <AccountForm key={mode} mode={mode} onDone={() => setStatus("ready")} />
      <button className="text-button account-guest" onClick={() => { localStorage.setItem(GUEST_KEY, "1"); setStatus("ready"); }}>Seguir sin cuenta en este dispositivo</button>
    </div>
  </main>;
}
