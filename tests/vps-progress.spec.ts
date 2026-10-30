import { test, expect, type Page } from "@playwright/test";
import { mockCoach, coachIndex } from "./coach-fixtures";
import { createAssignment, dayKey, emptyState, recordReview } from "../app/src/coach/engine";
import type { CoachIndex, CoachState } from "../app/src/coach/types";

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => { await mockCoach(page); });
async function start(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
}
async function grade(page: Page) {
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
}
async function privateCode(page: Page) {
  const field = page.getByLabel("Tu código de progreso", { exact: true });
  await expect(field).not.toHaveValue("");
  return field.inputValue();
}
async function seed(page: Page, state: CoachState) {
  await page.goto("./#amenorrea");
  await page.evaluate(state => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("enarm-coach-v1", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("state");
    open.onsuccess = () => { const db = open.result; const tx = db.transaction("state", "readwrite"); tx.objectStore("state").put(state, "current"); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(new Error("Seed failed")); };
  }), state);
}

test("migrates existing device progress to the VPS without resetting its plan", async ({ page }) => {
  const day = dayKey("UTC"), index = coachIndex as CoachIndex;
  let state: CoachState = { ...emptyState(), revision: 12, plan: { id: "legacy-plan", revision: 1, mode: "time", start_day: day, deadline_day: null, minutes_per_day: 5, section_ids: ["01"], families: ["eje", "madre"], timezone: "UTC" } };
  state.days[day] = createAssignment(state, index, day);
  state = recordReview(state, index, "eje/01.01", 3, 25, day, "legacy-answer");
  await seed(page, state);
  await page.goto("./");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByText("Guardado en el VPS", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Primera vuelta" })).toHaveAttribute("aria-valuenow", "1");
});

test("restores the same server progress on a separate browser with its private code", async ({ page, browser }) => {
  await start(page); await grade(page);
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Mi progreso en el VPS" }).click();
  await expect(page.getByLabel("Tu código de progreso", { exact: true })).not.toHaveValue("");
  const code = await privateCode(page);
  expect(code.length).toBe(43);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  const context = await browser.newContext({ timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    const other = await context.newPage(); await mockCoach(other); await other.goto("./");
    await expect(other.getByRole("heading", { name: "Tu plan. Un día a la vez.", exact: true })).toBeVisible();
    await other.getByRole("button", { name: "Mi progreso en el VPS" }).click();
    await expect(other.getByLabel("Tu código de progreso", { exact: true })).not.toHaveValue("");
    await other.getByLabel("Código de otro dispositivo", { exact: true }).fill(code);
    await other.getByRole("button", { name: "Ver progreso", exact: true }).click();
    await expect(other.getByText("1 respuestas guardadas", { exact: true })).toBeVisible();
    await other.getByRole("button", { name: "Conectar este progreso", exact: true }).click();
    await expect(other.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
    await grade(other);
    await expect(other.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true })).toBeVisible();
    await grade(page);
    await expect(page.getByRole("alert")).toContainText("Otro dispositivo o pestaña");
    await page.getByRole("button", { name: "Cargar progreso más reciente" }).click();
    await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "2");
  } finally { await context.close(); }
});

test("an unavailable VPS leaves the cached plan visible and pauses study until reconnecting", async ({ page }) => {
  await start(page); await grade(page);
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await page.route("**/api/progress", route => route.abort("failed"));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("No hay conexión con el VPS");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByText("Guardado en el VPS", { exact: true })).toHaveCount(0);
  await page.unroute("**/api/progress");
  await page.getByRole("button", { name: "Reintentar guardado" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Guardado en el VPS", { exact: true })).toBeVisible();
});

test("a missing private code cannot replace the connected profile", async ({ page }) => {
  await start(page); await grade(page);
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Mi progreso en el VPS" }).click();
  await page.getByLabel("Código de otro dispositivo", { exact: true }).fill("A".repeat(43));
  await page.getByRole("button", { name: "Ver progreso", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No encontramos progreso");
  await expect(page.getByRole("button", { name: "Conectar este progreso", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
});

test("switching profiles closes the old editor and loads the connected plan fields", async ({ page, browser }) => {
  await start(page);
  await page.getByRole("button", { name: "Ajustar mi plan" }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("7");
  const context = await browser.newContext({ timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    const other = await context.newPage(); await mockCoach(other); await start(other);
    await other.getByRole("button", { name: "Ajustar mi plan" }).click();
    await other.getByLabel("Minutos por día", { exact: true }).fill("25");
    await other.getByRole("button", { name: "Guardar mi plan" }).click();
    await other.getByRole("button", { name: "Mi progreso en el VPS" }).click();
    const code = await privateCode(other);
    await page.getByRole("button", { name: "Mi progreso en el VPS" }).click();
    await page.getByLabel("Código de otro dispositivo", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Ver progreso", exact: true }).click();
    await page.getByRole("button", { name: "Conectar este progreso", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Un poco más cerca/ })).toBeVisible();
    await page.getByRole("button", { name: "Ajustar mi plan" }).click();
    await expect(page.getByLabel("Minutos por día", { exact: true })).toHaveValue("25");
  } finally { await context.close(); }
});

test("legacy import recovery stays with its original private profile", async ({ page, browser }) => {
  await start(page);
  await page.getByRole("button", { name: "Mi progreso en el VPS" }).click();
  await expect(page.getByLabel("Tu código de progreso", { exact: true })).not.toHaveValue("");
  const originalCode = await privateCode(page);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.evaluate(() => new Promise<void>(resolve => {
    const open = indexedDB.open("enarm-coach-v1", 1);
    open.onsuccess = () => { const db = open.result; const tx = db.transaction("state", "readwrite"), store = tx.objectStore("state"); const read = store.get("current"); read.onsuccess = () => store.put(read.result, "before-import"); tx.oncomplete = () => { db.close(); resolve(); }; };
  }));
  const context = await browser.newContext({ timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    const other = await context.newPage(); await mockCoach(other); await start(other);
    await other.getByRole("button", { name: "Mi progreso en el VPS" }).click();
    await expect(other.getByLabel("Tu código de progreso", { exact: true })).not.toHaveValue("");
    const otherCode = await privateCode(other);
    async function connect(code: string) {
      await page.getByRole("button", { name: "Mi progreso en el VPS" }).click();
      await page.getByLabel("Código de otro dispositivo", { exact: true }).fill(code);
      await page.getByRole("button", { name: "Ver progreso", exact: true }).click();
      await page.getByRole("button", { name: "Conectar este progreso", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await connect(otherCode);
    const checked = page.waitForResponse(r => r.url().endsWith("/api/progress/previous"));
    await page.getByRole("button", { name: "Copia de mi progreso" }).click();
    await (await checked).finished();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole("button", { name: "Exportar la copia anterior a la última importación" })).toHaveCount(0);
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await connect(originalCode);
    await page.getByRole("button", { name: "Copia de mi progreso" }).click();
    await expect(page.getByRole("button", { name: "Exportar la copia anterior a la última importación" })).toBeVisible();
  } finally { await context.close(); }
});

test("reloading a profile changed in another tab resets an unsaved editor", async ({ page, context, browser }) => {
  await start(page);
  await page.getByRole("button", { name: "Ajustar mi plan" }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("7");
  const separate = await browser.newContext({ timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    const source = await separate.newPage(); await mockCoach(source); await start(source);
    await source.getByRole("button", { name: "Ajustar mi plan" }).click();
    await source.getByLabel("Minutos por día", { exact: true }).fill("25");
    await source.getByRole("button", { name: "Guardar mi plan" }).click();
    await source.getByRole("button", { name: "Mi progreso en el VPS" }).click();
    await expect(source.getByLabel("Tu código de progreso", { exact: true })).not.toHaveValue("");
    const code = await privateCode(source);
    const other = await context.newPage(); await mockCoach(other); await other.goto("./");
    await other.getByRole("button", { name: "Mi progreso en el VPS" }).click();
    await other.getByLabel("Código de otro dispositivo", { exact: true }).fill(code);
    await other.getByRole("button", { name: "Ver progreso", exact: true }).click();
    await other.getByRole("button", { name: "Conectar este progreso", exact: true }).click();
    await expect(other.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Guardar mi plan" }).click();
    await expect(page.getByRole("alert")).toContainText("Otro dispositivo o pestaña");
    await page.getByRole("button", { name: "Cargar progreso más reciente" }).click();
    await expect(page.getByLabel("Minutos por día", { exact: true })).toHaveValue("25");
  } finally { await separate.close(); }
});

test("a confirmed VPS save survives a failed browser cache", async ({ page }) => {
  await start(page);
  await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException("Test cache failure", "QuotaExceededError"); }; });
  await grade(page);
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByText("Guardado en el VPS", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
});

test("a lost server acknowledgment retries without duplicating the saved answer", async ({ page }) => {
  await start(page);
  let first = true;
  await page.route("**/api/progress", async route => {
    if (route.request().method() === "PUT" && first) { first = false; await route.fetch(); await route.abort("failed"); }
    else await route.fallback();
  });
  await grade(page);
  await expect(page.getByRole("alert")).toContainText("no se pudo guardar");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Reintentar guardado" }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
});
