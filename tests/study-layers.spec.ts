import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { coachCards, coachIndex, coachManifest, mockCoach } from "./coach-fixtures";
import type { StudyProfile } from "../app/src/coach/types";

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });
async function fixture(page: Page) {
  await mockCoach(page);
  const cards = coachCards.map((card, i) => ({
    ...card,
    id: `capa2/${card.id}`,
    prompt: `Capa 2: ${card.prompt}`,
    objective: i === 0 ? ("gravedad" as const) : ("variante" as const),
  }));
  const index = {
    ...coachIndex,
    content_sha256: "layer-two-fixture",
    cards: coachIndex.cards.map((card, i) => ({
      ...card,
      id: `capa2/${card.id}`,
      objective: i === 0 ? ("gravedad" as const) : ("variante" as const),
    })),
  };
  const body = JSON.stringify(index);
  const manifest = {
    ...coachManifest,
    content_sha256: index.content_sha256,
    planner: { ...coachManifest.planner, sha256: createHash("sha256").update(body).digest("hex") },
  };
  await page.route("**/study/layers/capa2/manifest.json", (route) =>
    route.fulfill({ json: manifest }),
  );
  await page.route("**/study/layers/capa2/index.json*", (route) =>
    route.fulfill({ body, contentType: "application/json" }),
  );
  await page.route("**/study/layers/capa2/sections/*.json*", (route) =>
    route.fulfill({
      json: {
        id: "01",
        title: "Sección de prueba",
        blocks: [{ id: "01.01", title: "Un problema", topics: 1 }],
        cards,
      },
    }),
  );
}
async function startPlan(page: Page) {
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
}
async function create(page: Page, front: string) {
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill(front);
  await page.getByLabel("Reverso", { exact: true }).fill("Mi respuesta");
  await page.getByRole("button", { name: "Guardar flashcard", exact: true }).click();
  await expect(page.getByText("Flashcard guardada en Creadas.", { exact: true })).toBeVisible();
}
async function saved(page: Page): Promise<StudyProfile> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("enarm-coach-v1", 1);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction("state").objectStore("state").get("current");
          request.onsuccess = () => {
            db.close();
            resolve(request.result);
          };
          request.onerror = reject;
        };
        open.onerror = reject;
      }),
  );
}

test("four main tabs isolate plans, answers and created cards across reloads", async ({ page }) => {
  await fixture(page);
  await page.goto("./#hoy");
  for (const name of ["Hoy-capa 1", "Hoy-capa 2", "Capa 1 creadas", "Capa 2 creadas"])
    await expect(
      page
        .getByRole("navigation", { name: "Ayuda de estudio" })
        .getByRole("button", { name, exact: true }),
    ).toBeVisible();
  await startPlan(page);
  await create(page, "Creada en capa 1");
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await page.getByRole("button", { name: "Hoy-capa 2", exact: true }).click();
  await startPlan(page);
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText("Capa 2:");
  await create(page, "Creada en capa 2");
  await page.getByRole("button", { name: "Capa 2 creadas", exact: true }).click();
  await startPlan(page);
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "Creada en capa 2",
  );
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await page.getByRole("button", { name: "Capa 1 creadas", exact: true }).click();
  await startPlan(page);
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "Creada en capa 1",
  );
  await page.getByRole("button", { name: "Hoy-capa 1", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText(
    "Una función cambia.",
  );
  const profile = await saved(page);
  expect(profile.version).toBe(2);
  expect(profile.workspaces.capa1.history).toHaveLength(1);
  expect(profile.workspaces.capa2.history).toHaveLength(0);
  expect(profile.workspaces.creadas1.history).toHaveLength(0);
  expect(profile.workspaces.creadas2.history).toHaveLength(1);
  expect(
    Object.values(profile.created_cards)
      .map((card) => card.layer)
      .sort(),
  ).toEqual([1, 2]);
});

test("library and progress select the same space and navigation fits a phone", async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto("./#hoy-capa-2");
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await expect(page.getByLabel("Espacio de estudio", { exact: true })).toHaveValue("capa2");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText("Capa 2:");
  await page.getByRole("button", { name: "Mi avance", exact: true }).click();
  await expect(page.getByLabel("Espacio de estudio", { exact: true })).toHaveValue("capa2");
  await page.getByLabel("Espacio de estudio", { exact: true }).selectOption("creadas1");
  await expect(page.getByLabel("Espacio de estudio", { exact: true })).toHaveValue("creadas1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a section with only individual scenarios opens its available format and level", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/study/sections/*.json*", (route) =>
    route.fulfill({
      json: {
        id: "01",
        title: "Sección de prueba",
        blocks: [{ id: "01.01", title: "Un problema", topics: 1 }],
        cards: coachCards.filter((card) => card.family === "madre" && card.level === 2),
      },
    }),
  );
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(
    page.getByRole("heading", { name: "Pregunta del nivel 2", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nivel de Patrones Madre")).toHaveValue("2");
});

test("a clinical objective is saved only in the selected daily space", async ({ page }) => {
  await fixture(page);
  await page.goto("./#hoy-capa-2");
  await startPlan(page);
  await page.getByRole("button", { name: "Personalizar", exact: true }).click();
  await page
    .getByRole("group", { name: "Objetivo de la sesión" })
    .getByRole("button", { name: "Gravedad", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).workspaces.capa2.preferences.session_scope?.objectives)
    .toEqual(["gravedad"]);
  expect(
    (await saved(page)).workspaces.capa1.preferences.session_scope?.objectives,
  ).toBeUndefined();
  await page.reload();
  await page.getByRole("button", { name: "Personalizar", exact: true }).click();
  await expect(
    page
      .getByRole("group", { name: "Objetivo de la sesión" })
      .getByRole("button", { name: "Gravedad", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
