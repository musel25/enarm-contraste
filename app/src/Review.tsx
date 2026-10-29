import { useState } from "react";
import { Icon, Modal } from "./ui";
import type { ReviewContext, ReviewNote } from "./storage";

export default function Review({
  context,
  notes,
  persisted,
  onSave,
  onDelete,
  onClose,
}: {
  context: ReviewContext;
  notes: ReviewNote[];
  persisted: boolean;
  onSave: (note: ReviewNote) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("Contenido clínico");
  const [status, setStatus] = useState("");
  const save = () => {
    if (!text.trim()) return;
    onSave({
      id: crypto.randomUUID(),
      text: text.trim(),
      category,
      context,
      createdAt: new Date().toISOString(),
    });
    setText("");
    setStatus("Comentario guardado. Descárgalo para compartirlo.");
  };
  const download = () => {
    const payload = {
      version: 1,
      app: "ENARM Contraste",
      exportedAt: new Date().toISOString(),
      comments: notes,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "enarm-contraste-comentarios.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        notes
          .map(
            (note) => `${note.context.label}\n${note.category}\n${note.text}`,
          )
          .join("\n\n"),
      );
      setStatus("Comentarios copiados. Puedes pegarlos en un mensaje.");
    } catch {
      setStatus("No se pudo copiar. Usa Descargar comentarios.");
    }
  };
  return (
    <Modal title="Tu revisión" onClose={onClose} wide>
      <p className="review-intro">
        Señala qué cambiarías del contenido, del contraste o de la forma de
        estudiar.
      </p>
      <div className="review-context">
        <span>Estás comentando</span>
        <strong>{context.label}</strong>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className="field-label" htmlFor="review-type">
          Tipo de comentario
        </label>
        <select
          id="review-type"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option>Contenido clínico</option>
          <option>Forma de aprender</option>
          <option>Diseño y uso</option>
        </select>
        <label className="field-label" htmlFor="review-text">
          Comentario
        </label>
        <textarea
          id="review-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={10000}
          rows={4}
          placeholder="Por ejemplo: quiero comparar primero estos dos casos…"
        />
        <div className="review-save">
          <button
            className="primary-button"
            type="submit"
            disabled={!text.trim()}
          >
            Guardar comentario
          </button>
          <span aria-live="polite">{status}</span>
        </div>
      </form>
      <p
        className={persisted ? "local-notice" : "storage-warning"}
        role="status"
      >
        {persisted
          ? "Se guardan solo en este navegador. Descarga o copia los comentarios para enviarlos. No se envían de forma automática."
          : "El navegador no permite guardar los datos. Descarga los comentarios antes de cerrar esta página."}
      </p>
      <div className="saved-reviews">
        <div className="saved-heading">
          <h3>
            Comentarios guardados <span>{notes.length}</span>
          </h3>
        </div>
        {notes.length === 0 ? (
          <p className="empty-reviews">
            Todavía no hay comentarios. Elige un caso o escribe aquí una
            observación general.
          </p>
        ) : (
          <>
            <div className="review-export">
              <button className="secondary-button" onClick={download}>
                <Icon name="download" size={16} /> Descargar comentarios
              </button>
              <button className="text-button" onClick={copy}>
                Copiar texto
              </button>
            </div>
            <ul className="review-list">
              {[...notes].reverse().map((note) => (
                <li key={note.id}>
                  <div>
                    <strong>{note.context.label}</strong>
                    <button
                      className="text-button delete-note"
                      aria-label={`Eliminar comentario de ${note.context.label}`}
                      onClick={() => onDelete(note.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                  <span>{note.category}</span>
                  <p>{note.text}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
