import { useState } from "react";
import type { ClinicalAxis } from "./types";
import { Icon, MarkedText, SourceList } from "./ui";
import { PRACTICE_KEY, useLocalData, validPractice } from "./storage";

const labels: Record<string, string> = {
  ancla: "Ancla",
  contraste: "Contraste",
  microvariacion: "Microvariación",
  discriminador: "Discriminador",
  primera_decision: "Primera decisión",
};

export default function Practice({
  axis,
  onReview,
}: {
  axis: ClinicalAxis;
  onReview: (label: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const [done, setDone, persisted] = useLocalData(
    PRACTICE_KEY,
    validPractice,
    {},
  );
  const card = axis.practice[index];
  const count = axis.practice.filter((item) => done[item.id]).length;
  const changeCard = (next: number) => {
    setIndex(next);
    setRevealed(false);
  };
  const grade = (value: "known" | "again") =>
    setDone((current) => ({ ...current, [card.id]: value }));
  return (
    <section className="practice" aria-label="Práctica de casos">
      <div className="mode-intro">
        <h2>Reconoce el patrón sin ver la respuesta.</h2>
        <p>Lee el caso, formula tu respuesta y después compruébala.</p>
      </div>
      <div className="practice-progress">
        <span>
          {count} de {axis.practice.length} casos practicados
        </span>
        <span>Progreso en este navegador</span>
      </div>
      <div
        className="practice-track"
        role="progressbar"
        aria-label="Casos practicados"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={axis.practice.length}
      >
        <span style={{ width: `${(count / axis.practice.length) * 100}%` }} />
      </div>
      <div className="practice-card">
        <div className="practice-meta">
          <span>{labels[card.type] || card.type}</span>
          <span>
            Caso {index + 1} de {axis.practice.length}
          </span>
        </div>
        <p className="practice-vignette">
          <MarkedText text={card.vignette} highlight={highlight} />
        </p>
        <h3 className="practice-question">{card.question}</h3>
        {!revealed ? (
          <div className="practice-reveal">
            <button
              className="primary-button"
              onClick={() => setRevealed(true)}
            >
              Mostrar respuesta <Icon name="arrow" size={17} />
            </button>
            <label className="highlight-toggle">
              <input
                type="checkbox"
                checked={highlight}
                onChange={(event) => setHighlight(event.target.checked)}
              />
              <span>Resaltar el dato que distingue</span>
            </label>
          </div>
        ) : (
          <div className="practice-answer" aria-live="polite">
            <span className="answer-label">Respuesta y razonamiento</span>
            <h2>{card.answer}</h2>
            <p>{card.explanation}</p>
            <div className="answer-decision">
              <h3>Primera decisión</h3>
              <p>{card.decision}</p>
            </div>
            <p className="answer-limit">{card.limit}</p>
            <div className="self-grade">
              <span>¿Cómo te fue?</span>
              <button
                aria-pressed={done[card.id] === "again"}
                onClick={() => grade("again")}
              >
                Volver a estudiar
              </button>
              <button
                aria-pressed={done[card.id] === "known"}
                onClick={() => grade("known")}
              >
                <Icon name="check" size={16} /> Lo reconocí
              </button>
            </div>
            <details>
              <summary>Fuentes de la respuesta</summary>
              <SourceList ids={card.sources} />
            </details>
          </div>
        )}
        <div className="practice-navigation">
          <button
            className="secondary-button"
            disabled={index === 0}
            onClick={() => changeCard(index - 1)}
          >
            Caso anterior
          </button>
          <button
            className="text-button"
            onClick={() => onReview(`Práctica: ${index + 1} (${card.id})`)}
            aria-label="Comentar este caso"
          >
            <Icon name="comment" size={18} />
          </button>
          <button
            className="secondary-button"
            disabled={index === axis.practice.length - 1}
            onClick={() => changeCard(index + 1)}
          >
            Siguiente caso <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
      {!persisted && (
        <p className="storage-warning" role="status">
          El navegador no permite guardar el progreso. Puedes continuar con la
          práctica durante esta sesión.
        </p>
      )}
      <p className="practice-note">
        La muestra no programa repasos futuros. Marcar una respuesta registra
        que la practicaste.
      </p>
    </section>
  );
}
