# Cobertura completa del libro en dos familias de tarjetas

El usuario autorizó generar todas las tarjetas y pidió comprobarlas dos veces. La instrucción sustituye el alcance anterior de muestra.

## Fuentes

- Libro completo: `/home/musel/Github/enarm-contraste/Edwino.pdf`, 1,150 páginas, SHA-256 `c6540ab02b29b941f4f8aff3d793a21988f35ad8f6cf963f0292bb0a64835703`.
- Guía de agrupación: `ENARM_Capa1_Completo.pdf`, 34 secciones y 355 bloques. Sus respuestas contienen 730 apariciones de temas y 719 combinaciones únicas de nombre/páginas.
- Referencia Eje Clínico: `Gineco_Obstetricia_Adulto_Capa6_EjeClinico (3).apkg.zip`, nota de amenorrea `1779750677491`.
- Referencia Patrones Madre: `Patrones_Madre_Shock_1 (2).apkg.zip`, 13 notas, cuatro niveles.

Los mazos fijan el formato pedagógico. El libro completo fija el contenido. No se deben convertir sus asociaciones breves en reglas absolutas. Las páginas 164, 166 y 203 no tienen texto extraíble; deben comprobarse visualmente.

## Archivo de autoría por sección

Ruta: `content/sections/NN.json`. Cada autor solo escribe sus secciones. No modifica código ni otras secciones. No hace commits; el coordinador valida y sube cada unidad.

```json
{
  "id": "01",
  "title": "ACLS",
  "blocks": [{
    "id": "01.01",
    "title": "Paciente colapsado: primer árbol",
    "common_problem": "Presentación compartida, sin resolver el diferencial.",
    "mother": {
      "cue": "Una descripción funcional que permita reconocer el patrón principal.",
      "answer": "Función, problema o patrón principal.",
      "explanation": "Por qué ese patrón organiza el grupo."
    },
    "topics": [{
      "id": "01.01-01",
      "name": "Nombre exacto del tema en el inventario",
      "source_pages": [15, 16, 17],
      "pattern": "Una viñeta original breve, suficiente y sin el nombre de la respuesta.",
      "key_discriminator": "Una frase que aparece literalmente dentro de pattern",
      "mechanism": "La función alterada o el objetivo, con el mecanismo mínimo para distinguir.",
      "findings": [{"mechanism": "Elemento causal", "finding": "Hallazgo que produce"}],
      "initial_action": "Primera acción útil y condicionada al caso, hasta 45 palabras.",
      "action_reason": "Por qué corresponde esa acción.",
      "modifiers": [{"factor": "Dato que cambia", "action": "Cómo cambia la decisión", "reason": "Por qué"}],
      "limits": "Límite importante del patrón o del alcance de la fuente.",
      "evidence": [{"page": 15, "quote": "Fragmento exacto y breve del texto de esa página"}],
      "source_gaps": []
    }]
  }]
}
```

## Reglas de contenido

1. Conservar todos los bloques e identificadores de `/tmp/enarm-authoring/section-NN-input.json` y todos sus temas. Un tema repetido en otro contexto conserva su aparición.
2. Leer las páginas completas del tema en `/tmp/enarm-authoring/pages/NNNN.txt`. Abrir el PDF si falta texto o si la cifra o tabla es ambigua. No usar solo la guía automática.
3. El patrón debe ser una viñeta de 20–45 palabras. El discriminador debe ser una frase breve y literal de la viñeta. Puede ser clínico, epidemiológico, de laboratorio o de imagen.
4. Mecanismo de 15–35 palabras. Uno a tres pares de mecanismo/hallazgo. Acción inicial de hasta 45 palabras. Una a tres modificaciones del manejo, si la fuente las sostiene.
5. Cada tema debe tener evidencia breve del libro. Incluir una evidencia para reconocimiento y otra para acción, cuando sean partes distintas. Las citas se comprobarán contra la página normalizada.
6. No inventar dosis, umbrales, contraindicaciones o afirmaciones de confirmación. Evitar absolutos que la fuente no sostiene. Si una recomendación es dudosa o parece desactualizada, comprobar una fuente primaria actual y registrar la precisión.
7. Si el tema es un fundamento, vacuna, cálculo o procedimiento, adaptar el patrón a su función u objetivo. La primera acción puede ser identificar, estudiar, calcular o prevenir. No forzar una enfermedad o tratamiento.
8. Si no hay información suficiente, registrar el problema concreto en `source_gaps`; no rellenar con generalidades. El coordinador debe resolverlo antes de declarar cobertura completa.
9. No copiar el HTML, scripts o CSS de los mazos. No publicar PDF, texto bruto extraído ni paquetes originales.
10. Cada sección tendrá una revisión cruzada posterior por un autor distinto. La revisión profesional clínica permanece pendiente y se declara como tal.

## Familias generadas desde la misma autoría

- **Eje Clínico:** una tarjeta por bloque. Frente: presentación compartida y lista de viñetas. Reverso: correspondencia numerada con diagnósticos, discriminadores y primera decisión.
- **Patrones Madre N1:** una tarjeta por bloque. Descripción funcional → patrón principal.
- **Patrones Madre N2:** una por aparición de tema. Mecanismo y presentación → nombre.
- **Patrones Madre N3:** una por aparición de tema. Lista de mecanismos → lista de hallazgos.
- **Patrones Madre N4:** una por aparición de tema. Caso y factores → acciones de manejo con su razón.

Con el inventario actual: 355 tarjetas Eje Clínico y 2,545 Patrones Madre. Estos conteos son objetivos verificables, no una afirmación de contenido ya terminado.

## Entrega

Dos mazos completos `.apkg`, exportación estructurada y biblioteca web por sección y bloque. Frentes sin respuestas filtradas por títulos o fuentes. Todas las tarjetas deben poder estudiarse por separado. El sitio debe indicar las referencias del libro y el estado real de revisión y cobertura.
