import { test, expect } from '@playwright/test';
import { mockCoach } from './coach-fixtures';

test.beforeEach(async ({ page }) => { await mockCoach(page); await page.emulateMedia({ reducedMotion: 'reduce' }); });

test('selects a block subtest, records an error, repeats it, and keeps progress on reload', async ({ page }) => {
  await page.goto('./#avance');
  await expect(page.getByRole('heading', { name: 'Mi avance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await expect(page.getByText('Pregunta 1 de 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Me equivoqué', exact: true }).click();
  await expect(page.getByText(/Próximo repaso:/)).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente pregunta', exact: true }).click();
  await page.getByRole('button', { name: 'Terminar subtest', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Resultado del subtest' })).toBeVisible();
  await page.getByRole('button', { name: 'Repetir seleccionadas', exact: true }).click();
  await expect(page.getByText('Pregunta 1 de 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Acerté', exact: true }).click();
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
  await page.getByRole('button', { name: 'Volver a mi avance', exact: true }).click();
  await expect(page.getByTestId('section-progress-01')).toContainText('1 de 5');
  await expect(page.getByTestId('section-progress-01')).toContainText('2 respuestas');
  await expect(page.getByTestId('section-progress-01')).toContainText('1 error');
  await page.reload();
  await expect(page.getByTestId('section-progress-01')).toContainText('1 de 5');
});

test('finishes a whole block and section and announces both milestones', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
    await page.getByRole('button', { name: 'Acerté', exact: true }).click();
    if (i < 4) await page.getByRole('button', { name: 'Siguiente pregunta', exact: true }).click();
  }
  await expect(page.getByRole('status').filter({ hasText: 'Bloque completo' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Sección completa' })).toBeVisible();
});

test('a diagnostic answer records a precise topic result and a due date', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('button', { name: 'Casos diagnósticos', exact: true }).click();
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await expect(page.getByRole('heading', { name: '¿Cuál es el diagnóstico?' })).toBeVisible();
  await page.getByRole('button', { name: 'Respuesta alfa', exact: true }).click();
  await expect(page.getByText('Respuesta correcta.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Próximo repaso:/)).toBeVisible();
});

test('a failed save keeps the question and retries one attempt', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  let fail = true;
  await page.route('**/api/progress', route => {
    if (route.request().method() === 'PUT' && fail) { fail = false; return route.abort('failed'); }
    return route.fallback();
  });
  await page.getByRole('button', { name: 'Acerté', exact: true }).click();
  await expect(page.getByText('No se guardó la respuesta. Conservamos esta pregunta.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver resultado', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reintentar respuesta', exact: true }).click();
  await expect(page.getByText('Respuesta correcta.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
  await expect(page.getByText(/1 respuestas guardadas/)).toBeVisible();
});

test('contrast mode requires recall and a repeated one-card test hides the answer', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('button', { name: 'Casos diagnósticos', exact: true }).click();
  await page.getByLabel('Dificultad del caso').selectOption('contrast');
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await expect(page.getByRole('button', { name: 'Comparar diagnóstico', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Respuesta alfa', exact: true })).toHaveCount(0);
  await page.getByLabel('Escribe tu diagnóstico y el dato que lo distingue').fill('Respuesta alfa. La pista alfa.');
  await page.getByRole('button', { name: 'Comparar diagnóstico', exact: true }).click();
  await page.getByRole('button', { name: 'Me equivoqué', exact: true }).click();
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
  await page.getByRole('button', { name: 'Repetir seleccionadas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Respuesta alfa', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Comparar diagnóstico', exact: true })).toBeDisabled();
});

test('progress and question selection fit a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('./#avance');
  await expect(page.getByRole('button', { name: 'Seleccionar todas', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('undoing a diagnostic answer does not block the next daily extra', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Tiempo diario', exact: true }).click();
  await page.getByLabel('Minutos por día', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Empezar mi plan', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
    await page.getByRole('button', { name: /^Bien/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Tu meta de hoy está completa.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mi avance', exact: true }).click();
  await page.getByRole('button', { name: 'Casos diagnósticos', exact: true }).click();
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await page.getByRole('button', { name: 'Respuesta alfa', exact: true }).click();
  await expect(page.getByText('Respuesta correcta.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await page.getByRole('button', { name: 'Deshacer última respuesta', exact: true }).click();
  await page.getByRole('button', { name: /Una tarjeta más/ }).click();
  await expect(page.getByRole('heading', { name: 'Pregunta del nivel 2', exact: true })).toBeVisible();
});

test('undo clears a block and section completion notice in Today', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('checkbox', { name: /Patrones Madre/ }).uncheck();
  await page.getByRole('button', { name: 'Empezar mi plan', exact: true }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  await page.getByRole('button', { name: /^Bien/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bloque completo' })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer última respuesta', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bloque completo' })).toHaveCount(0);
});

test('moving to the next question restores keyboard focus to its heading', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Acerté', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente pregunta', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¿Qué patrón organiza este problema?', exact: true })).toBeFocused();
});

test('library ratings appear in Mi avance and do not freeze a daily plan', async ({ page }) => {
  await page.goto('./#biblioteca');
  await page.getByRole('button', { name: /Sección de prueba/ }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Lo reconocí', exact: true }).click();
  await expect(page.getByText('1 tarjeta reconocida', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mi avance', exact: true }).click();
  await expect(page.getByTestId('section-progress-01')).toContainText('1 de 5');
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await page.getByRole('button', { name: 'Tiempo diario', exact: true }).click();
  await page.getByLabel('Minutos por día', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Empezar mi plan', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Frente de la tarjeta' })).toBeVisible();
});

test('all difficulty levels can be selected in one diagnostic subtest', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('button', { name: 'Casos diagnósticos', exact: true }).click();
  await page.getByLabel('Dificultad del caso').selectOption('all');
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Empezar subtest (3)', exact: true })).toBeEnabled();
});

test('library practice on a new day does not replace the real daily assignment', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') });
  await page.goto('./');
  await page.getByRole('button', { name: 'Tiempo diario', exact: true }).click();
  await page.getByLabel('Minutos por día', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Empezar mi plan', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Meta diaria' })).toHaveAttribute('aria-valuemax', '2');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.clock.fastForward(24 * 60 * 60 * 1000);
  await page.getByRole('button', { name: /Sección de prueba/ }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Lo reconocí', exact: true }).click();
  await expect(page.getByText('1 tarjeta reconocida', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Meta diaria' })).toHaveAttribute('aria-valuemax', '2');
  await expect(page.getByRole('region', { name: 'Frente de la tarjeta' })).toBeVisible();
});

test('a diagnostic backup can be exported and restored', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('button', { name: 'Casos diagnósticos', exact: true }).click();
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  await page.getByRole('button', { name: 'Respuesta alfa', exact: true }).click();
  await expect(page.getByText('Respuesta correcta.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar mi plan', exact: true }).click();
  await page.getByRole('button', { name: 'Copia de mi progreso' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar mi progreso', exact: true }).click();
  const backup = await downloaded;
  await page.getByLabel('Importar una copia').setInputFiles((await backup.path())!);
  await expect(page.getByText('Copia comprobada', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reemplazar con esta copia', exact: true }).click();
  await page.getByRole('button', { name: 'Mi avance', exact: true }).click();
  await expect(page.getByTestId('section-progress-01')).toContainText('1 casos diagnósticos');
});

test('undo removes a new Library rating from both views', async ({ page }) => {
  await page.goto('./#biblioteca');
  await page.getByRole('button', { name: /Sección de prueba/ }).click();
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Lo reconocí', exact: true }).click();
  await expect(page.getByText('1 tarjeta reconocida', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar mi plan', exact: true }).click();
  await page.getByRole('button', { name: 'Deshacer última respuesta', exact: true }).click();
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: /Sección de prueba/ }).click();
  await expect(page.getByText('0 tarjetas reconocidas', { exact: true })).toBeVisible();
});

test('retrying the final Library answer announces block and section completion', async ({ page }) => {
  await page.goto('./#avance');
  await page.getByRole('button', { name: 'Seleccionar todas', exact: true }).click();
  await page.getByRole('button', { name: /Empezar subtest/ }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
    await page.getByRole('button', { name: 'Acerté', exact: true }).click();
    await page.getByRole('button', { name: 'Siguiente pregunta', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: /Sección de prueba/ }).click();
  await page.getByRole('button', { name: 'Patrones Madre', exact: true }).click();
  await page.getByLabel('Nivel de Patrones Madre').selectOption('4');
  await page.getByRole('button', { name: 'Mostrar respuesta', exact: true }).click();
  let fail = true;
  await page.route('**/api/progress', route => {
    if (route.request().method() === 'PUT' && fail) { fail = false; return route.abort('failed'); }
    return route.fallback();
  });
  await page.getByRole('button', { name: 'Lo reconocí', exact: true }).click();
  await page.getByRole('button', { name: 'Reintentar guardado', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bloque completo' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Sección completa' })).toBeVisible();
});

test('a slow diagnostic backup cannot replace a more recent file selection', async ({ page }) => {
  const { emptyState, recordPractice } = await import('../app/src/coach/engine');
  const { caseMeta } = await import('../app/src/learning/model');
  const stateA = recordPractice(emptyState(), caseMeta('clinical/01.01/01.01-1/easy')!, 3, 10, '2026-10-29', 'backup-a');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/study/sections/*.json*', async route => { await held; await route.fallback(); });
  await page.goto('./');
  await page.getByRole('button', { name: 'Ya tengo una copia de mi progreso', exact: true }).click();
  const requested = page.waitForRequest(request => request.url().includes('/study/sections/'));
  await page.getByLabel('Importar una copia').setInputFiles({ name: 'a.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'enarm-coach', state: stateA })) });
  await requested;
  await page.getByLabel('Importar una copia').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'enarm-coach', state: emptyState() })) });
  await expect(page.locator('.coach-import-preview')).toContainText('0 respuestas');
  const responded = page.waitForResponse(response => response.url().includes('/study/sections/'));
  release();
  await (await responded).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.coach-import-preview')).toContainText('0 respuestas');
});
