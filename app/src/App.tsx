import { useState } from "react";
import { axes } from "./content";
import type { ClinicalCase } from "./types";
import { Icon, MarkedText, Modal, SourceList } from "./ui";
import Variants from "./Variants";
import Practice from "./Practice";
import Review from "./Review";
import {
  REVIEW_KEY,
  useLocalData,
  validReviews,
  type ReviewContext,
} from "./storage";

const modes = {
  compare: "Comparar casos",
  variants: "Cambiar el caso",
  practice: "Practicar",
} as const;

export default function App() {
  const [axisId, setAxisId] = useState(() =>
    axes.some((axis) => axis.id === window.location.hash.slice(1))
      ? window.location.hash.slice(1)
      : "amenorrea",
  );
  const [highlight, setHighlight] = useState(true);
  const [detail, setDetail] = useState<ClinicalCase | null>(null);
  const [mode, setMode] = useState<keyof typeof modes>("compare");
  const [review, setReview] = useState<ReviewContext | null>(null);
  const [notes, setNotes, persisted] = useLocalData(
    REVIEW_KEY,
    validReviews,
    [],
  );
  const axis = axes.find((item) => item.id === axisId)!;
  const changeAxis = (id: string) => {
    setAxisId(id);
    window.history.replaceState(null, "", `#${id}`);
    setDetail(null);
  };
  const openReview = (label?: string, caseId?: string) =>
    setReview({
      axisId: axis.id,
      section: mode,
      label: `${axis.title} · ${label || modes[mode]}`,
      ...(caseId ? { caseId } : {}),
    });

  return (
    <div className="app-shell">
      <a className="skip-link" href="#study">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="ENARM Contraste, inicio"
        >
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>
            ENARM
            <strong>
              Contraste<span>.</span>
            </strong>
          </span>
        </a>
        <div className="sidebar-intro">
          <span className="sample-dot" />
          Muestra para explorar
        </div>
        <nav className="axis-nav" aria-label="Ejes clínicos">
          <p>¿Por dónde empezamos?</p>
          {axes.map((item) => (
            <button
              key={item.id}
              className={
                item.id === axisId ? "axis-button selected" : "axis-button"
              }
              onClick={() => changeAxis(item.id)}
              aria-current={item.id === axisId ? "page" : undefined}
            >
              <Icon name={item.id === "amenorrea" ? "spark" : "branch"} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.cases.length} diagnósticos para comparar</small>
              </span>
              <span className="axis-caret" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="key-sample">Un dato cambia la lectura.</span>
          <p>Encuentra lo que distingue a dos casos parecidos.</p>
          <div className="small-rule" />
          <span>Aprende. Contrasta. Decide.</span>
        </div>
        <div className="sidebar-footer">
          <Icon name="book" size={17} />
          <span>
            ENARM · Capa 1<br />
            <small>Contenido de muestra</small>
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Tu espacio de estudio</span>
          <div className="topbar-actions">
            <span className="edition">Versión para revisión</span>
            <button className="review-trigger" onClick={() => openReview()}>
              <Icon name="comment" size={17} />
              Tu revisión{notes.length > 0 && <span>{notes.length}</span>}
            </button>
          </div>
        </header>
        <main id="study" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="area">{axis.area}</p>
              <h1>{axis.title}</h1>
              <p className="lead">{axis.question}</p>
            </div>
            <div className="case-count">
              <strong>{String(axis.cases.length).padStart(2, "0")}</strong>
              <span>
                formas de explicar
                <br />
                el mismo síntoma
              </span>
            </div>
          </div>
          <nav className="study-tabs" aria-label="Modo de estudio">
            {(Object.keys(modes) as (keyof typeof modes)[]).map((key, i) => (
              <button
                key={key}
                className={mode === key ? "active" : ""}
                aria-current={mode === key ? "page" : undefined}
                onClick={() => setMode(key)}
              >
                <span>0{i + 1}</span>
                {modes[key]}
              </button>
            ))}
          </nav>
          {mode === "compare" && (
            <section className="comparison" aria-label="Comparación de casos">
              <div className="comparison-intro">
                <div className="shared-case">
                  <span className="shared-icon">
                    <Icon name="book" />
                  </span>
                  <div>
                    <strong>El punto de partida es el mismo</strong>
                    <p>{axis.shared}</p>
                  </div>
                </div>
                <label className="highlight-toggle">
                  <input
                    type="checkbox"
                    checked={highlight}
                    onChange={(event) => setHighlight(event.target.checked)}
                  />
                  <span>Resaltar el dato que distingue</span>
                </label>
              </div>
              <div className="case-grid">
                {axis.cases.map((item, index) => (
                  <article className="clinical-card" key={item.id}>
                    <div className="card-heading">
                      <span className="case-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="case-category">{item.category}</span>
                    </div>
                    <h2>{item.diagnosis}</h2>
                    <p className="vignette">
                      <MarkedText text={item.vignette} highlight={highlight} />
                    </p>
                    <div className="discriminator">
                      <span className="key-dot" />
                      <p>{item.discriminator}</p>
                    </div>
                    <div className="cause-decision">
                      <div>
                        <h3>Qué ocurre</h3>
                        <p>{item.mechanism}</p>
                      </div>
                      <span className="cause-arrow" aria-hidden="true">
                        ↓
                      </span>
                      <div>
                        <h3>Primera decisión</h3>
                        <p>{item.decision}</p>
                      </div>
                    </div>
                    <div className="case-contrast">
                      <strong>Para distinguirlo</strong>
                      <p>{item.contrast}</p>
                    </div>
                    <div className="card-actions">
                      <button
                        className="text-button"
                        onClick={() => setDetail(item)}
                      >
                        Profundizar <Icon name="arrow" size={16} />
                      </button>
                      <span className="source-count">
                        {item.sources.length} fuentes
                      </span>
                      <button
                        className="comment-case"
                        aria-label="Comentar este caso"
                        title="Comentar este caso"
                        onClick={() => openReview(item.diagnosis, item.id)}
                      >
                        <Icon name="comment" size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="takeaway">
                <Icon name="branch" />
                <p>{axis.takeaway}</p>
              </div>
            </section>
          )}
          {mode === "variants" && (
            <Variants
              key={axis.id}
              axis={axis}
              onReview={(label) => openReview(label)}
            />
          )}
          {mode === "practice" && (
            <Practice
              key={axis.id}
              axis={axis}
              onReview={(label) => openReview(label)}
            />
          )}
          <footer className="study-footer">
            <p>{axis.glossary}</p>
            {mode !== "practice" && (
              <details>
                <summary>Fuentes y alcance de esta muestra</summary>
                <p>{axis.coverage}</p>
                <p>
                  Casos construidos para enseñanza. Las cifras son ilustrativas.
                  Revisión clínica pendiente.
                </p>
                <SourceList ids={axis.sources} />
              </details>
            )}
            <p className="quiet">
              Basado en ENARM_Capa1_Completo.pdf y fuentes clínicas indicadas.
              Muestra parcial para evaluar el método. Revisión clínica
              pendiente.
            </p>
          </footer>
        </main>
      </div>
      {detail && (
        <Modal title={detail.diagnosis} onClose={() => setDetail(null)}>
          <span className="detail-category">{axis.title}</span>
          <p className="detail-vignette">
            <MarkedText text={detail.vignette} />
          </p>
          <div className="detail-section">
            <h3>Confirmar el diagnóstico</h3>
            <p>{detail.detail.confirm}</p>
          </div>
          <div className="detail-section">
            <h3>Del mecanismo al tratamiento</h3>
            <p>{detail.detail.treatment}</p>
          </div>
          <div className="detail-section">
            <h3>Qué modifica la decisión</h3>
            <p>{detail.detail.modifiers}</p>
          </div>
          <div className="detail-limit">
            <h3>Límite del patrón</h3>
            <p>{detail.detail.limit}</p>
          </div>
          <details>
            <summary>Consultar fuentes</summary>
            <SourceList ids={detail.sources} />
          </details>
        </Modal>
      )}
      {review && (
        <Review
          context={review}
          notes={notes}
          persisted={persisted}
          onSave={(note) => setNotes((current) => [...current, note])}
          onDelete={(id) =>
            setNotes((current) => current.filter((note) => note.id !== id))
          }
          onClose={() => setReview(null)}
        />
      )}
    </div>
  );
}
