import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("teaches four alternatives together and can remove the discriminator highlight", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Amenorrea secundaria", exact: true }),
  ).toBeVisible();
  const cases = page.getByRole("article");
  await expect(cases).toHaveCount(4);
  await expect(
    cases.filter({
      has: page.getByRole("heading", { name: "Embarazo", exact: true }),
    }),
  ).toContainText("β-hCG positiva");
  await expect(
    cases.filter({ hasText: "Amenorrea hipotalámica funcional" }),
  ).toContainText("FSH baja o normal");
  await expect(page.locator("mark")).toHaveCount(4);
  await page
    .getByRole("checkbox", { name: "Resaltar el dato que distingue" })
    .uncheck();
  await expect(page.locator("mark")).toHaveCount(0);
});

test("shows the changed factor and why it changes management", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Cambiar el caso/ }).click();
  await page.getByRole("button", { name: /Bradicardia grave/ }).click();
  await expect(
    page.getByRole("region", { name: "Cambio de decisión" }),
  ).toContainText("hospitalización");
  await expect(
    page.getByRole("region", { name: "Cambio de decisión" }),
  ).toContainText("38 lpm");
  await expect(
    page.getByText("Datos que se conservan", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Ictericia obstructiva/ }).click();
  await page.getByRole("button", { name: /Se agrega infección/ }).click();
  await expect(
    page.getByRole("region", { name: "Cambio de decisión" }),
  ).toContainText("Colangitis aguda");
  await page.getByRole("button", { name: /Aparece hipotensión/ }).click();
  await expect(
    page.getByRole("region", { name: "Cambio de decisión" }),
  ).toContainText("estabilización inmediata");
});

test("keeps practice answers hidden and resets reveal when changing cases or axes", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Practicar/ }).click();
  await expect(
    page.getByRole("heading", { name: "Embarazo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Embarazo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lo reconocí", exact: true }).click();
  await expect(
    page.getByText("1 de 6 casos practicados", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Siguiente caso", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mostrar respuesta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Amenorrea hipotalámica funcional",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Mostrar respuesta", exact: true })
    .click();
  await page.getByRole("button", { name: /Ictericia obstructiva/ }).click();
  await expect(
    page.getByRole("button", { name: "Mostrar respuesta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Coledocolitiasis.", exact: true }),
  ).toHaveCount(0);
});

test("persists review comments with their case context and exports the actual text", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Hiperprolactinemia",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Comentar este caso" })
    .click();
  const comment =
    "Aclarar la diferencia con un prolactinoma. <script>window.injected=true</script>";
  await page.getByLabel("Comentario", { exact: true }).fill(comment);
  await page
    .getByRole("button", { name: "Guardar comentario", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(comment);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: /Tu revisión/ }).click();
  await expect(page.getByRole("dialog")).toContainText(comment);
  expect(
    await page.evaluate(
      () => (window as unknown as { injected?: boolean }).injected,
    ),
  ).toBeUndefined();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar comentarios", exact: true })
    .click();
  const download = await downloadEvent;
  const payload = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(payload.comments).toHaveLength(1);
  expect(payload.comments[0]).toMatchObject({
    text: comment,
    context: { axisId: "amenorrea", caseId: "AME-PRO" },
  });
});

test("recovers from malformed saved data and works when storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("enarm-contraste-review-v1", "{broken");
    localStorage.setItem(
      "enarm-contraste-practice-v1",
      JSON.stringify({ unexpected: true }),
    );
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  await page.goto("./");
  await expect(page.getByRole("article")).toHaveCount(4);
  await page.getByRole("button", { name: /Tu revisión/ }).click();
  await page
    .getByLabel("Comentario", { exact: true })
    .fill("Se puede exportar sin almacenamiento.");
  await page
    .getByRole("button", { name: "Guardar comentario", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Descarga los comentarios antes de cerrar",
  );
  await expect(
    page.getByRole("button", { name: "Descargar comentarios", exact: true }),
  ).toBeEnabled();
});

test("fits a phone viewport and restores focus after closing disease detail", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/*.woff2", (route) => route.abort());
  await page.goto("./");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const trigger = page
    .getByRole("article")
    .first()
    .getByRole("button", { name: "Profundizar" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: /Practicar/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("opens disease detail and changes the symptom axis without mixing cases", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", {
        name: "Insuficiencia ovárica primaria",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Profundizar" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Confirmar el diagnóstico");
  await dialog.getByText("Consultar fuentes", { exact: true }).click();
  await expect(
    dialog.getByRole("link", { name: /Guía de insuficiencia ovárica/ }),
  ).toHaveAttribute("href", /asrm.org/);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /Ictericia obstructiva/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ictericia obstructiva", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("article").filter({ hasText: "Colangitis aguda" }),
  ).toContainText("infección");
  await expect(page.getByRole("main")).not.toContainText(
    "Insuficiencia ovárica primaria",
  );
});
