import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

test("serves complete coverage and both verified Anki files", async ({ request }) => {
  const response = await request.get("study/manifest.json");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.review_status).toBe("cross-reviewed");
  expect(manifest.counts).toEqual({ sections: 34, blocks: 355, topic_occurrences: 730, cards: 2900, eje: 355, madre: 2545 });
  expect(manifest.book.pages).toBe(1150);
  expect(manifest.sections).toHaveLength(34);
  expect(manifest.groups).toHaveLength(355);
  const sections = await Promise.all(manifest.sections.map(async (section: { url: string; cards: number }) => {
    const result = await request.get(`study/${section.url}`);
    expect(result.ok()).toBe(true);
    const data = await result.json();
    expect(data.cards).toHaveLength(section.cards);
    expect(new Set(data.cards.map((c: { id: string }) => c.id)).size).toBe(section.cards);
    for (const card of data.cards) {
      expect(card.front.length).toBeGreaterThan(0);
      expect(card.back).toHaveLength(card.front.length);
      expect(card.sources.length).toBeGreaterThan(0);
    }
    return data;
  }));
  expect(sections.reduce((count, section) => count + section.cards.length, 0)).toBe(2900);
  for (const download of manifest.downloads) {
    const result = await request.get(`study/${download.url}`);
    expect(result.ok()).toBe(true);
    const body = await result.body();
    expect(body.length).toBe(download.bytes);
    expect(body.subarray(0, 2).toString()).toBe("PK");
    expect(createHash("sha256").update(body).digest("hex")).toBe(download.sha256);
  }
});

test("opens the explicit full library route and loads only the chosen section", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", request => { if (/\/study\/sections\//.test(request.url())) loaded.push(request.url()); });
  await page.goto("./#biblioteca");
  await expect(page.getByRole("heading", { name: "Estudia por contraste", exact: true })).toBeVisible();
  expect(loaded).toHaveLength(0);
  await page.getByRole("searchbox", { name: "Buscar síntoma o sección" }).fill("ginecologia");
  await page.getByRole("button", { name: /Ginecología/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  expect(loaded.length).toBeGreaterThan(0);
  expect(loaded.every(url => url.includes("/sections/14.json"))).toBe(true);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText("Amenorreas primarias");
  await page.getByRole("button", { name: "Patrones Madre", exact: true }).click();
  await page.getByLabel("Nivel de Patrones Madre").selectOption("4");
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText("Primera decisión");
});
