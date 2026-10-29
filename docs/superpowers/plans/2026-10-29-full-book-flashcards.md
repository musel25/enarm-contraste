# Full Book Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. La autoría de secciones usa superpowers:dispatching-parallel-agents con archivos independientes.

**Goal:** Cubrir el PDF completo con los formatos Eje Clínico y Patrones Madre, comprobar toda la cobertura y publicar los mazos y la biblioteca web.

**Architecture:** Autoría JSON por sección, con evidencia del libro y revisión cruzada. Un compilador valida cobertura y referencias, genera los dos formatos y exporta Anki y JSON web. La biblioteca carga los datos por sección y conserva la muestra anterior.

**Tech Stack:** Python con uv y genanki, Poppler, React/TypeScript, Playwright y nginx en el VPS existente.

**Spec:** `docs/superpowers/specs/2026-10-29-full-book-card-contract.md`.

## Global Constraints

- Se cubren las 34 secciones, los 355 bloques y las 730 apariciones del inventario, sin perder los 719 temas únicos por nombre y páginas.
- Leer el libro completo por páginas de cada tema. Comprobar visualmente las páginas sin texto.
- La evidencia y los campos clínicos deben corresponder a la fuente. No inventar datos para completar un casillero.
- Mantener las dos familias como tarjetas reales con frentes y reversos propios.
- Las secciones tienen revisión cruzada independiente y validación automática.
- No publicar los PDF, los mazos originales ni la extracción bruta.
- Cada commit se sube inmediatamente. El usuario autorizó continuar hasta publicar.

## Review Focus

- Cobertura: ningún bloque o tema se omite o se marca listo sin contenido.
- Fidelidad: fuente, discriminador y tratamiento coinciden con las páginas indicadas.
- Frentes: los títulos, etiquetas y fuentes no revelan la respuesta.
- Anki: las filas conservan su correspondencia y los identificadores permanecen estables.
- Biblioteca: carga por sección, control de errores, navegación móvil y exportaciones reales.

## Task 1: Inventario y validadores

**Files:** `scripts/catalog_pdf.py`, `scripts/validate_sections.py`, `content/curriculum.json`, `tests/test_catalog_pdf.py`, `tests/test_sections.py`.

**Interfaces:** inventario con secciones, bloques, temas, páginas y conteos; validación de cada archivo `content/sections/NN.json` contra ese inventario.

- [ ] Pruebas de conservación de temas repetidos, continuación entre páginas, referencias y fuentes incompletas.
- [ ] Generar inventario completo y comprobar evidencia, discriminadores y cobertura.
- [ ] Guardar y subir la unidad validada.

## Task 2: Autoría completa y doble revisión

**Files:** `content/sections/01.json` a `34.json`, `content/reviews/NN.json`.

**Interfaces:** contrato de autoría de la especificación. Reparto independiente: 01–12, 13–23 y 24–34.

- [ ] Cada autor lee sus páginas y redacta los campos de todos sus temas.
- [ ] Validar cada sección antes de guardarla y subirla.
- [ ] Revisar cada sección con un autor distinto. Resolver todos los errores y vacíos.

## Task 3: Compilación y Anki

**Files:** `scripts/build_full_decks.py`, `tests/test_full_decks.py`, archivos generados en `app/public/study/` y `output/full-book/`.

**Interfaces:** 355 tarjetas Eje Clínico y 2,545 Patrones Madre desde la misma autoría, con UUID estables y páginas fuente. Manifiesto y JSON por sección, dos paquetes Anki y auditoría de cobertura.

- [ ] Pruebas de filas y respuestas, conteo real dentro de los paquetes y ausencia de filtración en frentes.
- [ ] Compilar, inspeccionar la base SQLite de Anki y validar todas las referencias.
- [ ] Guardar y subir la unidad.

## Task 4: Biblioteca web y publicación

**Files:** `app/src/{Library.tsx,StudyCard.tsx,App.tsx,study.css}`, `tests/study.spec.ts`, `README.md`, `content/source-notes.md`.

**Interfaces:** manifiesto completo, selector de sección/bloque/familia, revelado y descarga de paquetes; carga por sección.

- [ ] Pruebas de los dos formatos, niveles, navegación, errores de carga y móvil.
- [ ] Revisar el cambio completo y los archivos generados.
- [ ] Publicar en https://enarm.musel.dev/ y comprobar los archivos, conteos y flujos públicos.
