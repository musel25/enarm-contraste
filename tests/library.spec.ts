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
