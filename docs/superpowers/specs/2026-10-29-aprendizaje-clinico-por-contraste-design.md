# Aprendizaje clínico por contraste

Fecha: 2026-10-29.
Estado: diseño aprobado por el usuario. Se autorizó implementar una muestra y desplegarla en el VPS.

## Propósito

Aprender las enfermedades al comparar cómo se presentan ante un mismo síntoma. Reconocer qué dato distingue una alternativa de otra. Entender qué cambia en el sistema y cómo ese cambio explica la decisión inicial. Después, ampliar cada enfermedad mediante casos con factores que modifican el diagnóstico o el manejo.

La unidad de entrada es un eje clínico: un síntoma, signo, síndrome o motivo de consulta. Cada eje reúne diagnósticos diferenciales que se pueden confundir en esa presentación. La especialidad y el capítulo del libro sirven como referencias y filtros.

La capa 1 incluye comparación, mecanismo mínimo, diagnóstico y manejo inicial condicionado por el caso. La expansión vertical amplía este aprendizaje. Las tarjetas y la repetición espaciada permiten practicar después de aprender mediante la comparación.

## Situación actual

El repositorio contiene un piloto de diez tarjetas sobre coledocolitiasis y colangitis. La página muestra un mapa y después tarjetas individuales. Falta una etapa de aprendizaje con casos comparables visibles juntos. El mapa actual tiene categorías y patrones, pero no sustituye esta etapa.

La dirección visual existente es Cobalto. La aplicación prevista usa React y TypeScript. Los scripts de exportación usan Python con `uv`. Estas decisiones se mantienen como base técnica propuesta.

Al redactar este diseño, el archivo local `Edwino-1-221.pdf` contenía 221 páginas. Después, el usuario añadió `ENARM_Capa1_Completo.pdf`, una guía de 143 páginas con bloques de contraste y referencias al libro. La muestra usa sus páginas 17–18, 38 y 50. Este documento no sustituye la consulta de los capítulos originales del libro de 1,150 páginas.

## Requisitos indicados por el usuario

1. Agrupar los temas por síntomas clínicos para formar diagnósticos diferenciales.
2. Presentar un caso clínico de cada alternativa dentro del grupo.
3. Resaltar el dato discriminador con otro color dentro del caso.
4. Incluir discriminadores clínicos, epidemiológicos, de laboratorio o de imagen.
5. Construir casos parecidos que puedan corresponder a alternativas cercanas antes de valorar el discriminador.
6. Explicar dónde falla el sistema y relacionar esa falla con el manejo inicial.
7. Aumentar la complejidad del caso y mostrar qué factor modifica la decisión.
8. Permitir la expansión vertical de una enfermedad desde la comparación inicial.

## Flujo de aprendizaje propuesto

### 1. Elegir un eje clínico

La entrada muestra ejes como amenorrea secundaria, ictericia o dolor en hipocondrio derecho. Cada eje indica su pregunta central, las alternativas incluidas y la cobertura de fuentes. Los nombres son ejemplos de organización; todavía no constituyen un temario completo.

Una enfermedad puede pertenecer a varios ejes. Cada eje puede enlazar con varios capítulos. Se conserva la trazabilidad entre subtema del libro, enfermedad y eje para identificar omisiones.

### 2. Aprender al comparar casos

La vista inicial presenta casos juntos. En pantallas pequeñas se muestran en una secuencia con acceso directo a la comparación. Cada caso contiene:

- La misma presentación de entrada o una base clínica comparable.
- Una viñeta breve y suficiente para interpretar el patrón.
- El dato discriminador resaltado dentro de la viñeta.
- El diagnóstico hacia el que orientan los datos.
- La alternativa cercana y la razón para distinguirlas.
- Una explicación breve de qué función está alterada.
- La primera decisión y las condiciones que la justifican.

En esta etapa los diagnósticos y las explicaciones están visibles. El objetivo es aprender las diferencias antes de responder sin ayuda. El título del eje no revela una sola respuesta porque contiene varias alternativas.

El resaltado usa el mismo color ámbar para todas las enfermedades, con una etiqueta textual «Dato que distingue». El color no identifica el diagnóstico. Un discriminador puede ser una combinación mínima de hallazgos cuando un dato aislado no basta. Se explica si el hallazgo orienta, confirma o solo modifica la probabilidad.

### 3. Relacionar la función con la decisión

Cada caso muestra esta relación:

`Función alterada → efecto clínico o de estudio → decisión inicial → motivo de esa decisión`.

La explicación debe responder por qué cambia la conducta. El manejo inicial ya forma parte de la capa 1. Las dosis, tratamientos definitivos y detalles de seguimiento se amplían cuando el objetivo del caso los requiere.

No toda causa de un síntoma representa una falla. Por ejemplo, el embarazo puede explicar la ausencia de menstruación mediante un estado fisiológico. El modelo debe permitir «función o estado que explica el patrón».

### 4. Comparar las decisiones cuando cambia el caso

Una secuencia enlazada presenta un caso base y variantes. Cada variante declara:

| Elemento | Contenido obligatorio |
| --- | --- |
| Caso previo | Datos suficientes para reconstruir la situación anterior. |
| Cambio | Factor nuevo o dato modificado. |
| Datos conservados | Hallazgos que siguen iguales. |
| Consecuencia | Cambio en el diagnóstico probable, el estudio, la urgencia o el tratamiento. |
| Decisión anterior y nueva | Qué se habría hecho antes y qué corresponde valorar ahora. |
| Explicación | Por qué el factor modifica la decisión. |
| Fuente | Página o recomendación que sustenta la relación. |

Los factores pueden incluir gravedad, inestabilidad, embarazo, edad, comorbilidad, función renal, contraindicación, deseo reproductivo o respuesta al tratamiento. Solo se incluyen factores pertinentes al tema y respaldados por fuentes.

La complejidad docente y la gravedad clínica se registran por separado. Una contraindicación puede complicar la decisión sin aumentar la gravedad de la enfermedad. Los niveles docentes no reciben nombres de estadios clínicos salvo que exista una clasificación válida y citada.

Una microvariación cambia un solo dato. Un contraste puede cambiar varios y debe declararlos. Las ramas pueden modificar el diagnóstico, el manejo o ambos. La secuencia no supone que todos los pacientes progresan de una etapa a otra.

### 5. Ampliar una enfermedad

Desde cada caso se puede abrir la enfermedad y estudiar la confirmación diagnóstica, la clasificación aplicable, el tratamiento, las contraindicaciones, las complicaciones y el seguimiento. Los detalles se conectan con los factores que cambian una decisión. Siempre se puede volver al eje y comparar con las alternativas cercanas.

### 6. Practicar después de aprender

El modo de práctica conserva las tarjetas de ancla, contraste, microvariación, discriminador y primera decisión. En este modo se ocultan la respuesta, las etiquetas y los enlaces que puedan revelarla antes de contestar.

Como decisión de diseño propuesta, las primeras preguntas pueden mantener el discriminador resaltado. El usuario puede retirar esa ayuda para practicar cómo encontrarlo. La comparación inicial permanece disponible; no se impone un bloqueo entre modos.

La evaluación del contenido con Conservar, Ajustar o Descartar permanece separada del progreso de aprendizaje y de los registros de Anki.

## Ejemplo de estructura: amenorrea secundaria

Estos ejemplos son viñetas didácticas propuestas. Las expresiones en negrita representan el resaltado de la interfaz. La muestra enlaza los bloques pertinentes de `ENARM_Capa1_Completo.pdf` con guías externas. No sustituye criterios diagnósticos completos.

| Presentación compartida | Dato que distingue dentro del caso | Alternativa que se debe valorar |
| --- | --- | --- |
| Ausencia de menstruación tras ciclos previos | **Prueba de embarazo positiva** | Embarazo. |
| Amenorrea con restricción alimentaria y ejercicio intenso | **Estradiol bajo con FSH baja o normal**, tras excluir otras causas | Amenorrea hipotalámica funcional. |
| Amenorrea en una persona menor de 40 años | **FSH elevada**, con contexto clínico compatible | Insuficiencia ovárica primaria. |
| Amenorrea tras ciclos previos | **Prolactina persistentemente elevada**, con evaluación de causas | Hiperprolactinemia. |

La FSH es la hormona foliculoestimulante. El estradiol es un estrógeno. El contraste entre los casos segundo y tercero permite enseñar que un estradiol bajo puede ser compartido y que la respuesta de FSH ayuda a localizar el problema. Una prolactina elevada no identifica por sí sola un prolactinoma. Este conjunto es ilustrativo; el eje completo debe incluir las demás alternativas pertinentes. [ASRM: evaluación de amenorrea](https://www.asrm.org/practice-guidance/practice-committee-documents/current-evaluation-of-amenorrhea/).

Un ejemplo de vínculo entre mecanismo y manejo es la amenorrea hipotalámica funcional asociada a déficit energético: el abordaje incluye corregir el desequilibrio energético. Si se añade bradicardia grave, hipotensión o alteración de electrolitos, cambia la valoración del lugar y la urgencia de atención. La variante debe mostrar el dato nuevo y explicar por qué se debe valorar atención hospitalaria. [Endocrine Society: amenorrea hipotalámica](https://www.endocrine.org/clinical-practice-guidelines/hypothalamic-amenorrhea).

Para la insuficiencia ovárica primaria, la ampliación debe relacionar la deficiencia hormonal con las indicaciones y condiciones del tratamiento hormonal. Los criterios diagnósticos completos y la confirmación se toman de la guía aplicable. [Guía conjunta de insuficiencia ovárica](https://www.asrm.org/practice-guidance/practice-committee-documents/evidence-based-guideline-premature-ovarian-insufficiency--2024/).

## Datos necesarios para construir el contenido

El contenido debe representar estas entidades, con identificadores estables:

- Eje clínico: presentación, pregunta central, alternativas y fuentes.
- Enfermedad o estado: mecanismo mínimo y relaciones con otros ejes.
- Caso: base compartida, datos propios, diagnóstico y explicación.
- Discriminador: hallazgo, tipo, texto que se resalta y alcance diagnóstico.
- Decisión: acción, condiciones, razón y fuente.
- Variante: caso previo, campos modificados, datos conservados y decisión resultante.
- Fuente: archivo y página, o guía, fecha y sección; estado de revisión.
- Cobertura: subtema de origen, ejes asociados y estado de elaboración.

Las tarjetas se derivan del contenido revisado. El generador no crea hechos médicos ni asigna aprobación clínica. La nueva estructura debe convivir con el exportador actual o tener una migración explícita; no debe cambiar de forma silenciosa los identificadores de las diez tarjetas existentes.

## Organización del temario y fuentes

Primero se identifican los subtemas disponibles en la fuente. Después se relacionan con ejes clínicos y grupos diferenciales. Un registro de cobertura muestra los subtemas incluidos, pendientes y no contrastables mediante un síntoma. Los fundamentos transversales pueden enlazarse con varios ejes sin inventar un motivo de consulta.

Los casos son originales y señalan qué cifras son ilustrativas. Cada afirmación clínica y cada cambio de conducta debe tener una referencia. Las precisiones externas se distinguen del libro. Cuando una recomendación externa difiere del texto base, se muestra la diferencia y su fuente. El PDF y su texto extraído permanecen fuera del repositorio público, según la configuración actual.

La falta del libro completo no impide revisar el método con el extracto. Sí impide afirmar que el temario o el mazo cubren todas sus secciones.

## Criterios de aceptación del flujo

1. El usuario puede entrar por un motivo de consulta y ver varias alternativas.
2. La primera vista enseña mediante casos comparables antes de exigir una respuesta.
3. Cada alternativa tiene una viñeta con un discriminador visible y una explicación de su alcance.
4. El discriminador se interpreta junto con el contexto clínico.
5. Cada caso conecta función o estado, patrón y decisión inicial.
6. Cada variante muestra qué cambió y por qué modifica la decisión.
7. Las ramas separan gravedad clínica y complejidad de la decisión.
8. La ampliación vertical parte de la enfermedad elegida y conserva el regreso al contraste.
9. La práctica oculta las respuestas y permite retirar el resaltado.
10. La cobertura y las fuentes permiten identificar contenido pendiente sin declarar una cobertura completa falsa.

## Decisiones propuestas para la siguiente implementación

- Conservar la dirección visual Cobalto y el resaltado ámbar existente.
- Añadir la vista de aprendizaje por contraste antes del repaso individual.
- Usar los bloques de amenorrea del nuevo PDF y guías externas. Distinguirlos del extracto original disponible.
- Elegir el primer eje de implementación entre los temas que tengan fuentes suficientes. El piloto biliar permite reutilizar trabajo existente, pero sus dos diagnósticos actuales no representan un eje completo.
- Revisar un eje completo antes de ampliar de forma masiva el contenido.
- Conservar el piloto de diez tarjetas biliares y sus identificadores. La revisión clínica del contenido permanece pendiente.
