# Standalone ENARM Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar una interfaz nueva en https://enarm.musel.dev y aplicar la estructura pedagógica de los mazos que compartió el usuario.

**Architecture:** Conservar React, los datos clínicos y los tres modos existentes. Cambiar la composición visual y añadir un mapa de contraste y razonamiento desplegable. Usar un virtual host nginx propio, con certificado y enlace de versión separados.

**Tech Stack:** React, TypeScript, Vite, Playwright, nginx, Certbot y Chrome MCP para DNS.

**Spec:** `docs/superpowers/specs/2026-10-29-aprendizaje-clinico-por-contraste-design.md`, con las instrucciones posteriores de rediseñar, usar un subdominio propio y considerar los mazos Anki.

## Global Constraints

- El usuario autorizó continuar hasta el despliegue, sin otra pausa de aprobación.
- No publicar PDF ni mazos originales. Añadir sus formatos a `.gitignore`.
- Mantener dos ejes y los casos y tarjetas de la muestra. No ampliar todo el PDF.
- Conservar discriminadores uniformes, diagnósticos visibles al aprender y respuestas ocultas al practicar.
- Cada commit debe ir seguido de `git push`.
- Crear únicamente `enarm A 145.241.168.188`, TTL 60. Ya se creó desde Chrome y se verificó en DNS autoritativo y 1.1.1.1.
- No cambiar el sitio principal, el temporizador ni las rutas de otros proyectos.
- Conservar la publicación anterior para exportar comentarios locales. El nuevo host usa `/var/www/enarm-contraste/site-current`, separado de `current`.

## Referencias examinadas

Se leyeron las notas y modelos de cinco archivos `.apkg.zip`: Ejes Diagnósticos (188 notas), Amenorreas primarias (23), Amenorreas secundarias (29), Gineco Obstetricia Capa6 EjeClínico (30) y Patrones Madre Shock (13). Se priorizan los dos últimos, como indica la hermana.

Aplicación: mapa síntoma/patrón/diagnóstico de Capa6; relación mecanismo/hallazgo/manejo de Patrones Madre; fundamentos de los mazos de amenorrea. Se toma la arquitectura de aprendizaje. Las asociaciones abreviadas no sustituyen la confirmación clínica ni se convierten en reglas absolutas.

## Diseño visual del constructor

Una mesa de estudio luminosa, con cabecera horizontal y selector de ejes. Se retira la barra lateral anterior. Fondo #F7F8FC, tinta #20213D, violeta #6550CE, lavanda #EEEAFB y pistas ámbar #FFF0D2. Manrope para interfaz y Lora para viñetas. Una cabecera índigo identifica la lección y una ilustración vectorial de dos casos expresa el contraste. Dos columnas de casos y un mapa lateral compacto. En móvil, el mapa se puede desplegar. El mecanismo y el manejo se abren dentro de cada caso. Los tres modos siguen disponibles en una navegación fija.

## Review Focus

- La composición cambia de forma sustancial, no solo los colores.
- El mapa y las ampliaciones no revelan la respuesta en práctica.
- Los modos y diálogos caben a 320 px y funcionan sin fuentes descargadas.
- Los comentarios antiguos siguen disponibles en el origen anterior.
- El nuevo host está aislado y permite volver a la versión anterior.

## Task 1: Interfaz y estructura de aprendizaje

**Files:** `app/src/{App.tsx,Comparison.tsx,styles.css,study.css,main.tsx}`, `package.json`, `package-lock.json`, `tests/study.spec.ts`, `.gitignore`, `content/source-notes.md`.

**Interfaces:** `Comparison({axis,highlight,onDetail,onReview})` muestra el mapa por patrones, las viñetas y la relación mecanismo/decisión. Los tres modos y comentarios conservan sus interfaces.

- [ ] Añadir pruebas del mapa, razonamiento desplegable y ocultación del mapa en práctica. Observar sus fallos.
- [ ] Implementar la composición con los seis casos existentes y documentar el uso de cada mazo.
- [ ] Verificar `npm test`, `npm run build` y capturas de escritorio y móvil.
- [ ] Commit y push: `feat: redesign clinical study workspace around contrast maps`.

## Task 2: Subdominio y publicación independiente

**Files:** `deploy/nginx-enarm.musel.dev.conf`, `scripts/{setup-domain.sh,deploy.sh}`, `app/vite.config.ts`, `playwright.config.ts`, `README.md`, `docs/deployment.md`.

**Interfaces:** `setup-domain.sh` habilita HTTP para validar el certificado y obtiene TLS con la cuenta Certbot existente. `deploy.sh` copia solo `dist/`, instala el virtual host propio y cambia `site-current` de forma atómica. La base de la app es `/`. Revierte configuración y enlace ante fallos.

- [ ] Comprobar la ruta raíz y la sintaxis de scripts y nginx.
- [ ] Guardar y subir la unidad de despliegue.
- [ ] Revisar el cambio completo con un revisor independiente y corregir problemas importantes.
- [ ] Emitir certificado, publicar y probar https://enarm.musel.dev/.
- [ ] Verificar las rutas anteriores y el certificado público. Integrar en main y subir.
