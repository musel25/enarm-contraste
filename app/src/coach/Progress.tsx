export default function Progress({
  label,
  done,
  goal,
  className = "",
}: {
  label: string;
  done: number;
  goal: number;
  className?: string;
}) {
  const stops = Math.min(10, goal);
  return (
    <div
      className={`coach-progress-track ${className} ${label === "Meta diaria" ? "daily-path" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={goal || 1}
      aria-valuenow={done}
      aria-valuetext={`${done} de ${goal} tarjetas`}
    >
      <span style={{ width: `${goal ? Math.min(100, (done / goal) * 100) : 0}%` }} />
      {label === "Meta diaria" && (
        <div className="coach-path-stops" aria-hidden="true">
          {Array.from({ length: stops }, (_, i) => (
            <i key={i} className={done >= Math.ceil(((i + 1) * goal) / stops) ? "reached" : ""}>
              {i === stops - 1 ? "⚑" : done >= Math.ceil(((i + 1) * goal) / stops) ? "✓" : ""}
            </i>
          ))}
        </div>
      )}
    </div>
  );
}
