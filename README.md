# ENARM Contraste

[Estudiar en enarm.musel.dev](https://enarm.musel.dev/).

Biblioteca de estudio en español. Agrupa los temas por problemas clínicos para comparar casos, reconocer el dato que distingue y conectar el mecanismo con el manejo.

## Dos formatos

- **Eje Clínico:** casos del mismo grupo en el frente. Diagnósticos, discriminadores y primera decisión en el reverso.
- **Patrones Madre:** cuatro niveles. Reconocer el patrón, nombrar el diagnóstico, explicar los hallazgos y decidir el manejo según los factores del caso.

El inventario contiene 34 secciones, 355 grupos y 730 apariciones de temas. Conserva 719 combinaciones únicas de tema y referencia. Los formatos producen 355 tarjetas Eje Clínico y 2,545 Patrones Madre: 2,900 tarjetas en total.

La biblioteca carga una sección a la vez. Permite ocultar las respuestas y las pistas, elegir un bloque y nivel, guardar el progreso y comentar una tarjeta. Los dos mazos completos se descargan como archivos `.apkg` para importar en Anki.

**Explorar casos** conserva la muestra de amenorrea secundaria e ictericia obstructiva. Incluye el mapa de contraste, la ampliación de enfermedades y los cambios del caso.

## Fuentes y revisión

El contenido usa el libro completo `Edwino.pdf`, de 1,150 páginas, y la agrupación de `ENARM_Capa1_Completo.pdf`. Los mazos Eje Clínico y Patrones Madre del usuario fijan la estructura. Las viñetas son originales. Las precisiones de fuentes primarias actuales se identifican en el reverso.

Cada sección conserva evidencia de página. La validación comprueba las citas contra la extracción del libro. Un autor distinto revisa el contenido. Su aprobación queda ligada al hash de la sección. Cambiar el contenido invalida la comprobación anterior.

El cotejo de fuentes y la revisión cruzada son controles editoriales. La revisión clínica profesional permanece pendiente. Las tarjetas son material de estudio.

Los PDF, los mazos originales y la extracción bruta no se publican. La [nota de fuentes](content/source-notes.md) conserva la procedencia. El [contrato de autoría](docs/superpowers/specs/2026-10-29-full-book-card-contract.md) define los criterios.

## Desarrollo

Requisitos: Node compatible con Vite 8, npm, uv y Google Chrome.

```sh
npm ci
uv sync
npm run prepare:study
npm run dev
```

Abre `http://127.0.0.1:4178/`. `/#amenorrea` y `/#ictericia` abren la muestra anterior.

```sh
uv run python -m unittest discover -s tests -p 'test_*.py'
npm test
npm run build
```

`npm run build` genera los mazos y audita sus bases SQLite antes de compilar la web. Requiere todas las secciones, la validación de fuentes y las revisiones vigentes. Los archivos generados quedan en `app/public/study/` y se copian a `dist/study/`. Se excluyen de Git.

Chrome debe estar en `/usr/bin/google-chrome`. Usa `CHROME_PATH` para indicar otra ruta.

## Cambios de contenido

Edita `content/sections/NN.json`. Comprueba las citas con las páginas privadas del libro:

```sh
uv run python scripts/validate_sections.py --pages /tmp/enarm-authoring/pages --report content/source-validation.json
```

Un revisor distinto debe comprobar la sección y actualizar `content/reviews/NN.json`. Después genera y comprueba los archivos:

```sh
npm run prepare:study
```

El compilador conserva identificadores estables de Anki. La auditoría comprueba todas las correspondencias entre casos, diagnósticos, mecanismos, hallazgos y acciones. También abre ambos paquetes y comprueba sus notas, tarjetas y bases de datos.

Los comentarios y el progreso se guardan en el navegador. Los comentarios se comparten con **Descargar comentarios** o **Copiar texto**. La web no los envía automáticamente. Anki mantiene su propio progreso.

El [runbook de despliegue](docs/deployment.md) explica cómo publicar y recuperar una versión en el VPS. El [piloto biliar](content/piloto-biliar.json) y su generador anterior siguen disponibles para referencia.
