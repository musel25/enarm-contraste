import { useEffect, useRef, useState, type RefObject } from "react";
import type { StudyCardData } from "../library-types";
import { addPersonalCard, personalTextLimit, setSuspended } from "./personal";
import type { CoachCommit, CoachState, PersonalCard } from "./types";
import "./personal.css";
import { layerOf } from "./profile";

export type PersonalToolsOptions = {
  state: CoachState;
  commit: CoachCommit;
  disabled: boolean;
  sectionTitle?: string;
  onEditingChange?: (open: boolean) => void;
};

export default function PersonalCardTools({
  card,
  root,
  options,
}: {
  card: StudyCardData;
  root: RefObject<HTMLElement | null>;
  options: PersonalToolsOptions;
}) {
  const { state, commit, disabled, sectionTitle, onEditingChange } = options;
  const [draft, setDraft] = useState<PersonalCard | null>(null);
  const [excerpt, setExcerpt] = useState("");
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  const front = useRef<HTMLTextAreaElement>(null);
  const open = !!draft;
  useEffect(() => {
    onEditingChange?.(open);
    return () => onEditingChange?.(false);
  }, [open, onEditingChange]);
  useEffect(() => {
    if (open) front.current?.focus();
  }, [open]);
  useEffect(() => {
    if (draft && state.created_cards?.[draft.id]) {
      setDraft(null);
      setFailed(false);
      setSubmitted(false);
      setMessage("Flashcard guardada en Creadas.");
    }
  }, [draft, state.created_cards]);
  useEffect(() => {
    const capture = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const parent =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      const side = parent?.closest(".library-front, .library-answer");
      if (
        !side ||
        !root.current?.contains(side) ||
        !range.getClientRects().length ||
        parent?.closest("button, input, textarea, select, summary") ||
        range.cloneContents().querySelector("button, input, textarea, select, summary")
      )
        return;
      const text = selection.toString().trim();
      if (text && text.length <= personalTextLimit) setExcerpt(text);
    };
    document.addEventListener("selectionchange", capture);
    return () => document.removeEventListener("selectionchange", capture);
  }, [root]);
  const suspended = state.suspended_cards?.includes(card.id);
  const changeSuspension = async () => {
    if (disabled || lock.current) return;
    lock.current = true;
    setSaving(true);
    const saved = await commit((previous) => setSuspended(previous, card.id, !suspended));
    if (saved) setMessage(suspended ? "Flashcard reintegrada." : "Flashcard suspendida.");
    setSaving(false);
    lock.current = false;
  };
  return (
    <div className="personal-tools">
      {!draft ? (
        <div className="personal-actions">
          {!suspended && (
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => {
                setDraft({
                  id: `created/${crypto.randomUUID()}`,
                  section_id: card.section_id,
                  source_card_id: card.id,
                  source_block_id: card.block_id,
                  front: "",
                  back: "",
                  created_at: new Date().toISOString(),
                  ...(state.workspace ? { layer: layerOf(state.workspace) } : {}),
                });
                setFailed(false);
                setSubmitted(false);
                setMessage("");
              }}
            >
              Añadir flashcard
            </button>
          )}
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void changeSuspension()}
          >
            {suspended ? "Reintegrar flashcard" : "Suspender flashcard"}
          </button>
          <small>
            {suspended
              ? "Conserva tu progreso al reintegrarla."
              : "Las suspendidas se pueden reintegrar desde la biblioteca."}
          </small>
        </div>
      ) : (
        <form
          className="personal-editor"
          aria-label="Crear flashcard"
          onSubmit={async (event) => {
            event.preventDefault();
            if (disabled || saving || lock.current || !draft.front.trim() || !draft.back.trim())
              return;
            lock.current = true;
            setSaving(true);
            setSubmitted(true);
            setFailed(false);
            const saved = await commit((previous) => addPersonalCard(previous, draft));
            if (!saved) setFailed(true);
            setSaving(false);
            lock.current = false;
          }}
        >
          <div className="personal-editor-heading">
            <h3>Nueva flashcard</h3>
            <p>{sectionTitle || `Sección ${card.section_id}`} · Creadas</p>
          </div>
          <p>
            Escribe o pega información. También puedes seleccionar texto del frente o reverso de la
            tarjeta de arriba.
          </p>
          {excerpt && (
            <div className="personal-excerpt">
              <blockquote>{excerpt}</blockquote>
              <div>
                {(["front", "back"] as const).map((field) => (
                  <button
                    key={field}
                    type="button"
                    disabled={
                      disabled ||
                      saving ||
                      submitted ||
                      draft[field].length + excerpt.length + (draft[field] ? 2 : 0) >
                        personalTextLimit
                    }
                    onClick={() =>
                      setDraft({
                        ...draft,
                        [field]: draft[field] ? `${draft[field]}\n\n${excerpt}` : excerpt,
                      })
                    }
                  >
                    Usar en el {field === "front" ? "frente" : "reverso"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="personal-fields">
            <label>
              Frente
              <textarea
                ref={front}
                aria-label="Frente"
                value={draft.front}
                required
                maxLength={personalTextLimit}
                rows={4}
                disabled={disabled || saving || submitted}
                onChange={(event) => setDraft({ ...draft, front: event.target.value })}
              />
            </label>
            <label>
              Reverso
              <textarea
                aria-label="Reverso"
                value={draft.back}
                required
                maxLength={personalTextLimit}
                rows={5}
                disabled={disabled || saving || submitted}
                onChange={(event) => setDraft({ ...draft, back: event.target.value })}
              />
            </label>
          </div>
          {failed && <p role="alert">No se guardó la flashcard. Tu borrador sigue aquí.</p>}
          {failed && <p>Usa Reintentar guardado para confirmar este intento antes de continuar.</p>}
          <div className="personal-actions">
            <button
              className="coach-primary"
              type="submit"
              disabled={
                disabled || saving || submitted || !draft.front.trim() || !draft.back.trim()
              }
            >
              {saving ? "Guardando…" : "Guardar flashcard"}
            </button>
            <button
              type="button"
              disabled={saving || submitted}
              onClick={() => {
                setDraft(null);
                setExcerpt("");
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
