# ENARM Contraste

Sitio de estudio en español para preparar el ENARM mediante diagnóstico diferencial, casos comparables y decisiones de manejo.

La muestra web usa React, TypeScript y Vite. Conserva la dirección visual Cobalto.

## Muestra web

[Abrir ENARM Contraste](https://timer.musel.dev/grind/enarm/).

- Dos ejes: amenorrea secundaria e ictericia obstructiva.
- Seis casos comparables con discriminadores resaltados, mecanismo y primera decisión.
- Seis situaciones para ver qué cambia en el diagnóstico o en el manejo.
- Ampliación de cada enfermedad con confirmación, tratamiento, modificadores y fuentes.
- Dieciséis tarjetas de práctica con respuesta oculta y progreso local.
- Comentarios por caso o sección, con descarga JSON y copia de texto para compartir.

El usuario añadió `ENARM_Capa1_Completo.pdf`. Se usaron sus bloques 05.03, 10.10, 14.01 y 14.02. La [nota de fuentes](content/source-notes.md) distingue las páginas de este PDF de las páginas del libro que cita. El contenido es una muestra parcial pendiente de revisión clínica.

### Desarrollo

```sh
npm ci
npm run dev
npm test
npm run build
```

Abre `http://127.0.0.1:4178/grind/enarm/`. Las pruebas requieren Google Chrome en `/usr/bin/google-chrome`; `CHROME_PATH` permite indicar otra ruta.

Los comentarios y el progreso se guardan solo en el navegador. La muestra no incluye cuentas, sincronización ni un planificador de repetición espaciada. El [runbook de despliegue](docs/deployment.md) describe la publicación en el VPS.

## Diseño de aprendizaje por contraste

La [propuesta de aprendizaje por contraste](docs/superpowers/specs/2026-10-29-aprendizaje-clinico-por-contraste-design.md) organiza los temas por ejes clínicos. La capa 1 enseña con casos comparables, datos discriminadores resaltados y una relación entre la función alterada y el manejo inicial. Las variantes muestran qué factor cambia la decisión antes de ampliar cada enfermedad.

El usuario aprobó este diseño. La muestra web implementa el flujo para evaluar el método antes de ampliar el contenido.

## Piloto de tarjetas

Diez tarjetas originales de coledocolitiasis y colangitis, basadas en las páginas 135 y 138 del extracto proporcionado. Cada concepto tiene cinco tipos: ancla, contraste, microvariación, discriminador y primera decisión.

El mapa horizontal orienta la comparación antes de las tarjetas. Los frentes resaltan el discriminador con un color común. Las microvariaciones declaran un único cambio. Los reversos incluyen mecanismo breve, contraste, primera decisión, límites y referencias.

Las viñetas y cifras clínicas son ejemplos construidos para enseñanza. Las precisiones de guías externas se identifican. Los criterios de autoría están en `content/criterios-tarjetas.txt` y el texto recibido está en `content/prompt-original.txt`.

### Generar la muestra

```sh
uv sync
uv run python scripts/build_pilot.py
```

Abre `output/piloto-biliar/revision-cobalto.html` en un navegador. Revela las respuestas y evalúa cada tarjeta con Conservar, Ajustar o Descartar. Exporta los comentarios antes de cerrar.

El generador también crea el mazo `enarm-contraste-piloto.apkg`, los datos JSON y un ZIP descargable. Comprueba diez notas y diez tarjetas en el paquete. Usa identificadores estables para conservar la identidad de las notas al regenerarlas.

El script exporta contenido escrito en `content/piloto-biliar.json`. La ampliación del contenido requiere otra revisión. La página de evaluación y Anki mantienen registros separados.

### Diseño Cobalto

- Fondo `#F3F6FC`, superficie `#FFFFFF`, texto `#253047`.
- Controles y progreso `#304FC5`, acento suave `#DFE8FF`.
- Discriminador `#92500A` sobre `#FFF0D9`.
- Encabezados Outfit; texto Source Sans 3. Anki usa alternativas locales cuando las fuentes no están instaladas.

Este piloto permite evaluar el contenido antes de generar más tarjetas o implementar el planificador.

El libro completo tiene 1,150 páginas. El PDF local es un extracto. No se publica el PDF ni su texto extraído en este repositorio.

## Estructura

- `app/`: aplicación web de la muestra.
- `content/`: contenido estructurado y referencias de las tarjetas.
- `scripts/`: preparación y exportación de la muestra.
- `output/`: archivos generados para revisión.
- `tests/`: pruebas de navegador de los flujos de estudio y revisión.
- `docs/`: diseño, plan y despliegue.

Las tarjetas médicas permanecen como borradores hasta su revisión profesional.
