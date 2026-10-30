import { useEffect, useState } from "react";
import { Modal } from "../ui";
import { cloudRequest } from "./cloud";
import { connectProgress } from "./repository";
import { getProgressCode, previousProgressCode, validCode } from "./storage";
import type { CoachState } from "./types";

export default function CloudPanel({ onConnected, onClose }: { onConnected: () => Promise<void>; onClose: () => void }) {
  const [code, setCode] = useState(""), [input, setInput] = useState("");
  const [preview, setPreview] = useState<{ code: string; state: CoachState } | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  useEffect(() => { getProgressCode().then(setCode).catch(failure => setError(failure.message)); previousProgressCode().then(setPrevious).catch(() => {}); }, []);
  async function inspect(value = input) {
    setPreview(null); setError(""); setBusy(true);
    try {
      const cleaned = value.trim();
      if (!validCode(cleaned)) throw new Error("El código debe tener 43 caracteres. Cópialo completo.");
      const state = await cloudRequest(cleaned);
      if (!state) throw new Error("No encontramos progreso con este código.");
      setInput(cleaned); setPreview({ code: cleaned, state });
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function connect() {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try { await connectProgress(preview.code); await onConnected(); onClose(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title="Tu progreso en el VPS" onClose={onClose}>
    <p>Tu plan, tus respuestas y tus próximos repasos se guardan en el servidor. Usa este código para recuperar el mismo progreso en otro dispositivo.</p>
    <label className="coach-field">Tu código de progreso<input aria-label="Tu código de progreso" className="coach-private-code" readOnly value={code} autoComplete="off" spellCheck={false} /></label>
    <button className="coach-primary" disabled={!code} onClick={() => { void navigator.clipboard.writeText(code).then(() => setCopied(true)).catch(() => setError("Selecciona el código y cópialo manualmente.")); }}>{copied ? "Código copiado" : "Copiar mi código"}</button>
    <p className="coach-code-note">Guarda este código en un lugar privado. Quien lo tenga puede ver y cambiar tu progreso. El enlace normal del sitio no incluye el código.</p>
    <form className="coach-connect-form" onSubmit={e => { e.preventDefault(); void inspect(); }}>
      <h3>Continuar desde otro dispositivo</h3>
      <label className="coach-field">Código de otro dispositivo<input aria-label="Código de otro dispositivo" value={input} onChange={e => { setInput(e.target.value); setPreview(null); }} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
      <button className="coach-primary" disabled={busy || !input.trim()} type="submit">{busy ? "Conectando…" : "Ver progreso"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {preview && <div className="coach-import-preview"><strong>Progreso encontrado</strong><p>{preview.state.history.length} respuestas guardadas</p><p>{Object.keys(preview.state.progress).length} tarjetas practicadas. Al conectar verás este plan. Tu perfil actual queda guardado con su código anterior.</p><button className="coach-primary" disabled={busy} onClick={() => void connect()}>Conectar este progreso</button></div>}
    {previous && previous !== code && <button className="text-button coach-existing-backup" disabled={busy} onClick={() => void inspect(previous)}>Ver mi perfil anterior</button>}
  </Modal>;
}
