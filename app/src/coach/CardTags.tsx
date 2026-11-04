import type { CardTag, QuestionOrder } from "./types";

export const orderLabels: Record<QuestionOrder, string> = {
  1: "1er orden · básica",
  2: "2º orden · intermedia",
  3: "3er orden · integradora",
};
/** Personal labels for one question: its order, «profundizar» and «al final». */
export default function CardTags({
  tag,
  disabled,
  onChange,
  laterLabel = "Al final de la sesión",
}: {
  tag: CardTag | undefined;
  disabled: boolean;
  onChange: (change: Partial<CardTag>) => void;
  laterLabel?: string;
}) {
  return (
    <div className="card-tags" role="group" aria-label="Marcas de esta pregunta">
      <div className="card-tags-order" role="group" aria-label="Orden de la pregunta">
        <span>Orden</span>
        {([1, 2, 3] as const).map((order) => (
          <button
            key={order}
            type="button"
            disabled={disabled}
            aria-pressed={tag?.order === order}
            title={orderLabels[order]}
            onClick={() => onChange({ order: tag?.order === order ? undefined : order })}
          >
            {order}º
          </button>
        ))}
      </div>
      <button
        type="button"
        className="card-tag-deepen"
        disabled={disabled}
        aria-pressed={!!tag?.deepen}
        onClick={() => onChange({ deepen: !tag?.deepen })}
      >
        {tag?.deepen ? "★" : "☆"} Profundizar
      </button>
      <button
        type="button"
        className="card-tag-later"
        disabled={disabled}
        aria-pressed={!!tag?.later}
        onClick={() => onChange({ later: !tag?.later })}
      >
        ↓ {laterLabel}
      </button>
    </div>
  );
}
