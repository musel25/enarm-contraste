import { test, expect, type Page } from "@playwright/test";
import { mockCoach } from "./coach-fixtures";

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
async function selectText(page: Page, selector: string) {
  await page.locator(selector).evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

test("creates a card from front and back excerpts without grading or advancing the source", async ({
  page,
  context,
}) => {
  await start(page);
  const question = page.getByRole("heading", {
    name: "¿Qué diagnóstico corresponde a cada caso?",
    exact: true,
  });
  await selectText(page, ".library-front .library-case-rows p");
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await page.getByRole("button", { name: "Usar en el frente", exact: true }).click();
  await expect(page.getByLabel("Frente", { exact: true })).toHaveValue(
    "Una persona tiene una pista alfa.",
  );
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await selectText(page, ".library-answer .library-answer-rows p");
  await page.getByRole("button", { name: "Usar en el reverso", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("¿Mi nueva pregunta?");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() =>
    navigator.clipboard.writeText("\nInformación pegada\nSegunda línea <b>texto</b>"),
  );
  const back = page.getByLabel("Reverso", { exact: true });
  await back.press("End");
  await back.press("ControlOrMeta+V");
  await expect(back).toHaveValue(
    "El mecanismo explica el hallazgo.\nInformación pegada\nSegunda línea <b>texto</b>",
  );
  await back.press("Tab");
  await page.keyboard.press("3");
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "Guardar flashcard", exact: true }).click();
  await expect(page.getByText("Flashcard guardada en Creadas.", { exact: true })).toBeVisible();
  await expect(question).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("a failed personal-card save keeps the draft and retries one creation", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Añadir flashcard", exact: true }).click();
  await page.getByLabel("Frente", { exact: true }).fill("Pregunta persistente");
  await page.getByLabel("Reverso", { exact: true }).fill("Respuesta persistente");
  let failed = false;
  await page.route("**/api/progress", async (route) => {
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
  await expect(page.getByLabel("Frente", { exact: true })).toHaveValue("Pregunta persistente");
  await page.getByRole("button", { name: "Reintentar guardado", exact: true }).click();
  await expect(page.getByText("Flashcard guardada en Creadas.", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("suspending the current library card advances without an answer", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "Suspender flashcard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "¿Qué patrón organiza este problema?", exact: true }),
  ).toBeVisible();
});
