# ENARM Contraste

[Estudiar en enarm.musel.dev](https://enarm.musel.dev/).

Biblioteca de estudio en español. Agrupa los temas por problemas clínicos para comparar casos, reconocer el dato que distingue y conectar el mecanismo con el manejo.

## Tu plan diario

La página abre en **Hoy**. Elige una fecha objetivo o los minutos que puedes estudiar cada día. Selecciona los temas y formatos. La estimación incluye tarjetas nuevas y repasos FSRS. Supone respuestas «Bien» y se ajusta con tus tiempos activos.

Hoy abre la primera tarjeta asignada. Revelar la respuesta no suma progreso. Califica con **Otra vez**, **Difícil**, **Bien** o **Fácil**. Cada respuesta guardada hace avanzar la meta diaria y programa el repaso. La meta se conserva al recargar. Las tarjetas extra no cambian su tamaño. Puedes deshacer la última respuesta.

La **primera vuelta** cuenta tarjetas practicadas al menos una vez. No indica dominio. Los repasos continúan después. Las animaciones respetan la preferencia de movimiento reducido. El sonido está apagado al inicio.

El plan se guarda en IndexedDB en este dispositivo. **Copia de mi progreso** permite exportar o importar el plan y las respuestas. Una importación conserva una copia del estado anterior. No hay sincronización de cuentas. Las respuestas nuevas de Biblioteca y Mi avance usan el mismo registro que Hoy. Anki conserva su propio progreso.

## Avance y subtests

**Mi avance** muestra la primera vuelta por sección y bloque. Indica flashcards practicadas y pendientes, fecha de inicio, respuestas, errores, dificultades y próximo repaso. Una respuesta «Difícil» se cuenta por separado de un error. Los avisos de bloque y sección completos aparecen después de guardar la respuesta. Deshacer restaura el avance.

Elige una sección y un bloque para preparar un subtest. Selecciona preguntas concretas, todos los errores registrados o los repasos de hoy. Puedes combinar Eje Clínico y Patrones Madre. Después de responder, elige las preguntas que quieres repetir en la misma sesión. El resultado muestra la fecha del próximo repaso. Repetir una pregunta aumenta las respuestas, pero no el número de tarjetas únicas.

**Casos diagnósticos** separa los casos de Eje Clínico. Fácil muestra una pista y opciones. Medio conserva las opciones sin la pista. Se puede confundir pide escribir el diagnóstico y el dato que distingue antes de comparar y calificar. Puedes combinar los tres niveles. Los casos de la biblioteca conservan su viñeta original en estos modos.

El bloque de amenorreas de Ginecología añade **24 viñetas distintas**, tres por diagnóstico: Turner, Mayer-Rokitansky-Küster-Hauser, insensibilidad completa a andrógenos, himen imperforado, tabique vaginal transverso, Kallmann, amenorrea hipotalámica funcional y disgenesia gonadal completa 46,XY. Cada diagnóstico tiene un caso fácil, uno medio y uno de contraste. Esta ampliación enlaza fuentes primarias y tiene revisión clínica profesional pendiente. No modifica los mazos Anki revisados.

Los casos diagnósticos tienen memoria de repaso propia. Se cuentan aparte de las 2,900 flashcards. Una respuesta conjunta de Eje Clínico se atribuye al bloque; un caso individual permite identificar el tema del error. Las marcas antiguas de Biblioteca se conservan, pero no inventan respuestas históricas ni fechas de estudio.

## Dos formatos

- **Eje Clínico:** casos del mismo grupo en el frente. Diagnósticos, discriminadores y primera decisión en el reverso.
- **Patrones Madre:** cuatro niveles. Reconocer el patrón, nombrar el diagnóstico, explicar los hallazgos y decidir el manejo según los factores del caso.

El inventario contiene 34 secciones, 355 grupos y 730 apariciones de temas. Conserva 719 combinaciones únicas de tema y referencia. Los formatos producen 355 tarjetas Eje Clínico y 2,545 Patrones Madre: 2,900 tarjetas en total.

La biblioteca carga una sección a la vez. Permite buscar por síntoma o sección, abrir un grupo diferencial, ocultar las respuestas y las pistas, elegir un nivel, guardar el progreso y comentar una tarjeta. Cada diagnóstico enlaza con su manejo y variantes. Los dos mazos completos se descargan como archivos `.apkg` para importar en Anki.

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

Abre `http://127.0.0.1:4178/`. `/#hoy` abre el plan. `/#biblioteca` abre la biblioteca. `/#avance` abre los avances y subtests. `/#avance?section=14&block=14.01&mode=cases` abre los casos de amenorrea. `/#amenorrea` y `/#ictericia` abren la muestra anterior.

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
