import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CardSource, StudyCardData } from "./library-types";
import { Icon } from "./ui";

function Clue({ text, clue, enabled }: { text: string; clue?: string; enabled: boolean }) {
  if (!enabled || !clue || !text.includes(clue)) return <>{text}</>;
  const start = text.indexOf(clue);
  return <>{text.slice(0, start)}<mark>{clue}</mark>{text.slice(start + clue.length)}</>;
}
function References({ sources }: { sources: CardSource[] }) {
  return <ul className="library-sources">{sources.map((s, i) => <li key={i}>
    {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a> : <>{s.label}{s.pages?.length ? ` · pp. ${s.pages.join(", ")}` : ""}</>}
  </li>)}</ul>;
}
function Corrections({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return <details className="source-corrections"><summary>Precisiones de las fuentes</summary><ul>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul></details>;
}

export default function StudyCard({ card, status, onRate, onReview, onFollow, ratingArea, onReveal, initialHighlight = true }: {
  card: StudyCardData;
  status?: "known" | "again";
  onRate: (value: "known" | "again") => void;
  onReview: () => void;
  onFollow?: (topicId: string) => void;
  ratingArea?: ReactNode;
  onReveal?: () => void;
  initialHighlight?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [highlight, setHighlight] = useState(initialHighlight);
  const answer = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (revealed) answer.current?.focus(); }, [revealed]);
  const hasClue = card.front.some(row => row.highlight);
  return <article className="library-card">
    <div className="library-card-bar">
      <span>{card.family === "eje" ? "Eje Clínico" : `Patrones Madre · Nivel ${card.level}`}</span>
      {hasClue && <label className="clue-toggle"><input type="checkbox" checked={highlight} onChange={e => setHighlight(e.target.checked)} />Resaltar el dato clave</label>}
    </div>
    <section className="library-front" aria-label="Frente de la tarjeta">
      <h2 id="library-card-question" tabIndex={-1}>{card.prompt}</h2>
      {card.context && <p className="library-context">{card.context}</p>}
      <ol className="library-case-rows">{card.front.map((row, i) => <li key={i}><span className="row-number" aria-hidden="true">{i + 1}</span><p><Clue text={row.text} clue={row.highlight} enabled={highlight} /></p></li>)}</ol>
    </section>
    {!revealed ? <div className="library-reveal"><p>Relaciona cada número con su respuesta.</p><button className="primary-button" onClick={() => { setRevealed(true); onReveal?.(); }}>Mostrar respuesta <Icon name="arrow" size={18} /></button></div> :
      <section className="library-answer" aria-label="Respuesta de la tarjeta">
        <h2 ref={answer} tabIndex={-1}>Compara tu razonamiento</h2>
        <ol className="library-answer-rows">{card.back.map((row, i) => <li key={i}>
          <span className="row-number" aria-hidden="true">{i + 1}</span>
          <div>{row.title && <h3>{row.title}</h3>}<p>{row.text}</p>
            {row.discriminator && <p className="answer-clue"><strong>Dato clave</strong><mark>{row.discriminator}</mark></p>}
            {row.action && <p className="answer-action"><strong>Primera acción</strong>{row.action}</p>}
            {row.reason && <p className="answer-reason"><strong>Por qué</strong>{row.reason}</p>}
            {row.limits && <details className="pattern-limit"><summary>Límite del patrón</summary><p>{row.limits}</p></details>}
            {row.sources && <details className="pattern-limit"><summary>Fuentes de este caso</summary><References sources={row.sources} /></details>}
            <Corrections notes={row.corrections} />
            {row.topic_id && onFollow && <button className="follow-case-button" onClick={() => onFollow(row.topic_id!)}>Ver manejo y variantes <Icon name="arrow" size={15} /></button>}
          </div>
        </li>)}</ol>
        <Corrections notes={card.corrections} />
        {ratingArea ?? <div className="library-rating"><p>¿Lo reconociste?</p><div><button aria-pressed={status === "again"} onClick={() => onRate("again")}>Quiero repetirlo</button><button aria-pressed={status === "known"} onClick={() => onRate("known")}><Icon name="check" size={16} />Lo reconocí</button></div></div>}
        <details className="library-reference-details"><summary>Fuentes de la tarjeta</summary><References sources={card.sources} /></details>
      </section>}
    <div className="library-card-footer"><span>Bloque {card.block_id}</span><button className="text-button" onClick={onReview}><Icon name="comment" size={16} />Comentar esta tarjeta</button></div>
  </article>;
}
