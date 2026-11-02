import { test, expect, type Page } from "@playwright/test";
import { mockCoach } from "./coach-fixtures";

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });

async function start(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
}
async function answer(page: Page, grade: RegExp = /^Bien/) {
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: grade }).click();
}

test("a new browser asks for an account and another browser opens the same progress", async ({ page, browser }) => {
  const user = `prueba-${Date.now().toString(36)}`;
  await page.route("**/study/**", route => route.fallback());
  await mockCoach(page);
  await page.addInitScript(() => localStorage.removeItem("enarm-contraste-guest"));
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Entra para seguir donde te quedaste." })).toBeVisible();
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill(user);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
  await page.getByLabel("Repite la contraseña", { exact: true }).fill("clave-segura-1");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await answer(page);
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByText(`Progreso protegido en el VPS · ${user}`)).toBeVisible();

  const context = await browser.newContext({ timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    const phone = await context.newPage(); await mockCoach(phone);
    await phone.addInitScript(() => localStorage.removeItem("enarm-contraste-guest"));
    await phone.goto("./");
    await phone.getByLabel("Usuario", { exact: true }).fill(user);
    await phone.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
    await phone.getByRole("button", { name: "Entrar" }).click();
    await expect(phone.getByRole("alert")).toContainText("Usuario o contraseña incorrectos");
    await phone.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
    await phone.getByRole("button", { name: "Entrar" }).click();
    await expect(phone.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  } finally { await context.close(); }
});

test("an existing device links a username without losing progress", async ({ page }) => {
  const user = `vinculo-${Date.now().toString(36)}`;
  await mockCoach(page);
  await start(page); await answer(page);
  await page.getByRole("button", { name: "Crear usuario y contraseña" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill(user);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-2");
  await page.getByLabel("Repite la contraseña", { exact: true }).fill("clave-segura-2");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByText(`Entraste como ${user}`)).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
});

test("new topics and reviews are separate sessions and a first reading is not an error", async ({ page }) => {
  await mockCoach(page);
  await start(page);
  await expect(page.getByRole("tab", { name: /Temas nuevos/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByText(/no cuenta como error/)).toBeVisible();
  await page.getByRole("button", { name: /^Otra vez/ }).click();
  await expect(page.getByText("Primera lectura guardada. Vuelve pronto.")).toBeVisible();
  await page.getByRole("tab", { name: /Repasos/ }).click();
  await expect(page.getByRole("heading", { name: "No quedan repasos para hoy." })).toBeVisible();
  const detail = page.getByRole("region", { name: /Progreso del/ });
  await expect(detail).toContainText("Primeras lecturas1");
  await expect(detail).toContainText("Errores en repasos0");
});

test("custom session size, motivation and a finished session summary", async ({ page }) => {
  await mockCoach(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByLabel("Tarjetas por sesión").fill("2");
  await page.getByLabel("Frase motivadora cada").fill("2");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await answer(page); await answer(page);
  await expect(page.getByText("2 tarjetas hoy")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terminaste 2 tarjetas." })).toBeVisible();
  await page.getByRole("button", { name: /Otra sesión de 2/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByText(/Sesión de temas nuevos · 0 de 2/)).toBeVisible();
});

test("a rest day empties today's goal and the calendar shows each day", async ({ page }) => {
  await mockCoach(page);
  await start(page);
  await page.getByRole("group", { name: "Carga de hoy" }).getByRole("button", { name: "Descanso" }).click();
  await expect(page.getByRole("heading", { name: "Hoy descansas. También es parte del plan." })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuemax", "1");
  await page.getByRole("button", { name: "Estudiar de todos modos" }).click();
  await answer(page);
  await page.getByRole("group", { name: "Actividad de los últimos 30 días" }).getByRole("button").last().click();
  await expect(page.getByRole("region", { name: /Progreso del/ })).toContainText("Respuestas1");
  await page.getByRole("group", { name: "Actividad de los últimos 30 días" }).getByRole("button").first().click();
  await expect(page.getByRole("region", { name: /Progreso del/ })).toContainText("No estudiaste este día");
});

test("question tags reach Mi avance and the subtest filters by question type", async ({ page }) => {
  await mockCoach(page);
  await start(page);
  await page.getByRole("button", { name: "☆ Profundizar" }).click();
  await expect(page.getByRole("button", { name: "★ Profundizar" })).toBeVisible();
  await page.getByRole("group", { name: "Orden de la pregunta" }).getByRole("button", { name: "2º" }).click();
  await expect(page.getByRole("group", { name: "Orden de la pregunta" }).getByRole("button", { name: "2º" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mi avance", exact: true }).click();
  await expect(page.locator(".learning-deepen")).toContainText("Eje Clínico · 01.01");
  await page.getByLabel("Orden de la pregunta").selectOption("2");
  await expect(page.getByText("1 preguntas coinciden con tu selección.")).toBeVisible();
  await page.getByLabel("Orden de la pregunta").selectOption("all");
  await page.getByRole("group", { name: "Tipo de pregunta" }).getByRole("button", { name: "Decir el diagnóstico" }).click();
  await page.getByRole("button", { name: "Seleccionar todas", exact: true }).click();
  await page.getByRole("button", { name: /Empezar subtest/ }).click();
  await expect(page.getByText("Pregunta 1 de 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pregunta del nivel 2" })).toBeVisible();
});

test("the corner timer alerts when the time is over", async ({ page }) => {
  await mockCoach(page);
  await page.addInitScript(() => localStorage.setItem("enarm-contraste-timer", JSON.stringify({ mode: "study", target: 60, started: Date.now() - 61_000, paused_at: null, paused_ms: 0, alerted: false })));
  await start(page);
  const dock = page.getByRole("complementary", { name: "Temporizador de sesión" });
  await expect(dock).toContainText("¡Tiempo!");
  await expect(dock.getByRole("alert")).toContainText("Terminó tu tiempo");
  await dock.getByRole("button", { name: "Listo" }).click();
  await expect(dock).toHaveCount(0);
  await page.getByRole("button", { name: "☕ Descanso" }).click();
  await expect(page.getByRole("heading", { name: "Estás en descanso." })).toBeVisible();
  await page.getByRole("button", { name: "Volver a estudiar" }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
});
