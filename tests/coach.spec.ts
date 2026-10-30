import { test, expect } from "@playwright/test";
import { mockCoach } from "./coach-fixtures";
import type { CoachState } from "../app/src/coach/types";

test.use({ timezoneId: "UTC" });

test.beforeEach(async ({ page }) => {
  await mockCoach(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("builds a daily-time plan, opens the first card and persists honest progress", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Tu plan. Un día a la vez.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await expect(page.getByRole("region", { name: "Estimación del plan" })).toContainText("primera vuelta");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText("Una función cambia.");
});

test("celebrates a fixed daily goal, keeps the course goal visible and supports undo", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
    await page.getByRole("button", { name: /^Bien/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Primera vuelta" })).toHaveAttribute("aria-valuenow", "2");
  await page.getByRole("button", { name: "Deshacer última respuesta", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
});

test("offers deadline mode, clear estimates and a mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto("./");
  await expect(page.getByRole("textbox", { name: "Fecha objetivo", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Estimación del plan" })).toContainText("día");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tu meta de hoy", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function startTimePlan(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
}

async function savedState(page: import("@playwright/test").Page): Promise<CoachState> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open("enarm-coach-v1", 1);
    open.onsuccess = () => { const db = open.result; const read = db.transaction("state").objectStore("state").get("current"); read.onsuccess = () => { resolve(read.result); db.close(); }; read.onerror = reject; };
    open.onerror = reject;
  }));
}

test("pause preserves the answer and blocks ratings until resumed", async ({ page }) => {
  await startTimePlan(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.keyboard.press("3");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Reanudar", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toBeVisible();
  await page.keyboard.press("3");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
});

test("failed storage does not advance or grant progress and keeps an exportable attempt", async ({ page }) => {
  await startTimePlan(page);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException("Test disk failure", "QuotaExceededError"); };
  });
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("alert")).toContainText("no se pudo guardar");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "0");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia de este intento" }).click();
  expect((await download).suggestedFilename()).toContain("enarm-progreso");
});

test("a stale tab cannot replace newer saved progress", async ({ page, context }) => {
  await startTimePlan(page);
  const other = await context.newPage();
  await mockCoach(other);
  await other.goto("./");
  await expect(other.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await other.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await other.getByRole("button", { name: /^Fácil/ }).click();
  await expect(other.getByRole("alert")).toContainText("Otra pestaña");
  await expect(other.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "0");
  await other.getByRole("button", { name: "Cargar progreso más reciente" }).click();
  await expect(other.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
});

test("adds exactly one extra card without moving the daily finish line", async ({ page }) => {
  await startTimePlan(page);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
    await page.getByRole("button", { name: /^Otra vez/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuemax", "2");
  await page.getByRole("button", { name: "Una tarjeta más" }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "2");
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Primera vuelta" })).toHaveAttribute("aria-valuenow", "3");
  const state = await savedState(page);
  expect(Object.values(state.days)[0].extra_ids).toHaveLength(1);
  expect(state.history.filter(a => a.rating === 1)).toHaveLength(2);
});

test("checks backups before replacing progress and preserves the previous state", async ({ page }) => {
  await startTimePlan(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  const backup = await savedState(page);
  await page.getByRole("button", { name: "Copia de mi progreso" }).click();
  const input = page.getByLabel("Importar una copia");
  await input.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"format":"enarm-coach","state":{}}') });
  await expect(page.getByRole("alert")).toContainText("Tu progreso sigue intacto");
  await expect(page.getByRole("button", { name: "Reemplazar con esta copia" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copia de mi progreso" }).click();
  await input.setInputFiles({ name: "valid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "enarm-coach", state: backup })) });
  await page.getByRole("button", { name: "Reemplazar con esta copia" }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Copia de mi progreso" }).click();
  await expect(page.getByRole("button", { name: "Exportar la copia anterior a la última importación" })).toBeVisible();
});

test("retrying a failed import still preserves the previous progress", async ({ page }) => {
  await startTimePlan(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true })).toBeVisible();
  const backup = await savedState(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copia de mi progreso" }).click();
  await page.getByLabel("Importar una copia").setInputFiles({ name: "progress.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "enarm-coach", state: backup })) });
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) { if (key === "current") { IDBObjectStore.prototype.put = put; throw new DOMException("Test disk failure", "QuotaExceededError"); } return put.call(this, value, key); };
  });
  await page.getByRole("button", { name: "Reemplazar con esta copia" }).click();
  await expect(page.getByRole("alert")).toContainText("no se pudo guardar");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Reintentar guardado" }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Copia de mi progreso" }).click();
  await expect(page.getByRole("button", { name: "Exportar la copia anterior a la última importación" })).toBeVisible();
});

test("active study time excludes a manual pause", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-10T12:00:00Z") });
  await startTimePlan(page);
  await page.clock.fastForward(10_000);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.clock.fastForward(60_000);
  await page.getByRole("button", { name: "Reanudar", exact: true }).first().click();
  await page.clock.fastForward(10_000);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  const attempt = (await savedState(page)).history[0];
  expect(attempt.elapsed_seconds).toBeGreaterThanOrEqual(20);
  expect(attempt.elapsed_seconds).toBeLessThan(25);
});

test("prepares a new assignment at midnight and does not reuse the old answer", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-10T23:59:00Z") });
  await startTimePlan(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Otra vez/ }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await page.clock.fastForward(65_000);
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "0");
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toHaveCount(0);
  expect(Object.keys((await savedState(page)).days)).toEqual(["2026-11-10", "2026-11-11"]);
});

test("a new deadline day uses its own forecast before freezing the target", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-10T12:00:00Z") });
  await page.goto("./");
  await page.getByRole("textbox", { name: "Fecha objetivo", exact: true }).fill("2026-11-11");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuemax", "3");
  await expect(page.locator(".coach-course-forecast")).toContainText("5 min al día");
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuemax", "5");
  const state = await savedState(page);
  expect(state.days["2026-11-11"].budget_seconds).toBe(600);
});

test("plan edits retain saved practice and incomplete inputs stay safe", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await startTimePlan(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ajustar mi plan" }).click();
  await page.getByRole("button", { name: "Fecha objetivo", exact: true }).click();
  await page.getByRole("textbox", { name: "Fecha objetivo", exact: true }).fill("");
  await expect(page.getByRole("button", { name: "Guardar mi plan" })).toBeDisabled();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Guardar mi plan" }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuemax", "5");
  expect((await savedState(page)).history).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("selected formats define the course milestone with reduced motion and sound off", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("checkbox", { name: /Patrones Madre/ }).uncheck();
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Primera vuelta" })).toHaveAttribute("aria-valuemax", "1");
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Fácil/ }).click();
  await expect(page.getByText(/Primera vuelta completa\. Practicaste/)).toBeVisible();
  await expect(page.locator(".coach-confetti")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Sonido al completar" })).not.toBeChecked();
  expect((await savedState(page)).celebrated_plans).toHaveLength(1);
});

test("blocked browser storage disables study and explains recovery", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "indexedDB", { get() { throw new Error("Storage is blocked"); } }); });
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText("Tu progreso no se pudo guardar");
  await expect(page.getByRole("button", { name: "Empezar mi plan", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reintentar guardado" })).toBeVisible();
});

test("rejects an index with the wrong checksum and recovers on retry", async ({ page }) => {
  let broken = true;
  await page.route("**/study/index.json*", async route => broken ? route.fulfill({ body: "{}", contentType: "application/json" }) : route.fallback());
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText("El índice cambió");
  broken = false;
  await page.getByRole("button", { name: "Reintentar carga" }).click();
  await expect(page.getByRole("button", { name: "Empezar mi plan", exact: true })).toBeEnabled();
});
