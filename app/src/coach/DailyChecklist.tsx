import { useEffect, useRef, useState } from "react";
import { readCoach, writeCoach } from "./repository";
import { SaveConflict } from "./storage";
import type { ChecklistActivity, StudyProfile } from "./types";
import "./daily-checklist.css";

function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDay(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function chosenDay(): string {
  const day = new URLSearchParams(location.hash.split("?")[1] || "").get("day");
  return day && validDay(day) ? day : localDay();
}

export default function DailyChecklist() {
  const [profile, setProfile] = useState<StudyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [day, setDay] = useState(chosenDay);
  const [draft, setDraft] = useState("");
  const lock = useRef(false);

  async function reload() {
    setLoading(true);
    try {
      setProfile(await readCoach());
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function selectDay(next: string) {
    if (!validDay(next)) return;
    setDay(next);
    history.replaceState(
      null,
      "",
      next === localDay() ? "#daily-checklist" : `#daily-checklist?day=${next}`,
    );
  }

  async function save(next: ChecklistActivity[], clearDraft = false) {
    if (!profile || lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      const checklist = { ...profile.checklist };
      if (next.length) checklist[day] = next;
      else delete checklist[day];
      const saved = await writeCoach(profile.revision, { ...profile, checklist });
      setProfile(saved);
      setError("");
      if (clearDraft) setDraft("");
    } catch (failure) {
      setError(
        failure instanceof SaveConflict
          ? "El progreso cambió en otro dispositivo. Recarga la lista antes de continuar."
          : (failure as Error).message,
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  const activities = profile?.checklist?.[day] ?? [];
  const done = activities.filter((activity) => activity.done).length;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return (
    <main id="study" className="checklist-page" tabIndex={-1}>
      <div className="checklist-inner">
        <header className="checklist-heading">
          <h1>Daily Checklist</h1>
          <p>Escribe tus actividades del día. Marca cada actividad cuando la termines.</p>
        </header>
        <div className="checklist-date-row">
          <label>
            Fecha de la lista
            <input type="date" value={day} onChange={(event) => selectDay(event.target.value)} />
          </label>
          <div className="checklist-shortcuts">
            <button type="button" onClick={() => selectDay(localDay())}>
              Hoy
            </button>
            <button type="button" onClick={() => selectDay(localDay(yesterday))}>
              Ayer
            </button>
          </div>
        </div>
        {error && (
          <div className="checklist-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void reload()}>
              Recargar lista
            </button>
          </div>
        )}
        {loading ? (
          <p role="status">Abriendo tu lista…</p>
        ) : profile ? (
          <>
            <form
              className="checklist-form"
              onSubmit={(event) => {
                event.preventDefault();
                const text = draft.trim();
                if (!text || activities.length >= 100) return;
                void save([...activities, { id: crypto.randomUUID(), text, done: false }], true);
              }}
            >
              <label htmlFor="checklist-new">Nueva actividad</label>
              <div>
                <input
                  id="checklist-new"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={300}
                  placeholder="¿Qué planeas hacer?"
                  disabled={saving || activities.length >= 100}
                />
                <button
                  type="submit"
                  disabled={saving || !draft.trim() || activities.length >= 100}
                >
                  Agregar actividad
                </button>
              </div>
            </form>
            <section className="checklist-list" aria-label="Actividades de la fecha">
              <div className="checklist-list-heading">
                <h2>Actividades</h2>
                <span>
                  {done} de {activities.length} terminadas
                </span>
              </div>
              {activities.length ? (
                <ul>
                  {activities.map((activity) => (
                    <li key={activity.id} className={activity.done ? "complete" : ""}>
                      <label>
                        <input
                          type="checkbox"
                          checked={activity.done}
                          disabled={saving}
                          onChange={() =>
                            void save(
                              activities.map((item) =>
                                item.id === activity.id ? { ...item, done: !item.done } : item,
                              ),
                            )
                          }
                        />
                        <span>{activity.text}</span>
                      </label>
                      <button
                        type="button"
                        className="checklist-remove"
                        aria-label={`Eliminar ${activity.text}`}
                        disabled={saving}
                        onClick={() =>
                          void save(activities.filter((item) => item.id !== activity.id))
                        }
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="checklist-empty">Todavía no hay actividades para esta fecha.</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
