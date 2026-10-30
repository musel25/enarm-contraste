import { test, expect, type Page } from "@playwright/test";

const sources = [{ label: "Libro.pdf", pages: [1] }];
const base = { section_id: "01", block_id: "01.01", context: "Un mismo síntoma tiene dos explicaciones.", sources };
const cards = [
  { ...base, id: "eje/01.01", family: "eje", level: 0, prompt: "¿Qué diagnóstico corresponde a cada caso?", front: [{ text: "Caso con pista alfa.", highlight: "pista alfa" }, { text: "Caso con pista beta.", highlight: "pista beta" }], back: [{ title: "Diagnóstico A", text: "Mecanismo A", discriminator: "pista alfa", action: "Acción A", reason: "Razón A" }, { title: "Diagnóstico B", text: "Mecanismo B", discriminator: "pista beta", action: "Acción B" }] },
  { ...base, id: "madre/1/01.01", family: "madre", level: 1, prompt: "¿Qué patrón organiza este problema?", front: [{ text: "Una función falla." }], back: [{ title: "Patrón madre", text: "Explica la función." }] },
  { ...base, id: "madre/2/01.01-01", family: "madre", level: 2, prompt: "¿Qué diagnóstico o concepto explica este caso?", front: [{ text: "Caso con pista alfa.", highlight: "pista alfa" }], back: [{ title: "Diagnóstico A", text: "Mecanismo A" }] },
  { ...base, id: "madre/3/01.01-01", family: "madre", level: 3, prompt: "¿Qué hallazgo produce cada mecanismo?", front: [{ text: "Mecanismo causal" }], back: [{ title: "", text: "Hallazgo esperado" }] },
  { ...base, id: "madre/4/01.01-01", family: "madre", level: 4, prompt: "¿Qué haces primero y cómo cambia la decisión?", front: [{ text: "Primera decisión" }, { text: "Inestabilidad" }], back: [{ title: "Primera decisión", text: "Acción A", reason: "Razón A" }, { title: "Inestabilidad", text: "Escalar atención", reason: "Mayor urgencia" }] },
];
const section = { id: "01", title: "Sección de prueba", blocks: [{ id: "01.01", title: "Problema compartido", topics: 2 }], cards };
const manifest = { schema_version: 1, content_sha256: "test", review_status: "cross-reviewed", professional_review: "pending", counts: { sections: 1, blocks: 1, cards: 5, topic_occurrences: 2, eje: 1, madre: 4 }, sections: [{ id: "01", title: "Sección de prueba", blocks: 1, cards: 5, url: "sections/01.json" }], downloads: [{ family: "eje", label: "Eje Clínico", url: "enarm-eje.apkg", cards: 1 }, { family: "madre", label: "Patrones Madre", url: "enarm-madre.apkg", cards: 4 }] };

async function mockLibrary(page: Page) {
  await page.route("**/study/manifest.json", route => route.fulfill({ json: manifest }));
  await page.route("**/study/sections/*.json*", route => route.fulfill({ json: section }));
}

test("compares ordered cases, hides answers and resets reveal between levels", async ({ page }) => {
  await mockLibrary(page);
  await page.goto("./#biblioteca");
  await expect(page.getByRole("heading", { name: "Estudia por contraste", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" }).locator("li")).toHaveCount(2);
  await expect(page.getByText("Diagnóstico A", { exact: true })).toHaveCount(0);
  await expect(page.locator("mark")).toHaveCount(2);
  await page.getByRole("checkbox", { name: "Resaltar el dato clave" }).uncheck();
  await expect(page.locator("mark")).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText("Diagnóstico B");
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText("Acción A");
  await page.getByRole("button", { name: "Patrones Madre", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toHaveCount(0);
  await page.getByLabel("Nivel de Patrones Madre").selectOption("4");
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText("Inestabilidad");
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText("Mayor urgencia");
});

test("keeps progress and card feedback, and fits a narrow phone", async ({ page }) => {
  await mockLibrary(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Lo reconocí", exact: true }).click();
  await expect(page.getByText("1 tarjeta reconocida", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Comentar esta tarjeta", exact: true }).click();
  await page.getByLabel("Comentario", { exact: true }).fill("Revisar la pista de esta tarjeta.");
  await page.getByRole("button", { name: "Guardar comentario", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("eje/01.01");
  await page.keyboard.press("Escape");
  const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })));
  expect(overflow).toEqual([]);
  await page.reload();
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByText("1 tarjeta reconocida", { exact: true })).toBeVisible();
});

test("recovers when a section request fails", async ({ page }) => {
  await mockLibrary(page);
  let attempts = 0;
  await page.route("**/study/sections/*.json*", route => {
    attempts += 1;
    return attempts === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: section });
  });
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo cargar");
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
});

test("rejects malformed answer data before opening a card", async ({ page }) => {
  await mockLibrary(page);
  const broken = structuredClone(section);
  Object.assign(broken.cards[0].back[0], { action: { unexpected: true } });
  await page.route("**/study/sections/*.json*", route => route.fulfill({ json: broken }));
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo cargar");
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toHaveCount(0);
});

test("follows the chosen differential into management and keeps the case between levels", async ({ page }) => {
  await mockLibrary(page);
  const data = structuredClone(section);
  Object.assign(data.cards[0].back[0], { topic_id: "01.01-01" });
  Object.assign(data.cards[0].back[1], { topic_id: "01.01-02" });
  for (const card of data.cards.filter(c => c.level >= 2)) Object.assign(card, { topic_id: "01.01-01" });
  const second = data.cards.filter(c => c.level >= 2).map(card => ({ ...structuredClone(card), id: card.id.replace("01.01-01", "01.01-02"), topic_id: "01.01-02", context: "Caso con pista beta.", front: card.level === 3 ? [{ text: "Mecanismo causal beta" }] : card.front, back: card.back.map((row, index) => index === 0 ? { ...row, text: card.level === 4 ? "Acción B" : "Hallazgo beta" } : row) }));
  await page.route("**/study/sections/*.json*", route => route.fulfill({ json: { ...data, cards: [...data.cards, ...second] } }));
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await page.getByRole("button", { name: "Ver manejo y variantes", exact: true }).nth(1).click();
  await expect(page.getByLabel("Nivel de Patrones Madre")).toHaveValue("4");
  await expect(page.getByRole("heading", { name: "¿Qué haces primero y cómo cambia la decisión?", exact: true })).toBeFocused();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText("pista beta");
  await page.getByRole("button", { name: "Mostrar respuesta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toContainText("Acción B");
  await page.getByLabel("Nivel de Patrones Madre").selectOption("3");
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toContainText("Mecanismo causal beta");
  await expect(page.getByRole("region", { name: "Respuesta de la tarjeta" })).toHaveCount(0);
});

test("opens a section at the top after choosing it from a long page", async ({ page }) => {
  await mockLibrary(page);
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto("./#biblioteca");
  await page.getByRole("button", { name: /Sección de prueba/ }).click();
  await expect(page.getByRole("region", { name: "Frente de la tarjeta" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
