import { useState } from "react";
import type { ClinicalAxis, ClinicalCase } from "./types";
import { Icon, MarkedText } from "./ui";

export default function Comparison({
  axis,
  highlight,
  onHighlight,
  onDetail,
  onReview,
}: {
  axis: ClinicalAxis;
  highlight: boolean;
  onHighlight: (value: boolean) => void;
  onDetail: (item: ClinicalCase) => void;
  onReview: (item: ClinicalCase) => void;
}) {
  const [mapOpen, setMapOpen] = useState(() => window.innerWidth >= 1100);
  return (
    <section className="comparison" aria-label="Comparación de casos">
      <div className="comparison-intro">
        <div>
          <span className="section-kicker">Aprender por contraste</span>
          <h2>Un mismo síntoma. Distintas explicaciones.</h2>
          <p>{axis.shared}</p>
        </div>
        <label className="highlight-toggle">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(event) => onHighlight(event.target.checked)}
          />
          <span>Resaltar el dato que distingue</span>
        </label>
      </div>
      <div className="comparison-layout">
        <div className="case-grid">
          {axis.cases.map((item, index) => (
            <article className="clinical-card" key={item.id}>
              <div className="card-heading">
                <span className="case-number">
                  Caso {String.fromCharCode(65 + index)}
                </span>
                <span className="case-category">{item.category}</span>
              </div>
              <h2>{item.diagnosis}</h2>
              <p className="vignette">
                <MarkedText text={item.vignette} highlight={highlight} />
              </p>
              <div className="discriminator">
                <span className="key-dot" />
                <div>
                  <strong>La pista que distingue</strong>
                  <p>{item.discriminator}</p>
                </div>
              </div>
              <details className="reasoning-details">
                <summary>
                  <Icon name="branch" size={17} />
                  Conectar mecanismo y manejo
                  <span className="details-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
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
              </details>
              <div className="card-actions">
                <button className="text-button" onClick={() => onDetail(item)}>
                  Profundizar <Icon name="arrow" size={16} />
                </button>
                <span className="source-count">
                  {item.sources.length} fuentes
                </span>
                <button
                  className="comment-case"
                  aria-label="Comentar este caso"
                  title="Comentar este caso"
                  onClick={() => onReview(item)}
                >
                  <Icon name="comment" size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
        <aside className="contrast-map" aria-label="Mapa de contraste">
          <details
            open={mapOpen}
            onToggle={(event) => setMapOpen(event.currentTarget.open)}
          >
            <summary>
              <span>
                <Icon name="branch" size={19} />
                Mapa de contraste
              </span>
              <span className="map-chevron" aria-hidden="true">
                ⌄
              </span>
            </summary>
            <div className="map-body">
              <p>Lee la pista. Encuentra la alternativa.</p>
              {axis.cases.map((item) => (
                <button
                  className="map-entry"
                  key={item.id}
                  onClick={() => onDetail(item)}
                  aria-label={`Ver caso de ${item.diagnosis}`}
                >
                  <span>
                    {item.vignette.match(/\[\[(.*?)\]\]/)?.[1] ||
                      item.discriminator}
                  </span>
                  <strong>
                    {item.diagnosis}
                    <Icon name="arrow" size={14} />
                  </strong>
                </button>
              ))}
              <div className="map-note">
                <Icon name="book" size={18} />
                <p>
                  El dato orienta. El contexto y los criterios completan el
                  diagnóstico.
                </p>
              </div>
            </div>
          </details>
          <div className="logic-note">
            <span className="section-kicker">Entender la lógica</span>
            <h3>Del mecanismo a la decisión.</h3>
            <div>
              <span>Qué ocurre</span>
              <i>↓</i>
              <span>Cómo se manifiesta</span>
              <i>↓</i>
              <span>Qué hacer primero</span>
            </div>
            <p>Abre el razonamiento de un caso para seguir esa relación.</p>
          </div>
        </aside>
      </div>
      <div className="takeaway">
        <Icon name="spark" />
        <p>{axis.takeaway}</p>
      </div>
    </section>
  );
}
