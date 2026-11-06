# Capas de estudio y progreso independiente

Estado: propuesta para aprobación. Este archivo define el cambio solicitado el 6 de noviembre de 2026. Todavía no autoriza una implementación, una mezcla de ramas o una publicación en producción.

Revisión independiente del diseño: completada el 6 de noviembre de 2026 por `review_layer_design`. El revisor comprobó la migración, la conservación del progreso, las tarjetas personales y el alcance clínico. No encontró preguntas importantes pendientes para preparar el plan de implementación.

## Objetivo

Separar cuatro espacios diarios de estudio. Cada espacio conserva sus temas nuevos, sus repasos y su progreso. La capa 1 entrena el reconocimiento del patrón típico. La capa 2 entrena sus variaciones, sus diagnósticos cercanos, su gravedad y las decisiones que cambian el manejo inicial.

Las capas organizan el aprendizaje. No obligan a estudiar en un orden. El estudiante puede entrar en la capa 2 sin terminar la capa 1.

La petición incluye toda la biblioteca actual. El nuevo tema de trastornos hidroelectrolíticos debe aparecer en ambas capas. Una muestra de un solo tema no constituye la entrega completa.

## Punto de partida comprobado

- La rama `main`, en el commit `debaaa5`, contiene 34 secciones, 355 bloques y 2,900 tarjetas publicadas.
- `app/src/App.tsx` muestra Hoy, Biblioteca, Mi avance y Explorar casos.
- `CoachState` contiene un solo plan, una asignación por fecha y un historial compartido. Mostrar cuatro copias del componente actual no separaría el progreso.
- Las tarjetas personales usan identificadores `created/<uuid>`. El plan actual puede incluirlas con las tarjetas publicadas.
- SQLite conserva el estado confirmado del perfil. IndexedDB conserva su copia. Las revisiones de estado protegen las escrituras concurrentes.
- Los casos diagnósticos actuales ya tienen memoria propia. No deben recibir un historial nuevo por cambiar de pestaña.
- Hay otra rama en otro directorio de trabajo: `feat/clinical-decision-paths`. Esta propuesta parte de `main`. No incorpora esa rama ni cambia sus archivos. Si se integra antes de implementar esta propuesta, se debe revisar la compatibilidad de sus casos y conservar sus identificadores.

## Espacios visibles

| Pestaña principal | Tarjetas incluidas | Sesiones |
| --- | --- | --- |
| Hoy-capa 1 | Biblioteca actual y nuevo tema hidroelectrolítico de capa 1 | Temas nuevos y Repasos |
| Hoy-capa 2 | Casos y tarjetas nuevos de capa 2 | Temas nuevos y Repasos |
| Capa 1 creadas | Tarjetas personales procedentes de capa 1 | Temas nuevos y Repasos |
| Capa 2 creadas | Tarjetas personales procedentes de capa 2 | Temas nuevos y Repasos |

Las cuatro son pestañas principales. No son filtros dentro de Hoy. Biblioteca, Mi avance y Explorar casos siguen disponibles. La navegación se ajusta a pantallas pequeñas sin ocultar la pestaña activa.

Cada espacio diario muestra el nombre completo. Usa la interacción actual para revelar, calificar, deshacer, pausar y continuar con tarjetas extra. Conserva los temporizadores, las sesiones de descanso y las opciones de sonido y movimiento.

Decisiones propuestas por el implementador:

- Usar `#hoy-capa-1`, `#hoy-capa-2`, `#capa-1-creadas` y `#capa-2-creadas`.
- Mantener `#hoy` y la entrada sin fragmento como accesos a Hoy-capa 1.
- Mostrar un selector de estos mismos cuatro espacios en Mi avance. Las estadísticas iniciales corresponden al espacio desde el que se abrió esa vista. Un resumen general puede sumar respuestas sin duplicarlas.
- Biblioteca permite elegir capa y tarjetas publicadas o creadas. Abrir o calificar desde Biblioteca afecta al mismo progreso que la pestaña correspondiente.
- Los subtests usan un solo espacio a la vez. No mezclan las dos capas ni tarjetas publicadas y personales por omisión.
- Un espacio nuevo sin plan muestra la configuración actual del plan. No inicia una sesión de forma automática.
- Las pestañas de tarjetas creadas muestran una explicación breve cuando están vacías. No requieren tarjetas de ejemplo.

## Qué permanece en la capa 1

Se conservan las 34 secciones actuales y sus tarjetas. Se conservan sus identificadores, textos, hashes de sección, referencias y calendarios de repaso. Se conservan los identificadores de Anki de los dos mazos actuales.

Los cambios visibles solicitados son el nombre Hoy-capa 1, la salida de las tarjetas personales a su propia pestaña y la incorporación del nuevo tema. No se amplían los reversos actuales para introducir la capa 2.

El nuevo tema se añade como suplemento. No se reescribe el inventario original para simular que forma parte de los PDF de origen. El hash de un manifiesto que reúna contenido nuevo puede cambiar. Los hashes y las identidades del contenido anterior no cambian.

## Progreso independiente

Cada espacio tiene su propio plan, meta diaria, selección de secciones y bloques, memoria FSRS, historial, configuración de sesiones, marcas de estudio, sesiones, avisos de meta y opción de deshacer. FSRS es el sistema que calcula la fecha del siguiente repaso.

Estudiar una tarjeta en un espacio no responde otra tarjeta de otro espacio. Una relación entre conceptos no comparte memoria de repaso. Suspender una tarjeta conserva su contenido y su historial.

La cuenta y el código privado de progreso siguen siendo únicos para el estudiante. La copia JSON incluye los cuatro espacios. No se crean cuatro cuentas ni cuatro códigos.

### Modelo de almacenamiento propuesto

Introducir un estado de perfil con `version: 2`, una revisión global y cuatro espacios con claves estables: `capa1`, `capa2`, `creadas1` y `creadas2`.

El perfil contiene el catálogo privado de tarjetas creadas. Cada tarjeta indica `layer: 1 | 2`, su sección y su tarjeta de origen. Cada espacio contiene su estado de estudio. Las tarjetas personales solo entran en `creadas1` o `creadas2`. No entran en las colas de tarjetas publicadas.

El índice de contenido identifica la capa. Los niveles actuales de Patrones Madre no se interpretan como capas. Las tarjetas nuevas de capa 2 tienen un espacio de identificadores propio. Una tarjeta enlazada desde otra sección mantiene una sola identidad y un solo calendario dentro de su espacio.

La API mantiene una sola transacción por actualización de perfil. La revisión global protege también las actualizaciones de espacios distintos. Cada escritura cambia solo el espacio correspondiente y los campos compartidos necesarios. Un conflicto exige cargar el estado actual. No permite reemplazar otro espacio con una copia antigua.

### Migración del progreso existente

La migración es determinista y solo se aplica una vez. Se comprueba con perfiles sintéticos y bases locales temporales. No se usa el perfil real para pruebas.

1. Leer y validar el estado anterior completo.
2. Conservar una copia recuperable del estado anterior en el servidor antes de confirmar la migración.
3. Asignar las tarjetas publicadas y los casos diagnósticos existentes a `capa1`.
4. Asignar todas las tarjetas personales existentes a la capa 1 y su estudio a `creadas1`.
5. Conservar los identificadores, las memorias FSRS, las fechas, las respuestas, las marcas y las suspensiones. No volver a calificar tarjetas ni recalcular sus intervalos.
6. Separar cada asignación diaria por sus identificadores. Conservar sus costes y las diferencias entre tarjetas nuevas, asignadas y extra. Separar el historial sin duplicar respuestas.
7. Conservar el registro original de metas e historial como archivo de migración. No inventar un reparto de sesiones antiguas que no identifican sus tarjetas. Mostrarlas como sesiones anteriores a la separación en el resumen general.
8. Mantener la opción de deshacer anterior solo en el espacio de su última respuesta. Los otros espacios empiezan sin una acción para deshacer.
9. Mantener el plan publicado en `capa1`, con sus secciones y preferencias. Crear un plan independiente de tarjetas personales a partir de las preferencias anteriores. Su identificador es distinto. Un filtro antiguo de bloques publicados no debe volver inaccesibles las tarjetas personales.
10. Crear `capa2` y `creadas2` vacíos, sin respuestas ni metas completadas.
11. Confirmar el nuevo estado en el servidor. Solo después actualizar la copia local y la interfaz.

Las metas antiguas combinadas se conservan en el archivo original. Para el día de la migración, las colas y los objetivos activos se separan por tarjeta. El tiempo asignado se distribuye según los costes de esas tarjetas, sin duplicar el presupuesto original. Si un espacio no tenía tarjetas asignadas, empieza sin una meta asignada para ese día. Puede ofrecer tarjetas extra según su plan.

Los identificadores históricos que no se puedan resolver se conservan en capa 1 y se señalan como contenido no disponible. No se borran para hacer pasar la validación. Un tipo incorrecto de dato bloquea la migración y permite exportar la copia original.

La API acepta copias antiguas para importación mediante la misma migración. Una escritura ordinaria de un cliente antiguo no puede sustituir un perfil ya migrado. El servidor la rechaza con un mensaje que pide actualizar la página. Se mantienen los reintentos seguros y la copia previa a importación.

## Tarjetas creadas

Añadir flashcard sigue disponible durante el estudio, en Biblioteca y en los subtests de flashcards.

La tarjeta hereda la capa y la sección de su origen. Una tarjeta creada desde otra tarjeta personal conserva esa capa. Al guardarla, entra en Capa 1 creadas o Capa 2 creadas. Guardarla no responde la tarjeta de origen ni modifica su meta diaria.

La capa se deriva de un origen válido. No se deduce del título ni se acepta una contradicción entre capa y origen. Las tarjetas antiguas reciben capa 1 durante la migración. Se conserva el texto personal sin interpretar HTML.

Una tarjeta personal nueva entra en la reserva de temas nuevos después de la confirmación del servidor. Su primera calificación inicia su propio calendario de repaso. Se conservan la suspensión, la reintegración y la recuperación del borrador cuando falla el guardado.

## Contenido de la capa 2

### Cobertura

Incluir las 34 secciones actuales y la nueva sección hidroelectrolítica. Preparar una matriz de cobertura por sección, bloque y concepto de capa 1. Cada concepto clínico indica sus variaciones útiles, sus vecinos diagnósticos y las decisiones nuevas que se entrenan.

Un fundamento, una vacuna o un procedimiento no necesita un subtipo diagnóstico artificial. En esos temas, la capa 2 usa contexto, limitaciones, contraindicaciones o decisiones relacionadas cuando las fuentes las sostienen. La matriz registra la adaptación.

Cada sección debe tener más escenarios clínicos distintos que las viñetas originales de esa sección. El conteo usa viñetas únicas, no varias preguntas sobre el mismo texto. La cobertura también debe incluir las diferencias de gravedad y manejo que sean pertinentes. Un conteo alto no sustituye esa revisión.

No se fija un número idéntico de tarjetas por enfermedad. El paquete de ocho funciones propuesto por el usuario es una guía editorial, no una cuota. El total final sale de la matriz revisada. No se declara cobertura completa mientras falten secciones o decisiones previstas.

### Funciones de las tarjetas

| Función | Decisión que entrena |
| --- | --- |
| Ancla conocida | Recuperar el patrón central sin sustituir la tarjeta original |
| Otra presentación | Reconocer el diagnóstico con una presentación diferente |
| Presentación incompleta | Determinar qué se puede concluir y qué queda incierto |
| Variante o subtipo | Identificar una distinción que cambia evaluación, pronóstico o conducta |
| Contraste horizontal | Separar el diagnóstico de un vecino cercano |
| Cambio decisivo | Explicar qué dato cambia la conclusión o el manejo |
| Dato faltante | Elegir la siguiente pregunta, exploración o prueba útil |
| Gravedad o complicación | Identificar la prioridad y la primera acción apropiada |

Cada tarjeta tiene un objetivo principal y un reverso breve. No basta cambiar el nombre o la edad del paciente. Un dato nuevo debe cambiar una probabilidad, una clasificación, una prueba, una prioridad o una acción.

Separar dos preguntas cuando sea necesario: cuál diagnóstico es más probable y cuál es peligroso omitir. Separar también la certeza diagnóstica de la gravedad. Algunas respuestas deben reconocer un síndrome sin atribuirle una causa que los datos no permiten demostrar.

La explicación del mecanismo se limita a lo que permite entender el discriminador. Las dosis, los umbrales y las velocidades de corrección solo se incluyen con una fuente comprobada y el contexto necesario.

### Ejes clínicos y relaciones entre secciones

Conservar Ejes clínicos y tarjetas individuales. Un eje de capa 2 puede reunir diagnósticos de secciones distintas si comparten un problema clínico real.

Cada caso tiene una sección principal y relaciones explícitas con los otros conceptos. El eje se atribuye a una sección principal. No se duplica su tarjeta para aumentar el inventario de varias secciones. Las relaciones permiten descubrirlo desde las secciones relacionadas.

El reverso compara datos a favor, datos en contra, dato faltante y primera decisión. No presenta listas extensas sin contraste. Las etiquetas de subtipo, contraste, mecanismo, dato faltante y gravedad permiten filtrar la práctica.

## Trastornos hidroelectrolíticos

Añadir la sección 35 como suplemento independiente. La siguiente división es una propuesta del implementador:

| Bloque | Capa 1 | Capa 2 |
| --- | --- | --- |
| 35.01 Volumen y tonicidad | Reconocer el problema de agua y volumen | Separar tonicidad, volumen circulante y contexto clínico |
| 35.02 Hiponatremia | Reconocer el patrón y sus señales de peligro | Variantes, causas cercanas, pruebas discriminadoras y cambios de prioridad |
| 35.03 Hipernatremia | Reconocer el déficit relativo de agua | Pérdidas, aporte de sodio, evolución y decisiones según perfusión y contexto |
| 35.04 Hipopotasemia | Reconocer manifestaciones y factores causales | Pérdidas frente a redistribución, gravedad y causas de respuesta insuficiente |
| 35.05 Hiperpotasemia | Reconocer el patrón y la urgencia | Resultado espurio, contexto renal o farmacológico y decisiones iniciales distintas |
| 35.06 Hipocalcemia | Reconocer el patrón neuromuscular | Interpretación del calcio, causas y cambios de gravedad |
| 35.07 Hipercalcemia | Reconocer manifestaciones compatibles | Mecanismos, diagnósticos cercanos y prioridades según contexto |
| 35.08 Magnesio | Reconocer sus alteraciones relevantes | Relaciones con potasio, calcio, fármacos y función renal |
| 35.09 Fosfato y realimentación | Reconocer alteraciones y contexto de riesgo | Cambios clínicos, datos faltantes y prevención o manejo inicial según el caso |
| 35.10 Problemas combinados | Reconocer que hay más de una alteración | Contrastar causas y ordenar las decisiones iniciales |

Los ejemplos incluyen relaciones con nefrología, endocrinología, cardiología, neurología, nutrición y toxicología cuando proceda. Las poblaciones pediátricas, neonatales y obstétricas requieren fuentes propias. No se extrapolan esquemas de adultos a estas poblaciones.

El equilibrio ácido-base puede servir como dato del caso cuando cambia la decisión. Un curso completo nuevo de trastornos ácido-base queda fuera de esta sección propuesta.

## Fuentes y revisión clínica

La capa 2 y el suplemento hidroelectrolítico se escriben desde fuentes clínicas primarias actuales. No se generan al ampliar automáticamente las frases de capa 1.

Comprobar fuentes mexicanas oficiales y fuentes internacionales por tema. Registrar la institución, el documento, la versión publicada, el ámbito, la URL, la fecha de consulta y el apartado o recomendación que sustenta la decisión. Distinguir fecha de publicación de fecha de acceso y de fecha de revisión prevista.

Para México, buscar GPC, algoritmos y documentos oficiales de Secretaría de Salud, IMSS y otras instituciones pertinentes. Para recomendaciones internacionales, buscar las sociedades y organismos que correspondan al tema. La matriz debe registrar la búsqueda mexicana aunque no exista una guía nacional reciente para esa decisión.

Una guía mexicana antigua no se presenta como una actualización reciente. Si no se encuentra una fuente mexicana reciente, se declara esa limitación. Una recomendación internacional no implica disponibilidad del recurso en México. Si las fuentes difieren, el reverso identifica el contexto de cada recomendación y la razón de la elección editorial.

### Fuentes iniciales localizadas el 6 de noviembre de 2026

Estas referencias sirven para preparar la investigación del tema nuevo. No constituyen la validación de todas sus recomendaciones ni de las otras 34 secciones.

- [IMSS: ficha IMSS-648-13, Hipernatremia](https://www.imss.gob.mx/node/85249). La ficha oficial enlaza los documentos de evidencia y referencia rápida. El identificador corresponde a la guía de 2013. No se describe como guía nueva de 2026.
- [UK Kidney Association: Hyperkalaemia](https://guidelines.ukkidney.org/hyperkalaemia/). La página oficial indica actualización de julio de 2026 y revisión prevista para octubre de 2026. Se debe comprobar si hay una versión posterior antes de cerrar la autoría.
- [Society for Endocrinology: hiponatremia sintomática, documento de 2022](https://www.endocrinology.org/media/xhrhxhxm/emergency-management-of-severe-and-moderately-severely-symptomatic-hyponatraemia-in-adult-patients-2022.pdf). Fuente localizada para el manejo de urgencia en adultos. La apertura directa devolvió HTTP 403. Su contenido todavía no está validado. Se debe obtener acceso a una copia oficial antes de usarlo.
- [Society for Endocrinology: hipocalcemia aguda](https://pmc.ncbi.nlm.nih.gov/articles/PMC5314808/). Documento primario de la sociedad, publicado en 2016. Se debe buscar una actualización aplicable antes de usarlo.

### Contrato de autoría del contenido nuevo

Crear archivos de autoría distintos de `content/sections/01.json` a `34.json`. El contrato actual del libro sigue vigente para esos archivos. Añadir un contrato para contenido basado en guías, con los mismos controles de evidencia y revisión, sin exigir páginas de un libro que no contiene el tema.

Ubicaciones propuestas: `content/layers/capa1/35.json` y `content/layers/capa2/NN.json`. Usar directorios paralelos para fuentes comprobadas y revisiones. Los nombres definitivos del esquema quedan a cargo del implementador.

Cada escenario registra una identidad estable, sección y bloque principales, relaciones con conceptos de capa 1, función educativa, viñeta, pregunta, respuesta, discriminador, razonamiento breve, gravedad pertinente, primera acción condicionada al caso, límites y fuentes que sostienen sus afirmaciones.

Un autor distinto revisa cada sección. La aprobación registra el hash exacto, los escenarios revisados, las fuentes comprobadas y los problemas resueltos. Una modificación invalida la aprobación. Un agente distinto puede hacer la revisión editorial independiente. No se presenta como revisión clínica profesional.

La compilación impide publicar secciones con evidencia incompleta, referencias no comprobadas o revisiones ausentes o antiguas. La aplicación muestra el estado real de revisión. La revisión clínica profesional sigue pendiente.

No publicar PDF, extracciones, bases de datos, credenciales ni archivos privados. En los archivos públicos solo se incluyen contenido original, referencias y evidencia breve permitida.

## Generación y compatibilidad

Extender la compilación documentada. No editar `app/public/study/`, `dist/` ni `dist-server/` a mano.

Mantener la generación del contenido original y añadir manifiestos, índices y archivos por sección para el suplemento y la capa 2. Cargar una sección a la vez. Verificar las identidades y las correspondencias entre índice, manifiesto y tarjetas. La carga de capa 1 no necesita descargar toda la capa 2.

Las referencias y los nombres diagnósticos de la respuesta no deben aparecer como pistas involuntarias en el anverso. Las fuentes se muestran al revelar la respuesta. Los enlaces entre conceptos no duplican el progreso.

Los dos mazos Anki actuales se conservan. Esta petición cambia el estudio web. Crear nuevos paquetes Anki de capa 2 o exportar tarjetas personales no es un requisito de esta propuesta.

## Verificación necesaria para implementar

- Probar la migración de un perfil anterior sin tarjetas personales y otro con tarjetas personales estudiadas, nuevas, suspendidas y vencidas.
- Comparar el número de respuestas, los identificadores, las memorias y las fechas antes y después. Cada respuesta pertenece a un solo espacio.
- Probar metas del día mixtas, días anteriores, tarjetas extra, filtros antiguos, sesiones sin detalle por tarjeta y la opción de deshacer.
- Probar importación y exportación antiguas y nuevas. Verificar la recuperación del estado previo.
- Probar reintentos, conflictos entre pestañas, acceso desde otro dispositivo y rechazo de escrituras antiguas después de migrar.
- Probar el guardado fallido. La interfaz no avanza ni pierde el borrador.
- Probar que cada pestaña ofrece solo sus tarjetas nuevas y sus repasos. Cambiar de pestaña y recargar conserva la pregunta y el progreso de la sesión según la conducta actual.
- Probar creación desde ambas capas y desde Biblioteca y subtests. Las tarjetas llegan al espacio personal correcto sin responder su origen.
- Probar calificación desde Biblioteca y Mi avance. No crear calendarios paralelos para la misma identidad.
- Verificar la navegación con teclado y en pantalla pequeña.
- Comparar los hashes y los identificadores de las 34 secciones originales y sus mazos.
- Verificar la matriz de cobertura de las 35 secciones, el incremento de viñetas únicas por sección, las fuentes, los contrastes y los cambios reales de decisión.
- Ejecutar pruebas de Python para el contenido y la compilación, `npm run test:unit` para el motor y la API, y las pruebas de navegador afectadas.
- Ejecutar `npm run check` antes de la revisión final de la implementación. Usar bases y servidores locales temporales.

## Unidades de entrega propuestas

1. Migración y separación del estado de estudio, con compatibilidad y pruebas.
2. Cuatro pestañas, colas independientes, creación por capa y filtros en Biblioteca y Mi avance.
3. Contrato y compilación del contenido basado en guías.
4. Trastornos hidroelectrolíticos completos en ambas capas, con fuentes y revisión independiente.
5. Capa 2 de las 34 secciones restantes, por unidades de autoría y revisión. La interfaz indica la cobertura real durante el desarrollo.
6. Verificación completa y pull request actualizado con la cobertura final.

Cada unidad se comprueba antes de hacer commit. Cada commit usa Conventional Commits y se sube a la rama de trabajo. No se declara completa la petición al terminar solo las pestañas o el primer tema.

La implementación mantiene React, TypeScript, Node, SQLite, npm y uv. La elección de componentes, las funciones puras de migración y la distribución de pruebas quedan a cargo del implementador dentro de este contrato.

## Estado de la aprobación

Pendiente de aprobación del usuario. La revisión independiente del diseño está completa. La aprobación permite preparar el plan e implementar esta petición. La publicación en producción requiere autorización para esta tarea.
