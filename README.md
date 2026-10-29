# ENARM Contraste

Sitio de estudio en español para preparar el ENARM mediante diagnóstico diferencial, tarjetas conectadas, repetición espaciada y progreso visible.

La dirección visual elegida es Cobalto. La aplicación se desarrollará con React y TypeScript.

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

- `app/`: futura aplicación web.
- `content/`: contenido estructurado y referencias de las tarjetas.
- `scripts/`: preparación y exportación de la muestra.
- `output/`: archivos generados para revisión.

Las tarjetas médicas permanecen como borradores hasta su revisión profesional.
