# Contrast Sample Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar una muestra funcional de aprendizaje clínico por contraste en el VPS existente.

**Architecture:** React y TypeScript con Vite generan archivos estáticos. El contenido tiene dos ejes, casos comparables, variantes y práctica. Los comentarios y el progreso se guardan en el navegador y se pueden exportar; no requieren cuentas.

**Tech Stack:** React 19, TypeScript, Vite 8, Playwright, nginx, SSH y rsync. Los scripts Python existentes mantienen `uv`.

**Spec:** `docs/superpowers/specs/2026-10-29-aprendizaje-clinico-por-contraste-design.md`.

## Global Constraints

- El usuario aprobó el diseño y autorizó continuar hasta desplegar en el VPS, sin otra pausa de aprobación.
- La muestra incluye amenorrea secundaria (cuatro alternativas) e ictericia obstructiva (dos alternativas).
- La capa 1 incluye comparación, mecanismo mínimo, diagnóstico y manejo inicial condicionado por el caso.
- La dirección visual existente es Cobalto: fondo #F3F6FC, texto #253047, controles #304FC5 y discriminador #92500A sobre #FFF0D9; fuentes Outfit y Source Sans 3.
- Las precisiones externas se distinguen del libro. Los casos son didácticos y la revisión clínica está pendiente.
- No se publica el PDF ni su texto extraído. No se cambia la identidad de las diez tarjetas existentes.
- Cada unidad completa se guarda con Conventional Commits y se sube inmediatamente.
- Destino: https://timer.musel.dev/grind/enarm/, con archivos independientes y recuperación de la versión previa.

## Review Focus

- La práctica no debe revelar la respuesta antes de solicitarla, mediante títulos, etiquetas o detalles.
- Al cambiar de eje o de caso se debe restablecer la respuesta revelada y la variante seleccionada.
- Un almacenamiento local inválido o bloqueado no debe impedir estudiar ni exportar comentarios.
- Los comentarios deben conservar su contexto y ser texto seguro; el archivo debe contener los comentarios reales.
- La vista móvil y los diálogos deben permitir navegación por teclado sin desbordamiento horizontal.

## Diseño visual

Conservar Cobalto y las dos fuentes. Usar una columna lateral pequeña para elegir el síntoma y una zona principal de comparación. Los casos son el centro de la pantalla. El resaltado ámbar une visualmente los datos que distinguen los diagnósticos. Las tres pestañas corresponden al recorrido real: comparar, cambiar el caso y practicar. En móvil, los ejes pasan arriba y las comparaciones se apilan. No se añade una portada que retrase el estudio.

## Task 1: Comparación y ampliación de enfermedades

**Files:** `package.json`, `package-lock.json`, `tsconfig.json`, `app/vite.config.ts`, `app/index.html`, `app/src/{main.tsx,App.tsx,styles.css,content.ts,types.ts}`, `playwright.config.ts`, `tests/study.spec.ts`.

**Interfaces:** `axes: ClinicalAxis[]`; cada eje tiene `id`, `title`, `question`, `shared`, `cases`, `variants`, `practice` y `sources`. Los casos tienen identificadores estables, viñeta marcada con `[[...]]`, explicación funcional, contraste, primera decisión y ampliación. `MarkedText` convierte exclusivamente los marcadores en elementos de resaltado de React.

- [ ] Configurar React, Vite y Playwright con Chrome instalado; escribir una prueba de comparación y otra de ampliación y cambio de eje.
- [ ] Ejecutar las pruebas con la página vacía; deben fallar porque no hay casos.
- [ ] Añadir seis casos con fuentes, comparación visible, control del resaltado y un diálogo de ampliación accesible.
- [ ] Ejecutar `npm test` y `npm run build`; deben pasar.
- [ ] Guardar y subir con `feat: add symptom-based clinical comparison sample`.

## Task 2: Variantes, práctica y comentarios

**Files:** `app/src/{App.tsx,Variants.tsx,Practice.tsx,Review.tsx,storage.ts,content.ts,styles.css}`, `tests/study.spec.ts`.

**Interfaces:** `Variants({axis})` muestra la secuencia y el cambio explícito. `Practice({axis})` oculta la respuesta hasta revelarla. `Review({context,onClose})` guarda comentarios con eje, caso o sección y exporta JSON. `readState` valida datos almacenados antes de usarlos.

- [ ] Añadir pruebas de cambio del manejo, respuesta oculta y reinicio al cambiar de eje, persistencia y exportación de comentarios, almacenamiento inválido y móvil.
- [ ] Ejecutar las nuevas pruebas; deben fallar por funciones aún ausentes.
- [ ] Implementar los tres modos y los comentarios locales con exportación y aviso de almacenamiento.
- [ ] Ejecutar `npm test` y `npm run build`; deben pasar sin errores de consola.
- [ ] Guardar y subir con `feat: add decision variants practice and review export`.

## Task 3: Publicación y verificación

**Files:** `scripts/deploy.sh`, `README.md`, `docs/deployment.md`, `app/public/favicon.svg`.

**Interfaces:** `scripts/deploy.sh` exige un árbol limpio y una revisión subida, compila, copia solo `dist/`, cambia un enlace de versión de forma atómica y verifica nginx y HTTP. Revierte configuración y enlace si falla una comprobación.

- [ ] Revisar todo el cambio con un revisor independiente y corregir los problemas importantes.
- [ ] Comprobar escritorio y móvil con capturas. Comprobar accesibilidad básica y las fuentes de los casos.
- [ ] Añadir la ruta propia antes de la ruta general `/grind/`, con respaldo del archivo nginx existente.
- [ ] Guardar y subir con `chore: add versioned VPS deployment for study sample`.
- [ ] Ejecutar el despliegue autorizado y comprobar la página, sus recursos y las rutas existentes desde HTTP público.
- [ ] Ejecutar las pruebas contra la URL pública. Integrar la rama en `main` mediante avance directo y subirla.

## Ejecución

Se trabaja en `/tmp/enarm-contraste-sample`, rama `feat/contrast-sample`. El piloto Python existente se generó sin errores antes de comenzar. El alcance es una muestra para comentarios de la hermana del usuario; no es la cobertura completa del PDF ni un planificador de repetición espaciada.
