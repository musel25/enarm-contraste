# Contrato de contenido clínico por capas

El diseño aprobado está en `docs/superpowers/specs/2026-11-06-study-layers-design.md`. Este contrato solo se aplica al contenido nuevo. No sustituye el contrato del libro.

## Autoría

Archivo: `content/layers/capa2/NN.json`. El suplemento de capa 1 usa `content/layers/capa1/35.json`.

```json
{
  "schema_version": 1,
  "layer": 2,
  "section_id": "01",
  "title": "ACLS",
  "author": "identidad-del-autor",
  "sources": [{
    "id": "aha-2025",
    "label": "Nombre del documento y organización",
    "url": "https://fuente-primaria.example/guia",
    "version": "2025",
    "checked_at": "2026-11-06",
    "region": "international",
    "access": "checked",
    "locator": "Apartado o recomendaciones comprobadas"
  }],
  "mexico_source_note": "Fuente mexicana comprobada o límite concreto de la búsqueda nacional.",
  "blocks": [{
    "id": "01.01",
    "title": "Título clínico del bloque",
    "related_sections": ["04"],
    "scenarios": [{
      "id": "01.01-01-variante",
      "anchor_topic_ids": ["01.01-01"],
      "objective": "variante",
      "vignette": "Caso original suficiente. No incluir el diagnóstico cuando se pregunta por él.",
      "question": "Una sola decisión principal.",
      "answer": "Respuesta breve y condicionada a los datos disponibles.",
      "discriminator": "Fragmento literal de la viñeta que cambia la decisión",
      "reason": "Razón clínica breve. Incluir el límite de certeza cuando procede.",
      "initial_action": "Primera acción útil según este escenario, sin inventar dosis.",
      "limits": "Dato necesario, límite de la prueba o contexto de aplicación.",
      "evidence": [{"source_id": "aha-2025", "locator": "Apartado preciso", "support": "Resumen propio del respaldo de esta decisión"}]
    }]
  }]
}
```

`objective` admite: `ancla`, `variante`, `incompleta`, `subtipo`, `contraste`, `cambio`, `dato_faltante`, `gravedad`, `mecanismo`.

Cada escenario tiene identidad única. La viñeta, la pregunta y la respuesta son originales. Dos escenarios no pueden usar la misma viñeta. Cambiar solo la edad, el nombre o el orden de frases no crea un escenario nuevo.

El compilador usa `scenario/<id>` en el suplemento de capa 1 y `capa2/scenario/<id>` en capa 2. La familia y el objetivo son metadatos. Cambiarlos no cambia el identificador de estudio. Una vez publicado, el identificador del escenario es inmutable, aunque su nombre contenga una función educativa anterior.

Para las secciones 01–34, cubrir todos los conceptos de los bloques originales mediante `anchor_topic_ids`. Los contrastes pueden enlazar varios conceptos. Cada sección debe superar el número original de apariciones de temas con escenarios clínicos distintos. No generar esta ampliación a partir de sustituciones automáticas del texto de capa 1.

El nuevo tema usa los bloques 35.01 a 35.10 definidos en el diseño. Sus conceptos ancla se definen en capa 1 y se conservan en capa 2. Incluir por lo menos dos escenarios diferentes por bloque en capa 1 y más escenarios en capa 2. La cantidad debe responder a decisiones clínicas distintas.

Comprobar las fuentes primarias durante esta tarea. Usar `region: "mexico"` o `"international"`. Registrar la versión real del documento. No tratar la fecha de consulta como fecha de publicación. Cada sección necesita por lo menos una fuente internacional comprobada y una nota concreta sobre las fuentes mexicanas. Si existe una fuente mexicana aplicable y accesible, incluirla. Si no se encuentra una fuente reciente, declarar el límite. No inventar actualizaciones.

`access: "checked"` significa que el autor abrió y comprobó el documento y el apartado utilizado. Un resultado de búsqueda, un título o una URL que devuelve 403 no bastan. Las fuentes pendientes bloquean la publicación. Las cifras, dosis, contraindicaciones y diferencias de manejo necesitan respaldo específico. Las guías de adultos no respaldan una pauta pediátrica u obstétrica.

## Revisión independiente

Archivo: `content/layers/reviews/capa2/NN.json` o `content/layers/reviews/capa1/35.json`.

```json
{
  "section_id": "01",
  "layer": 2,
  "author": "identidad-del-autor",
  "reviewer": "identidad-distinta",
  "content_sha256": "hash del JSON canónico",
  "status": "approved",
  "professional_review": "pending",
  "source_ids_checked": ["aha-2025"],
  "scenario_ids": ["01.01-01-variante"],
  "issues": [],
  "notes": ["Controles y decisiones clínicas que el revisor comprobó."]
}
```

Hash: SHA-256 de `json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()`.

El revisor abre las fuentes y comprueba cada escenario. No aprueba su propio contenido. No basta calcular el hash y copiar los identificadores. Registra problemas concretos antes de aprobar. Una modificación del contenido invalida la revisión.

La revisión editorial independiente no sustituye la revisión clínica profesional. Esa revisión sigue pendiente y debe mostrarse en la aplicación.
