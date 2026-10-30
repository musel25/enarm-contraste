import type { Grade } from "./types";

export function playReward() {
  try {
    const context = new AudioContext();
    const gain = context.createGain(); gain.gain.setValueAtTime(0.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3); gain.connect(context.destination);
    [523, 659, 784].forEach((hz, index) => { const tone = context.createOscillator(); tone.frequency.value = hz; tone.connect(gain); tone.start(context.currentTime + index * 0.045); tone.stop(context.currentTime + 0.25); });
    setTimeout(() => void context.close(), 450);
  } catch { /* Sound is optional. A browser without audio still saves progress. */ }
}

export function CardFeedback({ grade, done, goal }: { grade: Grade; done: number; goal: number }) {
  return <div className={`coach-feedback ${grade === 1 ? "try-again" : "recalled"}`} role="status"><span className="feedback-mark" aria-hidden="true">{grade === 1 ? "↻" : "✓"}</span><div><strong>{grade === 1 ? "Guardada para volver a practicar." : grade === 2 ? "Recordada, aunque costó." : "La recordaste."}</strong><span>{done} de {goal} para hoy · +10 de constancia</span></div></div>;
}

export function Confetti() {
  return <div className="coach-confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ "--x": `${(i * 47) % 100}%`, "--delay": `${(i % 7) * 40}ms`, "--tilt": `${i * 23}deg`, "--fall": `${110 + (i % 5) * 20}px` } as React.CSSProperties} />)}</div>;
}
