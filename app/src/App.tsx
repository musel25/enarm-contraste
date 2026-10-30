import { useState } from "react";
import { axes } from "./content";
import type { ClinicalCase } from "./types";
import { Icon, MarkedText, Modal, SourceList } from "./ui";
import Comparison from "./Comparison";
import Variants from "./Variants";
import Practice from "./Practice";
import Review from "./Review";
import Library from "./Library";
import Coach from "./coach/Coach";
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

function ContrastArtwork() {
  return (
    <svg
      className="contrast-artwork"
      viewBox="0 0 360 220"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="194"
        cy="112"
        r="96"
        stroke="currentColor"
        strokeOpacity=".13"
      />
      <circle
        cx="194"
        cy="112"
        r="66"
        stroke="currentColor"
        strokeOpacity=".1"
      />
      <g transform="translate(35 22) rotate(-9 80 90)">
        <rect width="144" height="170" rx="14" fill="#BFB4F2" />
        <rect
          x="1"
          y="1"
          width="142"
          height="168"
          rx="13"
          stroke="white"
          strokeOpacity=".5"
        />
        <rect x="18" y="19" width="30" height="22" rx="6" fill="#6A55AE" />
        <text x="27" y="35" fill="white" fontSize="12" fontFamily="sans-serif">
          A
        </text>
        <path
          d="M18 60H125M18 71H113M18 82H123"
          stroke="#695A99"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".45"
        />
        <rect x="16" y="98" width="112" height="17" rx="4" fill="#FFE6B7" />
        <path
          d="M23 106H119"
          stroke="#B7823C"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M18 133H123M18 144H90"
          stroke="#695A99"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".45"
        />
      </g>
      <g transform="translate(155 42) rotate(9 75 85)">
        <rect width="144" height="170" rx="14" fill="#FAF9FF" />
        <rect x="18" y="19" width="30" height="22" rx="6" fill="#EEE8FF" />
        <text
          x="27"
          y="35"
          fill="#6550AE"
          fontSize="12"
          fontFamily="sans-serif"
        >
          B
        </text>
        <path
          d="M18 60H125M18 71H113M18 82H123"
          stroke="#B7ACD2"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="16" y="98" width="112" height="17" rx="4" fill="#FFE6B7" />
        <path
          d="M23 106H90"
          stroke="#B7823C"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M18 133H123M18 144H90"
          stroke="#B7ACD2"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      <circle cx="307" cy="48" r="15" fill="#F0CB8B" />
      <path d="M301 48h12m-6-6v12" stroke="#725329" strokeWidth="1.5" />
      <circle cx="33" cy="184" r="4" fill="#BFB4F2" />
      <path d="m329 157 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="#BFB4F2" />
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState<"today" | "library" | "sample">(() => location.hash === "#biblioteca" ? "library" : axes.some(a => `#${a.id}` === location.hash) ? "sample" : "today");
  const [axisId, setAxisId] = useState(() =>
    axes.some((axis) => axis.id === location.hash.slice(1))
      ? location.hash.slice(1)
      : "amenorrea",
  );
  const [highlight, setHighlight] = useState(true);
  const [detail, setDetail] = useState<ClinicalCase | null>(null);
  const [mode, setMode] = useState<keyof typeof modes>("compare");
  const [review, setReview] = useState<ReviewContext | null>(null);
  const [method, setMethod] = useState(false);
  const [notes, setNotes, persisted] = useLocalData(
    REVIEW_KEY,
    validReviews,
    [],
  );
  const axis = axes.find((item) => item.id === axisId)!;
  const changeAxis = (id: string) => {
    setAxisId(id);
    history.replaceState(null, "", `#${id}`);
    setDetail(null);
  };
  const openReview = (label?: string, caseId?: string) =>
    setReview({
      axisId: view === "sample" ? axis.id : view,
      section: view === "sample" ? mode : view,
      label: view === "sample" ? `${axis.title} · ${label || modes[mode]}` : view === "today" ? "Plan y sesión diaria" : "Biblioteca",
      ...(caseId ? { caseId } : {}),
    });
  return (
    <div className="app-shell">
      <a className="skip-link" href="#study">
        Ir al contenido
      </a>
      <header className="masthead">
        <div className="masthead-inner">
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
              contraste<span className="brand-dot">.</span>
              <small>Medicina que se entiende</small>
            </span>
          </a>
          <nav className="header-links" aria-label="Ayuda de estudio">
            <button className={`method-trigger ${view === "today" ? "current-view" : ""}`} onClick={() => { setView("today"); history.replaceState(null, "", "#hoy"); }}>Hoy</button>
            <button className={`method-trigger ${view === "library" ? "current-view" : ""}`} onClick={() => { setView("library"); history.replaceState(null, "", "#biblioteca"); }}>Biblioteca</button>
            <button className={`method-trigger ${view === "sample" ? "current-view" : ""}`} onClick={() => { setView("sample"); history.replaceState(null, "", `#${axisId}`); }}>Explorar casos</button>
            <button className="method-trigger" onClick={() => setMethod(true)}>
              El método
            </button>
            <button className="review-trigger" onClick={() => openReview()}>
              <Icon name="comment" size={17} />
              Tu revisión{notes.length > 0 && <span>{notes.length}</span>}
            </button>
          </nav>
        </div>
      </header>
      {view === "today" ? <Coach suspended={!!review || method} onReview={setReview} /> : view === "library" ? <Library onReview={setReview} /> : <div className="workspace">
        <nav className="axis-nav" aria-label="Ejes clínicos">
          <span className="axis-nav-label">Elige un eje clínico</span>
          <div>
            {axes.map((item) => (
              <button
                key={item.id}
                className={`axis-button ${item.id === axisId ? "selected" : ""}`}
                aria-current={item.id === axisId ? "page" : undefined}
                onClick={() => changeAxis(item.id)}
              >
                <span className="axis-icon">
                  <Icon
                    name={item.id === "amenorrea" ? "spark" : "branch"}
                    size={19}
                  />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.cases.length} diagnósticos</small>
                </span>
                <span className="axis-caret" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
          <span className="sample-label">
            <span />
            Contenido para explorar
          </span>
        </nav>
        <main id="study" tabIndex={-1}>
          <div className="lesson-hero">
            <div className="lesson-heading">
              <span className="hero-badge">
                <Icon name="book" size={14} />
                {axis.area}
              </span>
              <h1>{axis.title}</h1>
              <p>{axis.question}</p>
              <div className="hero-route">
                <span>Reconocer</span>
                <i>·</i>
                <span>Distinguir</span>
                <i>·</i>
                <span>Decidir</span>
              </div>
            </div>
            <ContrastArtwork />
          </div>
          <nav className="study-tabs" aria-label="Modo de estudio">
            {(Object.keys(modes) as (keyof typeof modes)[]).map((key, i) => (
              <button
                key={key}
                className={mode === key ? "active" : ""}
                aria-current={mode === key ? "page" : undefined}
                onClick={() => setMode(key)}
              >
                <span className="tab-step">{i + 1}</span>
                {modes[key]}
                <Icon
                  name={
                    key === "compare"
                      ? "book"
                      : key === "variants"
                        ? "branch"
                        : "check"
                  }
                  size={17}
                />
              </button>
            ))}
          </nav>
          <div className="study-content">
            {mode === "compare" && (
              <Comparison
                key={axis.id}
                axis={axis}
                highlight={highlight}
                onHighlight={setHighlight}
                onDetail={setDetail}
                onReview={(item) => openReview(item.diagnosis, item.id)}
              />
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
              <div className="footer-glossary">
                <Icon name="book" size={17} />
                <p>{axis.glossary}</p>
              </div>
              {mode !== "practice" && (
                <details>
                  <summary>Fuentes y alcance de esta muestra</summary>
                  <p>{axis.coverage}</p>
                  <p>
                    Casos construidos para enseñanza. Las cifras son
                    ilustrativas. Revisión clínica pendiente.
                  </p>
                  <SourceList ids={axis.sources} />
                </details>
              )}
              <div className="footer-bottom">
                <span>contraste.</span>
                <p>
                  Basado en ENARM_Capa1_Completo.pdf y fuentes indicadas.
                  Muestra parcial. Revisión clínica pendiente.
                </p>
                <button className="text-button" onClick={() => openReview()}>
                  Sugerir un cambio
                </button>
              </div>
            </footer>
          </div>
        </main>
      </div>}
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
      {method && (
        <Modal title="Aprender por contraste" onClose={() => setMethod(false)}>
          <p className="method-lead">
            Primero compara. Después entiende el mecanismo. Por último, decide
            qué hacer.
          </p>
          <ol className="method-steps">
            <li>
              <strong>Parte del síntoma.</strong>
              <p>
                Reúne los diagnósticos que se pueden confundir. El mapa te
                permite ver sus patrones juntos.
              </p>
            </li>
            <li>
              <strong>Busca el dato que distingue.</strong>
              <p>
                Lee casos parecidos y encuentra la pista clínica,
                epidemiológica, de laboratorio o de imagen.
              </p>
            </li>
            <li>
              <strong>Conecta mecanismo y manejo.</strong>
              <p>
                Explica qué ocurre, cómo produce los hallazgos y por qué orienta
                la primera decisión.
              </p>
            </li>
            <li>
              <strong>Cambia el caso.</strong>
              <p>
                Observa qué factor modifica el diagnóstico, la urgencia o el
                tratamiento. Después practica sin ver la respuesta.
              </p>
            </li>
          </ol>
          <div className="method-references">
            <h3>La estructura toma tus mazos como referencia</h3>
            <p>
              <strong>Eje Clínico, Gineco Obstetricia Capa6:</strong> comparar
              patrones dentro del mismo motivo de consulta.
            </p>
            <p>
              <strong>Patrones Madre, Shock:</strong> seguir la relación entre
              función, hallazgo y acción.
            </p>
            <p>
              Los mazos de amenorrea y Ejes Diagnósticos aportan los
              fundamentos. Las asociaciones breves se amplían con casos,
              contexto y fuentes.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
