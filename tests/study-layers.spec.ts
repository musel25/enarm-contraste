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

test("choosing a block opens its available format instead of an empty default", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/study/sections/*.json*", (route) =>
    route.fulfill({
      json: {
        id: "01",
        title: "Sección de prueba",
        blocks: [
          { id: "01.01", title: "Comparar", topics: 1 },
          { id: "01.02", title: "Decidir", topics: 1 },
        ],
        cards: [
          coachCards[0],
          { ...coachCards[4], id: "madre/4/01.02-01", block_id: "01.02", topic_id: "01.02-01" },
        ],
      },
    }),
  );
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await page.getByText("Elegir un bloque", { exact: true }).click();
  await page.getByRole("combobox", { name: "Bloque", exact: true }).selectOption("01.02");
  await expect(
    page.getByRole("heading", { name: "Pregunta del nivel 4", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Nivel de Patrones Madre")).toHaveValue("4");
});

test("a library subtest link retains its source study space", async ({ page }) => {
  await fixture(page);
  await page.goto("./#biblioteca?space=capa2");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await page.getByRole("link", { name: "Crear subtest de este bloque", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mi avance", exact: true })).toBeVisible();
  await expect(page.getByLabel("Espacio de estudio", { exact: true })).toHaveValue("capa2");
});

test("session limits and logged sessions belong to the space that answered", async ({ page }) => {
  await fixture(page);
  await page.goto("./#hoy-capa-2");
  await startPlan(page);
  await page.getByRole("button", { name: "Personalizar", exact: true }).click();
  await page.getByLabel("Tarjetas por sesión").fill("1");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Hoy-capa 1", exact: true }).click();
  await startPlan(page);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await page.getByRole("button", { name: "Hoy-capa 2", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await page.getByRole("tab", { name: /Repasos/ }).click();
  expect((await saved(page)).workspaces.capa2.sessions ?? []).toHaveLength(0);
  await page.getByRole("button", { name: "Hoy-capa 1", exact: true }).click();
  await expect(page.getByText(/Sesión de temas nuevos · 1 tarjeta/)).toBeVisible();
  await page.getByRole("tab", { name: /Repasos/ }).click();
  await expect.poll(async () => (await saved(page)).workspaces.capa1.sessions?.length).toBe(1);
  expect((await saved(page)).workspaces.capa1.sessions![0].cards).toBe(1);
});

test("timers and breaks stay in their daily space after switches and reloads", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-06T12:00:00Z") });
  await fixture(page);
  await page.goto("./#hoy-capa-1");
  await startPlan(page);
  await page.getByRole("button", { name: /Cronometrar sesión$/ }).click();
  await page.getByRole("button", { name: "Hoy-capa 2", exact: true }).click();
  await startPlan(page);
  await expect(page.getByRole("complementary", { name: "Temporizador de sesión" })).toHaveCount(0);
  await page.getByRole("button", { name: "☕ Descanso", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Estás en descanso.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hoy-capa 1", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Temporizador de sesión" })).toBeVisible();
  await page.getByRole("button", { name: "Hoy-capa 2", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Estás en descanso.", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(6000);
  await page.getByRole("button", { name: "Volver a estudiar", exact: true }).click();
  await expect.poll(async () => (await saved(page)).workspaces.capa2.sessions?.length).toBe(1);
  expect((await saved(page)).workspaces.capa2.sessions![0].kind).toBe("break");
  expect((await saved(page)).workspaces.capa1.sessions ?? []).toHaveLength(0);
});

test("legacy mixed local session values remain preserved without assigning a new space", async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "enarm-contraste-session",
      JSON.stringify({
        id: "mixed-legacy-session",
        kind: "new",
        day: new Date().toISOString().slice(0, 10),
        started: Date.now(),
        answered: 47,
        active: 300,
      }),
    );
    for (const mode of ["timer", "break"])
      localStorage.setItem(
        `enarm-contraste-${mode}`,
        JSON.stringify({
          mode: mode === "timer" ? "study" : "break",
          target: 300,
          started: Date.now(),
          paused_at: null,
          paused_ms: 0,
          alerted: false,
        }),
      );
  });
  await page.goto("./#hoy-capa-1");
  await startPlan(page);
  await expect(page.getByText(/Sesión de temas nuevos · 0 tarjetas/)).toBeVisible();
  await expect(page.getByRole("complementary", { name: /Temporizador/ })).toHaveCount(0);
  const preserved = await page.evaluate(() =>
    ["session", "timer", "break"].map((key) => localStorage.getItem(`enarm-contraste-${key}`)),
  );
  expect(preserved.every((value) => value !== null)).toBe(true);
  await page.getByRole("tab", { name: /Repasos/ }).click();
  expect((await saved(page)).workspaces.capa1.sessions ?? []).toHaveLength(0);
});

for (const space of ["capa1", "capa2"]) {
  test(`${space} rejects a section payload from the other clinical layer`, async ({ page }) => {
    await fixture(page);
    const path = space === "capa2" ? "layers/capa2/" : "";
    const wrongCards = coachCards.map((card) => ({
      ...card,
      id: space === "capa1" ? `capa2/${card.id}` : card.id,
    }));
    await page.route(`**/study/${path}sections/*.json*`, (route) =>
      route.fulfill({
        json: {
          id: "01",
          title: "Sección de prueba",
          blocks: [{ id: "01.01", title: "Un problema", topics: 1 }],
          cards: wrongCards,
        },
      }),
    );
    await page.goto(`./#biblioteca?space=${space}`);
    await page.getByRole("button", { name: /Sección de prueba/ }).click();
    await expect(page.getByRole("alert")).toContainText("No se pudo cargar el contenido.");
    await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toHaveCount(0);
  });
}

test("a native profile backup rejects an invented source in an existing section", async ({
  page,
}) => {
  const { emptyState } = await import("../app/src/coach/engine");
  const { migrateProfile } = await import("../app/src/coach/profile");
  const candidate = migrateProfile(emptyState());
  const id = "created/6a9121c5-fc78-453b-90a7-d265eed8a90e";
  candidate.created_cards[id] = {
    id,
    layer: 1,
    section_id: "01",
    source_card_id: "eje/01.99",
    source_block_id: "01.99",
    front: "Pregunta",
    back: "Respuesta",
    created_at: "2026-11-06T12:00:00.000Z",
  };
  await fixture(page);
  await page.goto("./#hoy-capa-1");
  await page
    .getByRole("button", { name: "Ya tengo una copia de mi progreso", exact: true })
    .click();
  await page.getByLabel("Importar una copia").setInputFiles({
    name: "invented-origin.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "enarm-coach", state: candidate })),
  });
  await expect(page.getByRole("alert")).toContainText("origen");
  await expect(page.getByText("Copia comprobada", { exact: true })).toHaveCount(0);
  expect(Object.keys((await saved(page)).created_cards)).toHaveLength(0);
});
