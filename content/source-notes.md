# Fuentes y procedencia

## Biblioteca del libro completo

El usuario añadió `Edwino.pdf`, de 1,150 páginas, con SHA-256 `c6540ab02b29b941f4f8aff3d793a21988f35ad8f6cf963f0292bb0a64835703`. La agrupación procede de `ENARM_Capa1_Completo.pdf`, de 143 páginas. El inventario conserva 34 secciones, 355 bloques, 730 apariciones y 719 combinaciones únicas de tema y páginas. Sus referencias cubren las 1,150 páginas físicas del libro.

La autoría se conserva en `content/sections/`. Cada tema tiene viñeta, discriminador, mecanismo, hallazgos, primera acción, modificadores, límites y evidencia. Las citas se cotejan con el texto de la página. Las páginas 164, 166 y 203 requieren inspección visual por falta de texto extraíble. Las páginas 579 y 872 requieren inspección de los diagramas de medios de cultivo y ojo rojo. Autor y revisor comprobaron visualmente esos diagramas.

La guía tiene referencias incorrectas y el libro contiene afirmaciones antiguas o contradictorias. Las secciones registran las correcciones. Las precisiones clínicas actuales usan fuentes primarias identificadas en cada tema. La referencia externa se distingue de las páginas del libro.

Las revisiones independientes se conservan en `content/reviews/`. Incluyen todos los identificadores de temas revisados, páginas comprobadas, fuentes externas y el hash de la sección. La validación de fuentes se conserva en `content/source-validation.json`. El compilador exige coincidencia de los hashes para publicar. La revisión clínica profesional permanece pendiente.

La biblioteca web y los paquetes Anki se generan desde la misma autoría. Eje Clínico contiene una tarjeta por bloque. Patrones Madre contiene una tarjeta de nivel 1 por bloque y una de cada nivel 2–4 por aparición de tema. La auditoría abre los paquetes reales y comprueba las correspondencias. Los archivos generados no incluyen las citas de evidencia ni el texto bruto del libro; muestran las referencias y las precisiones externas.

## Primera muestra web

El usuario añadió `ENARM_Capa1_Completo.pdf` el 29 de octubre de 2026. Se usó para construir la muestra.

- Archivo: 143 páginas; SHA-256 `b33c5d3e9bf54b386892be63d2937050f6e50196d831f076df2b0e24702ff052`.
- PDF, pp. 17–18: bloque 05.03, fiebre e ictericia con dolor.
- PDF, p. 38: bloque 10.10, amenorrea y secreción láctea.
- PDF, p. 50: bloques 14.01 y 14.02, amenorrea primaria/secundaria y causas anovulatorias.
- Se comprobó visualmente la página 50 para verificar encabezados, discriminadores y referencias.

Este documento es una guía preparada con bloques y referencias al libro. Sus 143 páginas no son el original completo de 1,150 páginas. La web distingue el número de página del PDF de las páginas del libro indicadas dentro de él. Para la vía biliar también se usó el extracto original disponible, `Edwino-1-221.pdf`, pp. 135 y 138.

Las viñetas son originales y las cifras son ilustrativas. Los mecanismos, criterios y decisiones añadidos se relacionan con guías externas en `app/src/content.ts` y `app/src/samples.ts`. La app muestra esas fuentes. No se atribuyen a capítulos originales que no se consultaron.

La muestra contiene seis diagnósticos/estados, seis situaciones de decisión y dieciséis tarjetas. Incluye seis tarjetas nuevas de amenorrea y las diez tarjetas biliares existentes. Los identificadores de estas diez tarjetas se conservan. El alcance es parcial y la revisión clínica profesional está pendiente.

Los PDF y sus textos extraídos no se publican en Git ni se copian al servidor.

## Mazos Anki compartidos después de la primera publicación

Se inspeccionaron los modelos y las notas de cinco archivos aportados por el usuario:

| Mazo | Notas | Uso en el rediseño |
| --- | ---: | --- |
| Ejes_Diagnosticos_Adulto (2) | 188 | Organizar la entrada por problemas clínicos y función. |
| Ginecologia_Amenorreas_Primarias_1_y_2_Capa1 | 23 | Fundamentos y distinciones de amenorrea primaria; no se añade ese eje en esta muestra. |
| Ginecologia_Amenorreas_Secundarias_1_y_2_Capa1 | 29 | Contraste de FSH/estradiol y localización central frente a ovárica. |
| Gineco_Obstetricia_Adulto_Capa6_EjeClinico (3) | 30 | Referencia principal para el mapa síntoma, patrón y diagnóstico. Se examinó su nota de amenorrea. |
| Patrones_Madre_Shock_1 (2) | 13 | Referencia principal para conectar función, manifestaciones y manejo. Se revisaron sus cuatro niveles. |

La prioridad de los dos últimos procede del mensaje de la hermana en la captura que adjuntó el usuario. La interfaz añade un mapa breve de contraste y permite abrir el razonamiento de cada caso. «El método» explica estas referencias.

Los mazos son referencias de estructura pedagógica. Sus asociaciones breves no se copian como reglas diagnósticas absolutas. Por ejemplo, la muestra mantiene la diferencia entre hiperprolactinemia y prolactinoma. No se importan sus scripts o HTML ni se publican los archivos originales.
