import { test, expect } from "@playwright/test";

test("plans the verified full course and opens its assigned cards", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", r => { if (r.url().includes("/study/sections/")) loaded.push(r.url()); });
  await page.goto("./");
  await expect(page.getByRole("region", { name: "Estimación del plan" })).toContainText("2,900 tarjetas");
  await expect(page.getByRole("button", { name: "Empezar mi plan", exact: true })).toBeEnabled();
  expect(loaded).toHaveLength(0);
  await page.getByRole("button", { name: "Empezar mi plan", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Primera vuelta" })).toHaveAttribute("aria-valuemax", "2900");
  expect(loaded).toHaveLength(1);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toBeVisible();
  await page.getByRole("button", { name: /^Bien/ }).click();
  await expect(page.getByRole("progressbar", { name: "Meta diaria" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("button", { name: "Mostrar respuesta", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("progressbar", { name: "Primera vuelta" })).toHaveAttribute("aria-valuenow", "1");
});
