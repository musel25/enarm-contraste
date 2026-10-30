import { estimatePlan } from "./engine";
import type { CoachIndex, CoachState, Forecast } from "./types";

const scope = self as unknown as { onmessage: ((event: MessageEvent<{ state: CoachState; index: CoachIndex; day: string }>) => void) | null; postMessage: (data: { result?: Forecast; error?: string }) => void };
scope.onmessage = event => {
  try { scope.postMessage({ result: estimatePlan(event.data.state, event.data.index, event.data.day) }); }
  catch { scope.postMessage({ error: "Revisa la fecha, los temas y el tiempo del plan." }); }
};
