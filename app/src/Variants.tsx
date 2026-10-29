import { useState } from "react";
import type { ClinicalAxis } from "./types";
import { Icon, MarkedText, SourceList } from "./ui";

export default function Variants({
  axis,
  onReview,
}: {
  axis: ClinicalAxis;
  onReview: (label: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const scenario = axis.variants[index];
  const previous = scenario.from === null ? null : axis.variants[scenario.from];
  return (
    <section className="variants" aria-label="Variantes del caso">
      <div className="mode-intro">
        <h2>¿Qué cambia tu decisión?</h2>
        <p>
          Parte de un caso. Cambia un factor y sigue su efecto en el manejo.
        </p>
      </div>
      <div className="scenario-picker" aria-label="Elegir variante">
        {axis.variants.map((item, i) => (
          <button
            key={item.id}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
          >
            <span>
              {i === 0 ? (
                <Icon name="book" size={17} />
              ) : (
                <Icon name="branch" size={17} />
              )}
            </span>
            {item.title}
          </button>
        ))}
      </div>
      <section className="decision-workbench" aria-label="Cambio de decisión">
        <div className="workbench-heading">
          <span className="mode-badge">
            {scenario.changes.length === 0
              ? "Caso base"
              : scenario.changes.length === 1
                ? "Microvariación · 1 dato"
                : `Contraste · ${scenario.changes.length} datos`}
          </span>
          <span className="severity">{scenario.severity}</span>
        </div>
        {previous && (
          <div className="previous-case">
            <strong>Partimos de: {previous.title.toLowerCase()}</strong>
            <p>{previous.vignette.replace(/\[\[|\]\]/g, "")}</p>
          </div>
        )}
        <p className="scenario-vignette">
          <MarkedText text={scenario.vignette} />
        </p>
        {previous && (
          <>
            <div className="delta-table">
              <div className="delta-row delta-header">
                <span>Factor</span>
                <span>Antes</span>
                <span>Ahora</span>
              </div>
              {scenario.changes.map((change) => (
                <div className="delta-row" key={change.field}>
                  <strong>{change.field}</strong>
                  <span>{change.before}</span>
                  <span className="delta-new">{change.after}</span>
                </div>
              ))}
            </div>
            <div className="unchanged">
              <h3>Datos que se conservan</h3>
              <ul>
                {scenario.unchanged.map((item) => (
                  <li key={item}>
                    <Icon name="check" size={14} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <div className="diagnosis-line">
          <span>Interpretación del caso</span>
          <h3>{scenario.diagnosis}</h3>
        </div>
        <div className={`decision-pair ${previous ? "" : "single"}`}>
          {previous && (
            <div className="old-decision">
              <h3>Decisión anterior</h3>
              <p>{previous.decision}</p>
            </div>
          )}
          <div className="new-decision">
            <h3>
              {previous ? "Decisión con este cambio" : "Primera decisión"}
            </h3>
            <p>{scenario.decision}</p>
          </div>
        </div>
        <div className="why-decision">
          <Icon name="branch" />
          <div>
            <h3>Por qué cambia</h3>
            <p>{scenario.reason}</p>
          </div>
        </div>
        <div className="workbench-footer">
          <p>
            Las variantes son ramas didácticas. No son etapas por las que toda
            persona debe pasar.
          </p>
          <button
            className="text-button"
            onClick={() => onReview(scenario.title)}
          >
            <Icon name="comment" size={16} /> Comentar variante
          </button>
        </div>
        <details>
          <summary>Fuentes de esta decisión</summary>
          <SourceList ids={scenario.sources} />
        </details>
      </section>
    </section>
  );
}
