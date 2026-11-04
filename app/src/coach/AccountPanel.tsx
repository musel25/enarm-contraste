import { useEffect, useState } from "react";
import { Modal } from "../ui";
import { accountName, changePassword } from "./account";
import { AccountForm } from "./AccountGate";
import { signOut } from "./storage";

export default function AccountPanel({
  onClose,
  onChanged,
  onCode,
}: {
  onClose: () => void;
  onChanged: (username: string | null) => void;
  onCode: () => void;
}) {
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(""),
    [next, setNext] = useState("");
  useEffect(() => {
    accountName()
      .then(setUsername)
      .catch((failure) => {
        setUsername(null);
        setError((failure as Error).message);
      });
  }, []);
  async function update() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await changePassword(current, next);
      setNotice("Contraseña actualizada.");
      setCurrent("");
      setNext("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setBusy(true);
    try {
      await signOut();
      location.reload();
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Mi cuenta" onClose={onClose}>
      {username === undefined ? (
        <p role="status">Consultando tu cuenta…</p>
      ) : username ? (
        <>
          <p>
            Entraste como <strong>{username}</strong>. Usa este usuario y tu contraseña para abrir
            el mismo progreso en otro dispositivo.
          </p>
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault();
              void update();
            }}
          >
            <h3>Cambiar contraseña</h3>
            <label className="coach-field">
              Contraseña actual
              <input
                aria-label="Contraseña actual"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="coach-field">
              Contraseña nueva
              <input
                aria-label="Contraseña nueva"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </label>
            <button className="coach-primary" type="submit" disabled={busy}>
              Guardar contraseña
            </button>
          </form>
          <button
            className="text-button account-signout"
            disabled={busy}
            onClick={() => void leave()}
          >
            Cerrar sesión en este dispositivo
          </button>
          <p className="account-hint">
            Cerrar sesión borra la copia local. Tu progreso sigue en el VPS.
          </p>
        </>
      ) : (
        <>
          <p>
            Crea un usuario y una contraseña para este progreso. Después podrás abrirlo desde tu
            laptop o tu celular. No se borra nada de lo que ya hiciste.
          </p>
          <AccountForm
            mode="register"
            onDone={(name) => {
              setUsername(name);
              onChanged(name);
            }}
          />
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      <button className="text-button account-code-link" onClick={onCode}>
        Usar un código privado
      </button>
    </Modal>
  );
}
