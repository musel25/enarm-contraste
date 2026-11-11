import { test, expect, type Page } from "@playwright/test";
import { coachCards, coachManifest, mockCoach, savedWorkspace } from "./coach-fixtures";

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
async function create(page: Page) {
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Pregunta personal");
  await page.getByLabel("Reverso", { exact: true }).fill("Respuesta personal");
  await page.getByRole("button", { name: "Guardar flashcard", exact: true }).click();
  await expect(page.getByText("Flashcard guardada en Creadas.", { exact: true })).toBeVisible();
  const state = await savedWorkspace(page, "creadas1");
  return Object.keys(state.created_cards ?? {})[0];
}
async function creadas(page: Page, section = /Sección de prueba/) {
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("button", { name: section }).click();
  await page.getByRole("button", { name: "Creadas", exact: true }).click();
}

test("editing a created card keeps its ID, progress and undo in study and Creadas", async ({
  page,
}) => {
  await start(page);
  const id = await create(page);
  await page.getByRole("button", { name: "Capa 1 creadas", exact: true }).click();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta personal", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Editar flashcard", exact: true }).click();
  const form = page.getByRole("form", { name: "Editar flashcard", exact: true });
  await expect(form.getByLabel("Frente", { exact: true })).toHaveValue("Pregunta personal");
  await expect(form.getByLabel("Sección de la flashcard")).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Guardar cambios", exact: true })).toBeDisabled();
  await form.getByLabel("Frente", { exact: true }).fill("Pregunta editada");
  await form.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByText("Cambios guardados.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pregunta editada", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true }),
  ).toBeVisible();
  const rated = await savedWorkspace(page, "creadas1");
  expect(rated.history.map((attempt) => attempt.card_id)).toEqual([id]);
  await page.getByRole("button", { name: "Deshacer última respuesta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta editada", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tu meta de hoy está completa.", exact: true }),
  ).toBeVisible();
  const answered = await savedWorkspace(page, "creadas1");
  expect(answered.history.map((attempt) => attempt.card_id)).toEqual([id]);
  expect(Object.keys(answered.progress)).toEqual([id]);

  await creadas(page);
  await expect(page.getByRole("heading", { name: "Pregunta editada", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar flashcard", exact: true }).click();
  await page.getByLabel("Reverso", { exact: true }).fill("Respuesta editada\n<b>literal</b>");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByText("Cambios guardados.", { exact: true })).toBeVisible();
  await page.reload();
  await creadas(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText(
    "<b>literal</b>",
  );
  const state = await savedWorkspace(page, "creadas1");
  expect(Object.keys(state.created_cards ?? {})).toEqual([id]);
  expect(state.created_cards?.[id]).toMatchObject({
    id,
    section_id: "01",
    source_card_id: "eje/01.01",
    front: "Pregunta editada",
    back: "Respuesta editada\n<b>literal</b>",
  });
  expect(state.progress).toEqual(answered.progress);
  expect(state.history).toEqual(answered.history);
});

test("a failed edit keeps the draft and the retry saves the same card once", async ({ page }) => {
  await start(page);
  const id = await create(page);
  await creadas(page);
  await page.getByRole("button", { name: "Editar flashcard", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Pregunta reintentada");
  let interrupted = false;
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      expect(Object.keys(body.state.created_cards)).toEqual([id]);
      expect(body.state.created_cards[id].front).toBe("Pregunta reintentada");
      if (!interrupted) {
        interrupted = true;
        await route.fetch();
        return route.abort();
      }
    }
    return route.continue();
  });
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(
    page.getByText("No se guardaron los cambios. Tu borrador sigue aquí.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Frente", { exact: true })).toHaveValue("Pregunta reintentada");
  await page.getByRole("button", { name: "Reintentar guardado", exact: true }).click();
  await expect(page.getByText("Cambios guardados.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pregunta reintentada", exact: true }),
  ).toBeVisible();
  const state = await savedWorkspace(page, "creadas1");
  expect(state.created_cards?.[id]?.front).toBe("Pregunta reintentada");
});

test("a new card can be saved in another section of the layer", async ({ page }) => {
  const second = {
    id: "02",
    title: "Segunda sección",
    blocks: [{ id: "02.01", title: "Otro problema", topics: 1 }],
    cards: [{ ...coachCards[0], id: "eje/02.01", section_id: "02", block_id: "02.01" }],
  };
  await page.route("**/study/manifest.json", (route) =>
    route.fulfill({
      json: {
        ...coachManifest,
        sections: [
          ...coachManifest.sections,
          { id: "02", title: second.title, blocks: 1, cards: 1, url: "sections/02.json" },
        ],
      },
    }),
  );
  await page.route("**/study/sections/02.json*", (route) => route.fulfill({ json: second }));
  await start(page);
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  const section = page.getByLabel("Sección de la flashcard");
  await expect(section).toHaveValue("01");
  await expect(section.locator("option")).toHaveText([
    "01 · Sección de prueba",
    "02 · Segunda sección",
  ]);
  await section.selectOption("02");
  await expect(page.getByText("Segunda sección · Creadas", { exact: true })).toBeVisible();
  await page.getByLabel("Frente", { exact: true }).fill("Pregunta en otra sección");
  await page.getByLabel("Reverso", { exact: true }).fill("Respuesta");
  await page.getByRole("button", { name: "Guardar flashcard", exact: true }).click();
  await expect(
    page.getByText("Flashcard guardada en Creadas · Segunda sección.", { exact: true }),
  ).toBeVisible();
  const state = await savedWorkspace(page, "creadas1");
  expect(Object.values(state.created_cards ?? {})).toMatchObject([
    { section_id: "02", source_card_id: "eje/01.01", source_block_id: "01.01", layer: 1 },
  ]);
  await creadas(page);
  await expect(
    page.getByText("No hay flashcards creadas en esta selección.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "‹ Todas las secciones", exact: true }).click();
  await page.getByRole("button", { name: /Segunda sección/ }).click();
  await page.getByRole("button", { name: "Creadas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pregunta en otra sección", exact: true }),
  ).toBeVisible();
});
