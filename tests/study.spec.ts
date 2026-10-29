import { test, expect } from '@playwright/test';

test('teaches four alternatives together and can remove the discriminator highlight', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Amenorrea secundaria', exact: true })).toBeVisible();
  const cases = page.getByRole('article');
  await expect(cases).toHaveCount(4);
  await expect(cases.filter({ has: page.getByRole('heading', { name: 'Embarazo', exact: true }) })).toContainText('β-hCG positiva');
  await expect(cases.filter({ hasText: 'Amenorrea hipotalámica funcional' })).toContainText('FSH baja o normal');
  await expect(page.locator('mark')).toHaveCount(4);
  await page.getByRole('checkbox', { name: 'Resaltar el dato que distingue' }).uncheck();
  await expect(page.locator('mark')).toHaveCount(0);
});

test('opens disease detail and changes the symptom axis without mixing cases', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Insuficiencia ovárica primaria', exact: true }) }).getByRole('button', { name: 'Profundizar' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Confirmar el diagnóstico');
  await dialog.getByText('Consultar fuentes', { exact: true }).click();
  await expect(dialog.getByRole('link', { name: /Guía de insuficiencia ovárica/ })).toHaveAttribute('href', /asrm.org/);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: /Ictericia obstructiva/ }).click();
  await expect(page.getByRole('heading', { name: 'Ictericia obstructiva', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('article').filter({ hasText: 'Colangitis aguda' })).toContainText('infección');
  await expect(page.getByRole('main')).not.toContainText('Insuficiencia ovárica primaria');
});
