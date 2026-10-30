export function duration(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
}
export function dateLabel(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
export function timezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City"; }
