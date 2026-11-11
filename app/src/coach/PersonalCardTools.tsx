import { useEffect, useRef, useState, type RefObject } from "react";
import type { StudyCardData } from "../library-types";
import { addPersonalCard, editPersonalCard, personalTextLimit, setSuspended } from "./personal";
import type { CoachCommit, CoachState, PersonalCard } from "./types";
import "./personal.css";
import { layerOf } from "./profile";
import { loadManifest } from "./resources";

type SectionOption = { id: string; title: string };

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
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<SectionOption[] | null>(null);
  const [sectionsFailed, setSectionsFailed] = useState(false);
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
  const layer = state.workspace ? layerOf(state.workspace) : 1;
  const creating = open && !editing;
  useEffect(() => {
    if (!creating || sections) return;
    const abort = new AbortController();
    setSectionsFailed(false);
    loadManifest(abort.signal, layer)
      .then((manifest) => {
        if (!abort.signal.aborted)
          setSections(manifest.sections.map(({ id, title }) => ({ id, title })));
      })
      .catch(() => {
        if (!abort.signal.aborted) setSectionsFailed(true);
      });
    return () => abort.abort();
  }, [creating, sections, layer]);
  const saved = draft ? state.created_cards?.[draft.id] : undefined;
  const sectionName = (id: string) =>
    sections?.find((section) => section.id === id)?.title ||
    (id === card.section_id && sectionTitle) ||
    `Sección ${id}`;
  useEffect(() => {
    if (!draft || !saved) return;
    if (editing) {
      if (!submitted || saved.front !== draft.front || saved.back !== draft.back) return;
      setMessage("Cambios guardados.");
    } else
      setMessage(
        draft.section_id === card.section_id
          ? "Flashcard guardada en Creadas."
          : `Flashcard guardada en Creadas · ${sectionName(draft.section_id)}.`,
      );
    setDraft(null);
    setEditing(false);
    setFailed(false);
    setSubmitted(false);
    setExcerpt("");
  }, [draft, saved, editing, submitted]);
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
  const own =
    state.created_cards && Object.hasOwn(state.created_cards, card.id)
      ? state.created_cards[card.id]
      : undefined;
  const unchanged =
    editing && !!saved && saved.front === draft?.front && saved.back === draft?.back;
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
                setEditing(false);
                setFailed(false);
                setSubmitted(false);
                setMessage("");
              }}
            >
              Añadir flashcard
            </button>
          )}
          {own && (
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => {
                setDraft({ ...own });
                setEditing(true);
                setFailed(false);
                setSubmitted(false);
                setMessage("");
              }}
            >
              Editar flashcard
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
          aria-label={editing ? "Editar flashcard" : "Crear flashcard"}
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              disabled ||
              saving ||
              unchanged ||
              lock.current ||
              !draft.front.trim() ||
              !draft.back.trim()
            )
              return;
            lock.current = true;
            setSaving(true);
            setSubmitted(true);
            setFailed(false);
            const confirmed = await commit((previous) =>
              editing
                ? editPersonalCard(previous, draft.id, draft.front, draft.back)
                : addPersonalCard(previous, draft),
            );
            if (!confirmed) setFailed(true);
            setSaving(false);
            lock.current = false;
          }}
        >
          <div className="personal-editor-heading">
            <h3>{editing ? "Editar flashcard" : "Nueva flashcard"}</h3>
            <p>{sectionName(draft.section_id)} · Creadas</p>
          </div>
          {!editing && (
            <label className="personal-section">
              Sección
              <select
                aria-label="Sección de la flashcard"
                value={draft.section_id}
                disabled={disabled || saving || submitted}
                onChange={(event) => setDraft({ ...draft, section_id: event.target.value })}
              >
                {(sections?.some((section) => section.id === card.section_id)
                  ? sections
                  : [
                      { id: card.section_id, title: sectionName(card.section_id) },
                      ...(sections ?? []),
                    ]
                ).map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.id} · {section.title}
                  </option>
                ))}
              </select>
              {!sections && !sectionsFailed && <small>Cargando secciones…</small>}
              {sectionsFailed && (
                <small>
                  No se cargó la lista de secciones. Puedes guardar en la sección actual.
                </small>
              )}
            </label>
          )}
          <p>
            {editing
              ? "Cambia el frente o el reverso. Tu progreso de esta flashcard se conserva."
              : "Escribe o pega información. También puedes seleccionar texto del frente o reverso de la tarjeta de arriba."}
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
          {failed && (
            <p role="alert">
              {editing
                ? "No se guardaron los cambios. Tu borrador sigue aquí."
                : "No se guardó la flashcard. Tu borrador sigue aquí."}
            </p>
          )}
          {failed && <p>Usa Reintentar guardado para confirmar este intento antes de continuar.</p>}
          <div className="personal-actions">
            <button
              className="coach-primary"
              type="submit"
              disabled={
                disabled ||
                saving ||
                submitted ||
                unchanged ||
                !draft.front.trim() ||
                !draft.back.trim()
              }
            >
              {saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar flashcard"}
            </button>
            <button
              type="button"
              disabled={saving || submitted}
              onClick={() => {
                setDraft(null);
                setEditing(false);
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
