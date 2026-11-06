import { expect, test } from "@playwright/test";
import { asGuest, savedProfile } from "./coach-fixtures";

test.use({ timezoneId: "UTC", reducedMotion: "reduce" });

test("the reviewed electrolyte section opens in each real library layer", async ({
  page,
}, info) => {
  await asGuest(page);
  for (const space of ["capa1", "capa2"]) {
    await page.goto(`./#biblioteca?space=${space}`);
    await page.getByRole("searchbox", { name: "Buscar síntoma o sección" }).fill("hidroelectrol");
    await page.getByRole("button", { name: /Trastornos hidroelectrolíticos/ }).click();
    await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
    await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
    await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText(
      "Primera acción",
    );
    await page.screenshot({ path: info.outputPath(`${space}-desktop.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".skip-link")).not.toBeInViewport();
  await page.screenshot({ path: info.outputPath("capa2-phone.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const profile = await savedProfile(page);
  expect(
    Object.values(profile.workspaces).reduce((total, part) => total + part.history.length, 0),
  ).toBe(0);
});

test("a real layer-two card creates a personal card in its own daily space", async ({
  page,
}, info) => {
  await asGuest(page);
  await page.goto("./#hoy-capa-2");
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("capa2-today.png"), fullPage: true });
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Pregunta personal de prueba de capa 2");
  await page.getByLabel("Reverso", { exact: true }).fill("Respuesta personal de prueba");
  await page.getByRole("button", { name: "Guardar flashcard", exact: true }).click();
  await expect(page.getByText("Flashcard guardada en Creadas.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Capa 2 creadas", exact: true }).click();
  await page.getByRole("button", { name: "Tiempo diario", exact: true }).click();
  await page.getByLabel("Minutos por día", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pregunta personal de prueba de capa 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect
    .poll(async () => (await savedProfile(page)).workspaces.creadas2.history.length)
    .toBe(1);
  const profile = await savedProfile(page);
  expect(profile.workspaces.capa2.history).toHaveLength(0);
  expect(profile.workspaces.capa1.history).toHaveLength(0);
  const card = Object.values(profile.created_cards)[0];
  expect(card.layer).toBe(2);
  expect(card.source_card_id.startsWith("capa2/")).toBe(true);
});
