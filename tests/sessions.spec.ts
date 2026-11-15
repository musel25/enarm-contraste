import { createHash } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { coachCards, coachIndex, coachManifest, mockCoach, savedWorkspace } from "./coach-fixtures";

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

test("a new browser asks for an account and another browser opens the same progress", async ({
  page,
  browser,
}) => {
  const user = `prueba-${Date.now().toString(36)}`;
  await page.route("**/study/**", (route) => route.fallback());
  await mockCoach(page);
  await page.addInitScript(() => localStorage.removeItem("enarm-contraste-guest"));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Entra para seguir donde te quedaste." }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Crear cuenta" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill(user);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
  await page.getByLabel("Repite la contraseña", { exact: true }).fill("clave-segura-1");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await answer(page);
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await expect(page.getByText(`Progreso protegido en el VPS · ${user}`)).toBeVisible();

  const context = await browser.newContext({ timezoneId: "UTC", reducedMotion: "reduce" });
  try {
    const phone = await context.newPage();
    await mockCoach(phone);
    await phone.addInitScript(() => localStorage.removeItem("enarm-contraste-guest"));
    await phone.goto("./");
    await phone.getByLabel("Usuario", { exact: true }).fill(user);
    await phone.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
    await phone.getByRole("button", { name: "Entrar" }).click();
    await expect(phone.getByRole("alert")).toContainText("Usuario o contraseña incorrectos");
    await phone.getByLabel("Contraseña", { exact: true }).fill("clave-segura-1");
    await phone.getByRole("button", { name: "Entrar" }).click();
    await expect(phone.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
  } finally {
    await context.close();
  }
});

test("an existing device links a username without losing progress", async ({ page }) => {
  const user = `vinculo-${Date.now().toString(36)}`;
  await mockCoach(page);
  await start(page);
  await answer(page);
  await page.getByRole("button", { name: "Crear usuario y contraseña" }).click();
  await page.getByLabel("Usuario", { exact: true }).fill(user);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-2");
  await page.getByLabel("Repite la contraseña", { exact: true }).fill("clave-segura-2");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByText(`Entraste como ${user}`)).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
});

test("new topics and reviews are separate sessions and a first reading is not an error", async ({
  page,
}) => {
  await mockCoach(page);
  await start(page);
  await expect(page.getByRole("tab", { name: /Temas nuevos/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
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
  await answer(page);
  await answer(page);
  await expect(page.getByText("2 tarjetas hoy")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terminaste 2 tarjetas." })).toBeVisible();
  await page.getByRole("button", { name: /Otra sesión de 2/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByText(/Sesión de temas nuevos · 0 de 2/)).toBeVisible();
});

test("a rest day empties today's goal and the calendar shows each day", async ({ page }) => {
  await mockCoach(page);
  await start(page);
  await page
    .getByRole("group", { name: "Carga de hoy" })
    .getByRole("button", { name: "Descanso" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hoy descansas. También es parte del plan." }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuemax",
    "1",
  );
  await page.getByRole("button", { name: "Estudiar de todos modos" }).click();
  await answer(page);
  await page
    .getByRole("group", { name: "Actividad de los últimos 30 días" })
    .getByRole("button")
    .last()
    .click();
  await expect(page.getByRole("region", { name: /Progreso del/ })).toContainText("Respuestas1");
  await page
    .getByRole("group", { name: "Actividad de los últimos 30 días" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByRole("region", { name: /Progreso del/ })).toContainText(
    "No estudiaste este día",
  );
});

test("question tags reach Mi avance and the subtest filters by question type", async ({ page }) => {
  await mockCoach(page);
  await start(page);
  await page.getByRole("button", { name: "☆ Profundizar" }).click();
  await expect(page.getByRole("button", { name: "★ Profundizar" })).toBeVisible();
  await page
    .getByRole("group", { name: "Orden de la pregunta" })
    .getByRole("button", { name: "2º" })
    .click();
  await expect(
    page.getByRole("group", { name: "Orden de la pregunta" }).getByRole("button", { name: "2º" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mi avance", exact: true }).click();
  await expect(page.locator(".learning-deepen")).toContainText("Eje Clínico · 01.01");
  await page.getByLabel("Orden de la pregunta").selectOption("2");
  await expect(page.getByText("1 preguntas coinciden con tu selección.")).toBeVisible();
  await page.getByLabel("Orden de la pregunta").selectOption("all");
  await page
    .getByRole("group", { name: "Tipo de pregunta" })
    .getByRole("button", { name: "Decir el diagnóstico" })
    .click();
  await page.getByRole("button", { name: "Seleccionar todas", exact: true }).click();
  await page.getByRole("button", { name: /Empezar subtest/ }).click();
  await expect(page.getByText("Pregunta 1 de 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pregunta del nivel 2" })).toBeVisible();
});

test("the corner timer alerts when the time is over", async ({ page }) => {
  await mockCoach(page);
  await start(page);
  const plan = (await savedWorkspace(page)).plan!;
  await page.addInitScript(
    (id) =>
      localStorage.setItem(
        `enarm-contraste-timer:capa1:${id}`,
        JSON.stringify({
          mode: "study",
          target: 60,
          started: Date.now() - 61_000,
          paused_at: null,
          paused_ms: 0,
          alerted: false,
        }),
      ),
    plan.id,
  );
  await page.reload();
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

test("a session can be limited to chosen sections and to one format", async ({ page }) => {
  await mockCoach(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué diagnóstico corresponde a cada caso?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page
    .getByRole("group", { name: "Formato de la sesión" })
    .getByRole("button", { name: "Patrones madre" })
    .click();
  await page
    .getByRole("group", { name: "Secciones de la sesión" })
    .getByRole("button", { name: "Sección de prueba" })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Bloques de la sesión" })
      .getByRole("button", { name: /01\.01/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Solo:" })).toContainText(
    "Sección de prueba · Patrones madre",
  );
  await expect(page.getByRole("heading", { name: "Pregunta del nivel 2" })).toBeVisible();
  const newTab = page.getByRole("tab", { name: /Temas nuevos/ });
  await expect(newTab).toContainText("Faltan 2 de 2 para terminar tu selección");
  await answer(page);
  await expect(newTab).toContainText("Faltan 1 de 2 para terminar tu selección");
  await answer(page);
  await expect(
    page.getByRole("heading", { name: /No quedan tarjetas .* en tu selección\./ }),
  ).toBeVisible();
  await expect(newTab).toContainText("✓ Terminaste tu selección");
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Solo:" })).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtro" }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué diagnóstico corresponde a cada caso?" }),
  ).toBeVisible();
});

test("a session can add the electrolyte section to an older layer-one plan", async ({ page }) => {
  await mockCoach(page);
  const electrolyteCard = {
    ...coachCards[0],
    id: "scenario/35.01-volume-ancla",
    family: "madre" as const,
    section_id: "35",
    block_id: "35.01",
    prompt: "¿Qué cambio de volumen explica este caso?",
  };
  const index = {
    ...coachIndex,
    cards: [
      ...coachIndex.cards,
      {
        ...coachIndex.cards[0],
        id: electrolyteCard.id,
        family: "madre" as const,
        section_id: "35",
        block_id: "35.01",
        order: 5,
      },
    ],
  };
  const body = JSON.stringify(index);
  await page.route("**/study/manifest.json", (route) =>
    route.fulfill({
      json: {
        ...coachManifest,
        counts: { ...coachManifest.counts, sections: 2, blocks: 2, cards: 6, madre: 5 },
        sections: [
          ...coachManifest.sections,
          {
            id: "35",
            title: "Trastornos hidroelectrolíticos",
            blocks: 1,
            cards: 1,
            url: "sections/35.json",
          },
        ],
        planner: {
          ...coachManifest.planner,
          cards: 6,
          sha256: createHash("sha256").update(body).digest("hex"),
        },
      },
    }),
  );
  await page.route("**/study/index.json*", (route) =>
    route.fulfill({ body, contentType: "application/json" }),
  );
  await page.route("**/study/sections/35.json*", (route) =>
    route.fulfill({
      json: {
        id: "35",
        title: "Trastornos hidroelectrolíticos",
        blocks: [{ id: "35.01", title: "Volumen y tonicidad", topics: 1 }],
        cards: [electrolyteCard],
      },
    }),
  );
  await page.goto("./#hoy-capa-1");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("20");
  await page.getByRole("checkbox", { name: /Patrones Madre/ }).uncheck();
  await page.getByText("Elegir temas").click();
  await page.getByRole("checkbox", { name: "Trastornos hidroelectrolíticos" }).uncheck();
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  expect((await savedWorkspace(page)).plan?.section_ids).toEqual(["01"]);

  await page.getByRole("button", { name: "Personalizar" }).click();
  const electrolyte = page
    .getByRole("group", { name: "Secciones de la sesión" })
    .getByRole("button", { name: "Trastornos hidroelectrolíticos" });
  await expect(electrolyte).toBeVisible();
  await electrolyte.click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Solo:" })).toContainText(
    "Trastornos hidroelectrolíticos",
  );
  await expect(page.getByRole("heading", { name: electrolyteCard.prompt })).toBeVisible();
  expect((await savedWorkspace(page)).plan?.section_ids).toEqual(["01", "35"]);
  expect((await savedWorkspace(page)).plan?.families).toEqual(["eje", "madre"]);
});

test("a layer-one session can select a named mother pattern", async ({ page }) => {
  await mockCoach(page);
  const secondPattern = [2, 3].map((level) => ({
    ...coachCards[level],
    id: `madre/${level}/01.01-02`,
    topic_id: "01.01-02",
    back: [{ title: "Patrón beta", text: "Un patrón diferente." }],
  }));
  const index = {
    ...coachIndex,
    cards: [
      ...coachIndex.cards,
      ...secondPattern.map((card, position) => ({
        ...coachIndex.cards[2 + position],
        id: card.id,
        order: 5 + position,
      })),
    ],
  };
  const body = JSON.stringify(index);
  await page.route("**/study/manifest.json", (route) =>
    route.fulfill({
      json: {
        ...coachManifest,
        counts: { ...coachManifest.counts, cards: 7, madre: 6, topic_occurrences: 2 },
        sections: [{ ...coachManifest.sections[0], cards: 7 }],
        planner: {
          ...coachManifest.planner,
          cards: 7,
          sha256: createHash("sha256").update(body).digest("hex"),
        },
      },
    }),
  );
  await page.route("**/study/index.json*", (route) =>
    route.fulfill({ body, contentType: "application/json" }),
  );
  await page.route("**/study/sections/01.json*", (route) =>
    route.fulfill({
      json: {
        id: "01",
        title: "Sección de prueba",
        blocks: [{ id: "01.01", title: "Un problema", topics: 2 }],
        cards: [...coachCards, ...secondPattern],
      },
    }),
  );
  await page.goto("./#hoy-capa-1");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("checkbox", { name: /Patrones Madre/ }).uncheck();
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page
    .getByRole("group", { name: "Secciones de la sesión" })
    .getByRole("button", { name: "Sección de prueba" })
    .click();
  const pattern = page
    .getByRole("group", { name: "Patrones madre específicos" })
    .getByRole("button", { name: /Respuesta del nivel 2/ });
  await expect(pattern).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Patrones madre específicos" })
      .getByRole("button", { name: /Patrón beta/ }),
  ).toBeVisible();
  await pattern.click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pregunta del nivel 2" })).toBeVisible();
  await answer(page);
  await page.getByRole("button", { name: "Seguir con temas nuevos de tu selección" }).click();
  await expect(page.getByRole("heading", { name: "Pregunta del nivel 3" })).toBeVisible();
  expect((await savedWorkspace(page)).preferences.session_scope?.card_ids).toEqual([
    "madre/2/01.01-01",
    "madre/3/01.01-01",
  ]);
  expect((await savedWorkspace(page)).plan?.families).toEqual(["eje", "madre"]);
});
