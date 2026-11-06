import { test, expect, type Page } from "@playwright/test";
import { coachCards, mockCoach, savedWorkspace, savedProfile } from "./coach-fixtures";
import type { StudySpace } from "../app/src/coach/types";

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await mockCoach(page);
});
async function start(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
}
async function create(page: Page, front = "Pregunta personal") {
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill(front);
  await page
    .getByLabel("Reverso", { exact: true })
    .fill("Respuesta personal\n<b>Texto literal</b>");
  await page.getByRole("button", { name: "Guardar flashcard", exact: true }).click();
  await expect(page.getByText("Flashcard guardada en Creadas.", { exact: true })).toBeVisible();
}
const snapshot = (page: Page, space: StudySpace = "capa1") => savedWorkspace(page, space);
async function library(page: Page) {
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
}

test("the created-card tab preserves the source goal, grades and undoes", async ({ page }) => {
  await start(page);
  const before = await snapshot(page);
  await create(page);
  await page.getByRole("button", { name: "Capa 1 creadas", exact: true }).click();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta personal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText(
    "<b>Texto literal</b>",
  );
  await expect(page.locator(".library-answer b")).toHaveCount(0);
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true }),
  ).toBeVisible();
  const rated = await snapshot(page, "creadas1");
  expect((await snapshot(page)).days[Object.keys(before.days)[0]].ids).toEqual(
    before.days[Object.keys(before.days)[0]].ids,
  );
  expect(rated.history).toHaveLength(1);
  expect(Object.keys(rated.created_cards ?? {})).toHaveLength(1);
  await page.getByRole("button", { name: "Deshacer última respuesta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta personal", exact: true })).toBeVisible();
  expect((await snapshot(page, "creadas1")).history).toHaveLength(0);
});

test("section Creadas and Suspendidas preserve cards and restore both card types", async ({
  page,
}) => {
  await start(page);
  await create(page);
  await page.getByRole("button", { name: "Suspender flashcard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true }),
  ).toBeVisible();
  await library(page);
  await page.getByRole("button", { name: "Creadas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta personal", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Suspender flashcard", exact: true }).click();
  await expect(
    page.getByText("No hay flashcards creadas en esta selección.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Suspendidas/ }).click();
  await expect(page.getByRole("button", { name: "Reintegrar flashcard", exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByRole("button", { name: "Lo reconocí", exact: true })).toHaveCount(0);
  const personal = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Pregunta personal", exact: true }) });
  await personal.getByRole("button", { name: "Reintegrar flashcard", exact: true }).click();
  await page.getByRole("button", { name: "Eje Clínico", exact: true }).click();
  await page.getByRole("button", { name: /^Suspendidas/ }).click();
  await expect(page.getByRole("button", { name: "Reintegrar flashcard", exact: true })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Reintegrar flashcard", exact: true }).click();
  await expect(
    page.getByText("No hay flashcards suspendidas en esta sección.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Creadas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta personal", exact: true })).toBeVisible();
  await page.getByText("Elegir un bloque", { exact: true }).click();
  await expect(page.getByRole("option", { name: /Creadas/ })).toBeAttached();
  const state = await snapshot(page);
  expect(state.suspended_cards).toEqual([]);
  expect(state.history).toHaveLength(0);
});

test("created cards enter subtests and suspension skips an unanswered subtest card", async ({
  page,
}) => {
  await page.goto("./#avance");
  await page.getByRole("button", { name: "Seleccionar todas", exact: true }).click();
  await page.getByRole("button", { name: /Empezar subtest/ }).click();
  await create(page, "Creada en subtest");
  await page.getByRole("button", { name: "Suspender flashcard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).history).toHaveLength(0);
  await page.getByRole("button", { name: "Terminar subtest", exact: true }).click();
  await page.getByRole("button", { name: "Volver a mi avance", exact: true }).click();
  await page.getByLabel("Espacio de estudio", { exact: true }).selectOption("creadas1");
  await page
    .getByRole("group", { name: "Tipo de pregunta", exact: true })
    .getByRole("button", { name: "Creadas", exact: true })
    .click();
  await page.getByRole("button", { name: "Seleccionar todas", exact: true }).click();
  await page.getByRole("button", { name: /Empezar subtest/ }).click();
  await expect(page.getByRole("heading", { name: "Creada en subtest", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Acerté", exact: true }).click();
  await expect(page.getByText("Respuesta correcta.", { exact: true })).toBeVisible();
});

test("library authoring without a plan fits a phone and supports Creadas-only plan setup", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await create(page, "Creada en biblioteca");
  await page.getByRole("button", { name: "Creadas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Creada en biblioteca", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Capa 1 creadas", exact: true }).click();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Creadas", { exact: false }).check();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Creada en biblioteca", exact: true }),
  ).toBeVisible();
});

test("creates a flashcard during a due-review session", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Otra vez/ }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true }),
  ).toBeVisible();
  const previous = await snapshot(page);
  const due = previous.progress["eje/01.01"].due_day;
  await page.clock.install({ time: new Date(`${due}T12:00:00Z`) });
  await page.reload();
  await page.getByRole("tab", { name: /^Repasos/ }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué diagnóstico corresponde a cada caso?", exact: true }),
  ).toBeVisible();
  await create(page, "Creada en repaso");
  const state = await snapshot(page);
  expect(state.history).toEqual(previous.history);
  expect(Object.values(state.created_cards ?? {})[0].source_card_id).toBe("eje/01.01");
});

test("a backup restores personal-card content, study history and suspension into an older profile", async ({
  page,
}) => {
  await start(page);
  const older = await snapshot(page);
  await create(page);
  await library(page);
  await page.getByRole("button", { name: "Creadas", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Lo reconocí", exact: true }).click();
  await expect(page.getByText(/Próximo repaso:/)).toBeVisible();
  await page.getByRole("button", { name: "Suspender flashcard", exact: true }).click();
  await expect(
    page.getByText("No hay flashcards creadas en esta selección.", { exact: true }),
  ).toBeVisible();
  const saved = await savedProfile(page);
  await page.getByRole("button", { name: "Hoy-capa 1", exact: true }).click();
  await page.getByRole("button", { name: "Copia de mi progreso", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar mi progreso", exact: true }).click();
  const backup = await downloaded;
  await page.getByLabel("Importar una copia").setInputFiles({
    name: "older.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "enarm-coach", state: older })),
  });
  await page.getByRole("button", { name: "Reemplazar con esta copia", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Copia de mi progreso", exact: true }).click();
  await page.getByLabel("Importar una copia").setInputFiles((await backup.path())!);
  await expect(page.getByText("Copia comprobada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reemplazar con esta copia", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const restored = await savedProfile(page);
  expect(restored.created_cards).toEqual(saved.created_cards);
  expect(restored.workspaces).toEqual(saved.workspaces);
});

test("a failed card creation in a subtest can retry without losing the draft", async ({ page }) => {
  await page.goto("./#avance");
  await page.getByRole("button", { name: "Seleccionar todas", exact: true }).click();
  await page.getByRole("button", { name: /Empezar subtest/ }).click();
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Borrador del subtest");
  await page.getByLabel("Reverso", { exact: true }).fill("Respuesta del borrador");
  let failed = false;
  await page.route("**/api/progress", (route) => {
    if (route.request().method() === "PUT" && !failed) {
      failed = true;
      return route.abort();
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Guardar flashcard", exact: true }).click();
  await expect(
    page.getByText("No se guardó la flashcard. Tu borrador sigue aquí.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reintentar guardado", exact: true }).click();
  await expect(page.getByText("Flashcard guardada en Creadas.", { exact: true })).toBeVisible();
  const state = await snapshot(page);
  expect(Object.values(state.created_cards ?? {}).map((c) => c.front)).toEqual([
    "Borrador del subtest",
  ]);
  expect(state.history).toHaveLength(0);
});

async function topicLibrary(page: Page) {
  const topics = ["alfa", "beta", "gamma"];
  const data = [
    {
      ...coachCards[0],
      back: topics.map((topic, i) => ({ title: topic, text: topic, topic_id: `01.01-0${i + 1}` })),
    },
    ...[2, 3, 4].flatMap((level) =>
      topics.map((topic, i) => ({
        ...coachCards.find((c) => c.level === level)!,
        id: `madre/${level}/01.01-0${i + 1}`,
        topic_id: `01.01-0${i + 1}`,
        context: `Tema ${topic}`,
      })),
    ),
  ];
  await page.route("**/study/sections/*.json*", (route) =>
    route.fulfill({
      json: {
        id: "01",
        title: "Sección de prueba",
        blocks: [{ id: "01.01", title: "Temas", topics: 3 }],
        cards: data,
      },
    }),
  );
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await page.getByRole("button", { name: "Patrones Madre", exact: true }).click();
}

test("changing levels keeps the topic when earlier cards are suspended", async ({ page }) => {
  await topicLibrary(page);
  await page.getByLabel("Nivel de Patrones Madre").selectOption("3");
  await page.getByRole("button", { name: "Suspender flashcard", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "Tema beta",
  );
  await page.getByLabel("Nivel de Patrones Madre").selectOption("2");
  await page.getByLabel("Nivel de Patrones Madre").selectOption("3");
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "Tema beta",
  );
});

test("management links skip suspended positions and explain a suspended destination", async ({
  page,
}) => {
  await topicLibrary(page);
  await page.getByLabel("Nivel de Patrones Madre").selectOption("4");
  await page.getByRole("button", { name: "Suspender flashcard", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "Tema beta",
  );
  await page.getByRole("button", { name: "Eje Clínico", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Ver manejo y variantes", exact: true }).nth(1).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "Tema beta",
  );
  await page.getByRole("button", { name: "Eje Clínico", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Ver manejo y variantes", exact: true }).first().click();
  await expect(
    page.getByRole("status").filter({ hasText: "Esta flashcard está suspendida." }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "pista alfa",
  );
});
