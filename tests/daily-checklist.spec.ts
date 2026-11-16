import { expect, test } from "@playwright/test";
import { mockCoach } from "./coach-fixtures";

test.use({ timezoneId: "UTC" });

test.beforeEach(async ({ page }) => {
  await mockCoach(page);
});

test("records activities for today and yesterday, and keeps completion after reload", async ({
  page,
}) => {
  await page.goto("./#daily-checklist");
  await expect(page.getByRole("heading", { name: "Daily Checklist" })).toBeVisible();
  const day = page.getByLabel("Fecha de la lista");
  const today = await day.inputValue();
  await page.getByLabel("Nueva actividad").fill("Repasar cardiología");
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(page.getByText("Repasar cardiología")).toBeVisible();
  await page.getByRole("checkbox", { name: "Repasar cardiología" }).click();
  await expect(page.getByText("1 de 1 terminadas")).toBeVisible();
  await page.getByRole("button", { name: "Ayer" }).click();
  const yesterday = await day.inputValue();
  expect(yesterday).not.toBe(today);
  await page.getByLabel("Nueva actividad").fill("Resolver 10 casos");
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(page.getByRole("checkbox", { name: "Resolver 10 casos" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Resolver 10 casos")).toBeVisible();
  await day.fill(today);
  await expect(page.getByRole("checkbox", { name: "Repasar cardiología" })).toBeChecked();
  await day.fill(yesterday);
  await page.getByRole("checkbox", { name: "Resolver 10 casos" }).click();
  await expect(page.getByRole("checkbox", { name: "Resolver 10 casos" })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Resolver 10 casos" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Resolver 10 casos" }).click();
  await expect(page.getByText("0 de 1 terminadas")).toBeVisible();
});

test("a failed save keeps the entered activity and does not show it as saved", async ({ page }) => {
  await page.goto("./#daily-checklist");
  await expect(page.getByRole("heading", { name: "Daily Checklist" })).toBeVisible();
  await expect(page.getByLabel("Nueva actividad")).toBeEnabled();
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 503, json: { error: "Error de prueba." } });
      await page.unroute("**/api/progress");
      return;
    }
    await route.continue();
  });
  await page.getByLabel("Nueva actividad").fill("Leer el tema");
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(page.getByRole("alert")).toContainText("Error de prueba");
  await expect(page.getByLabel("Nueva actividad")).toHaveValue("Leer el tema");
  await expect(page.getByRole("checkbox", { name: "Leer el tema" })).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(page.getByRole("checkbox", { name: "Leer el tema" })).toBeVisible();
});

test("the checklist tab fits a phone and can remove an activity", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto("./");
  await page.getByRole("button", { name: "Daily Checklist" }).click();
  await expect(page.getByRole("heading", { name: "Daily Checklist" })).toBeVisible();
  await page.getByLabel("Nueva actividad").fill("Leer el tema");
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(page.getByRole("checkbox", { name: "Leer el tema" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Eliminar Leer el tema" }).click();
  await expect(page.getByRole("checkbox", { name: "Leer el tema" })).toHaveCount(0);
});

test("an empty or invalid date cannot replace the selected day", async ({ page }) => {
  await page.goto("./#daily-checklist?day=2026-02-30");
  const day = page.getByLabel("Fecha de la lista");
  const today = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  await expect(day).toHaveValue(today);
  await day.fill("");
  await expect(day).toHaveValue(today);
});
