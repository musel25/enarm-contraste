import type { ClinicalObjective } from "./types";

export const objectiveLabels: Record<ClinicalObjective, string> = {
  ancla: "Ancla",
  variante: "Otra presentación",
  incompleta: "Presentación incompleta",
  subtipo: "Subtipo",
  contraste: "Contraste",
  cambio: "Cambio decisivo",
  dato_faltante: "Dato faltante",
  gravedad: "Gravedad",
  mecanismo: "Mecanismo",
};
export const isClinicalObjective = (value: unknown): value is ClinicalObjective =>
  typeof value === "string" && Object.hasOwn(objectiveLabels, value);
