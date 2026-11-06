# ENARM Contraste

[Estudiar en enarm.musel.dev](https://enarm.musel.dev/).

Biblioteca de estudio en español. Agrupa los temas por problemas clínicos para comparar casos, reconocer el dato que distingue y conectar el mecanismo con el manejo.

## Tu plan diario

La página abre en **Hoy-capa 1**. Hay cuatro espacios de estudio:

| Pestaña | Función |
| --- | --- |
| **Hoy-capa 1** | Reconocer el patrón típico. Conserva las tarjetas y la memoria de estudio de la biblioteca original. |
| **Hoy-capa 2** | Distinguir variantes, diagnósticos cercanos, datos faltantes y cambios de gravedad o manejo inicial. |
| **Capa 1 creadas** | Estudiar las flashcards personales creadas desde la capa 1. |
| **Capa 2 creadas** | Estudiar las flashcards personales creadas desde la capa 2. |

Cada espacio tiene plan, temas nuevos, repasos, filtros y progreso propios. Puedes cambiar de espacio sin completar otra capa. Elige una fecha objetivo o los minutos que puedes estudiar cada día. Selecciona los temas y formatos. La estimación incluye tarjetas nuevas y repasos FSRS. Supone respuestas «Bien» y se ajusta con tus tiempos activos.

La pestaña del espacio abre la primera tarjeta asignada. Revelar la respuesta no suma progreso. Califica con **Otra vez**, **Difícil**, **Bien** o **Fácil**. Cada respuesta guardada hace avanzar su meta diaria y programa su repaso. La meta se conserva al recargar. Las tarjetas extra no cambian su tamaño. Puedes deshacer la última respuesta del espacio.

La migración conserva los identificadores, respuestas y fechas de repaso anteriores. Mueve las flashcards personales existentes a **Capa 1 creadas**. Conserva una copia anterior a la separación. Los registros de sesiones que mezclaban tarjetas se muestran como archivo histórico; no se atribuyen a una capa sin datos. Las tarjetas antiguas que ya no están en el inventario conservan su historial como contenido no disponible.

La **primera vuelta** cuenta tarjetas practicadas al menos una vez. No indica dominio. Los repasos continúan después. Las animaciones respetan la preferencia de movimiento reducido. El sonido está apagado al inicio.

El plan, las respuestas, los repasos y las metas se guardan en una base SQLite privada en el VPS. La primera visita después de la actualización sube el progreso previo del navegador. Cada respuesta avanza solo cuando el servidor confirma el guardado. Si no hay conexión, la copia local permanece visible y el estudio se pausa hasta reconectar.

**Tu cuenta.** Un navegador sin progreso pide usuario y contraseña. **Crear cuenta** abre un perfil nuevo. **Entrar** abre el mismo progreso en la laptop o el celular. En un dispositivo que ya tiene progreso, **Crear usuario y contraseña** vincula una cuenta a ese progreso sin cambiarlo. El VPS guarda la contraseña como derivación scrypt y el código privado cifrado con una clave que solo deriva la contraseña correcta. Los intentos fallidos se limitan por IP y por usuario. **Mi cuenta** cambia la contraseña o cierra la sesión del dispositivo.

**Mi progreso en el VPS** muestra un código privado. Guárdalo. En otro dispositivo, introduce ese código y conecta el progreso encontrado. Quien tenga el código puede ver y modificar el plan. El enlace normal del sitio no lo contiene. Cada estudiante recibe un código distinto.

**Copia de mi progreso** exporta e importa el perfil completo con sus cuatro espacios y todas las flashcards personales. También acepta copias del formato anterior y las separa sin reiniciar la memoria de estudio. Una importación respalda el estado anterior en el VPS. El servicio también genera copias nocturnas de SQLite y conserva las 14 más recientes. Las publicaciones conservan la base fuera del directorio web. Biblioteca y Mi avance guardan las respuestas en el espacio seleccionado. Anki conserva su propio progreso.

## Sesiones de estudio

Cada espacio separa dos sesiones. **Temas nuevos** muestra las tarjetas recomendadas para su meta del día. Al terminarlas, puedes seguir con más temas nuevos. **Repasos** muestra todos sus repasos pendientes, incluso los atrasados. Los repasos sin terminar pasan al día siguiente. **Repartir** los distribuye en 2, 3, 5 o 7 días según el tiempo de cada día.

**Personalizar** fija las tarjetas por sesión, los minutos del temporizador, los minutos de descanso y cada cuántas respuestas aparece una frase motivadora (50 al inicio). También elige qué estudiar en las sesiones: algunas secciones, algunos bloques, o solo Ejes clínicos o Patrones madre. El filtro aplica a temas nuevos y a repasos, se guarda en el VPS y se quita con **Quitar filtro**. Puedes hacer todas las sesiones que quieras. El temporizador aparece en una esquina, avisa con sonido y con una notificación al llegar a cero. **Descanso** pausa la sesión y cronometra la pausa. La configuración muestra tu ritmo real: segundos por tarjeta y cuántas tarjetas caben en tu tiempo.

En el contenido por capas también puedes elegir un objetivo de sesión: ancla, variante, presentación incompleta, subtipo, contraste, cambio, dato faltante, gravedad o mecanismo. Solo aparecen objetivos que existen en el inventario del espacio. El filtro no borra ni reinicia repasos.

**¿Cómo está tu día?** cambia la carga de hoy: normal, menos carga (mitad del tiempo) o descanso. **Tu semana**, en el plan, marca días ligeros o de descanso. La estimación y las metas usan estos días. Los repasos nuevos se acomodan en el día menos cargado de una ventana cercana a su intervalo y evitan los días de descanso.

La primera vez que ves una tarjeta, «Otra vez» guarda una **primera lectura**. No cuenta como error. Los errores cuentan solo en repasos.

Debajo de cada tarjeta puedes marcar su **orden** (1º básica, 2º intermedia, 3º integradora), **Profundizar** y **Al final de la sesión**. Las tarjetas marcadas al final aparecen después de las demás.

**Tus flashcards.** Durante temas nuevos, repasos, Biblioteca o un subtest de flashcards, usa **Añadir flashcard**. Escribe o pega texto en **Frente** y **Reverso**. También puedes seleccionar texto visible de la tarjeta y usar **Usar en el frente** o **Usar en el reverso**. La selección se copia al borrador. No guarda subrayados en la tarjeta original. El editor pausa el tiempo activo de esa pregunta. Guardar la flashcard no responde ni avanza la tarjeta original.

Las flashcards personales se guardan en tu perfil del VPS y en sus copias JSON. Heredan la capa y la sección de origen. Se estudian en **Capa 1 creadas** o **Capa 2 creadas**, dentro de un bloque extra **Creadas**. Cada pestaña tiene su propio plan y repaso. El formato **Creadas** de Biblioteca abre el espacio personal de esa capa. Crear una tarjeta no la añade a la sesión de la biblioteca original. Después de calificarla, usa los mismos repasos y la misma opción de deshacer. El contenido personal conserva el texto pegado; no interpreta HTML. Los mazos Anki descargables conservan el contenido de la biblioteca original.

**Suspender flashcard** retira una tarjeta de las sesiones sin borrar su contenido ni su historial. En Biblioteca, abre su sección y elige **Suspendidas**. **Reintegrar flashcard** la devuelve con su fecha de repaso anterior. Una tarjeta que nunca estudiaste vuelve a temas nuevos. No hay borrado permanente ni edición de flashcards personales guardadas en esta versión. Puedes suspender una tarjeta y crear su reemplazo.

**Tu constancia** muestra los últimos 30 días. El verde brilla más con cada 50 respuestas. Toca un día para ver sus respuestas, nuevas, repasos, errores, tiempo, sesiones, descansos y bloques. **Tu meta grande** indica bloques y secciones completas, empezadas y por empezar.

## Avance y subtests

**Mi avance** muestra la primera vuelta por sección y bloque. Indica flashcards practicadas y pendientes, fecha de inicio, respuestas, errores, dificultades y próximo repaso. Una respuesta «Difícil» se cuenta por separado de un error. Los avisos de bloque y sección completos aparecen después de guardar la respuesta. Deshacer restaura el avance.

El selector **Espacio de estudio** cambia la capa o el espacio personal en Biblioteca y Mi avance. Los subtests conservan ese espacio. Mi avance también muestra el total de respuestas por espacio y las sesiones anteriores a la separación.

Un subtest puede combinar varias secciones o todos sus bloques. Filtra por tipo de pregunta: comparar casos, reconocer el patrón, decir el diagnóstico, explicar los hallazgos o decidir el manejo. También filtra por orden, por errores, repasos pendientes, preguntas para profundizar o sin practicar. Puedes limitar el número de preguntas y mezclar el orden. **Para profundizar** y **Preguntas que más tiempo te toman** crean un subtest directo. **Todo tu camino** muestra cada día desde que empezaste.

Elige una sección y un bloque para preparar un subtest. Selecciona preguntas concretas, todos los errores registrados o los repasos de hoy. Puedes combinar Eje Clínico y Patrones Madre. Después de responder, elige las preguntas que quieres repetir en la misma sesión. El resultado muestra la fecha del próximo repaso. Repetir una pregunta aumenta las respuestas, pero no el número de tarjetas únicas.

En **Hoy-capa 1**, **Casos diagnósticos** separa los casos de Eje Clínico. Fácil muestra una pista y opciones. Medio conserva las opciones sin la pista. Se puede confundir pide escribir el diagnóstico y el dato que distingue antes de comparar y calificar. Puedes combinar los tres niveles. Los casos de la biblioteca conservan su viñeta original en estos modos.

El bloque de amenorreas de Ginecología añade **24 viñetas distintas**, tres por diagnóstico: Turner, Mayer-Rokitansky-Küster-Hauser, insensibilidad completa a andrógenos, himen imperforado, tabique vaginal transverso, Kallmann, amenorrea hipotalámica funcional y disgenesia gonadal completa 46,XY. Cada diagnóstico tiene un caso fácil, uno medio y uno de contraste. Esta ampliación enlaza fuentes primarias y tiene revisión clínica profesional pendiente. No modifica los mazos Anki revisados.

Los casos diagnósticos tienen memoria de repaso propia. Se cuentan aparte de las 2,900 flashcards. Una respuesta conjunta de Eje Clínico se atribuye al bloque; un caso individual permite identificar el tema del error. Las marcas antiguas de Biblioteca se conservan, pero no inventan respuestas históricas ni fechas de estudio.

## Formatos

- **Eje Clínico:** casos del mismo grupo en el frente. Diagnósticos, discriminadores y primera decisión en el reverso.
- **Patrones Madre:** cuatro niveles. Reconocer el patrón, nombrar el diagnóstico, explicar los hallazgos y decidir el manejo según los factores del caso.
- **Creadas:** tus flashcards personales, agrupadas por sección. Puedes escribirlas durante el estudio. Se guardan en tu perfil y se cuentan aparte del inventario publicado.

El inventario original conserva 34 secciones, 355 grupos y 730 apariciones de temas. Conserva 719 combinaciones únicas de tema y referencia. Sus formatos producen 355 tarjetas Eje Clínico y 2,545 Patrones Madre: 2,900 tarjetas en total. Sus archivos, identificadores y mazos Anki permanecen iguales.

La sección **Trastornos hidroelectrolíticos** añade diez bloques en ambas capas: volumen y tonicidad, hiponatremia, hipernatremia, hipopotasemia, hiperpotasemia, hipocalcemia, hipercalcemia, magnesio, fosfato y realimentación, y problemas combinados. Sus 20 tarjetas de capa 1 elevan el inventario web de esa capa a 35 secciones y 2,920 tarjetas. El suplemento y la capa 2 se estudian en la web.

Capa 2 cubre las mismas 35 secciones con 843 escenarios independientes. Cada sección tiene más escenarios que las apariciones de temas de capa 1. Cada caso entrena una distinción clínica concreta. Los bloques pueden enlazar secciones que comparten un diagnóstico diferencial. Estos enlaces no duplican tarjetas ni su memoria de repaso.

La biblioteca carga una sección a la vez. Permite buscar por síntoma o sección, abrir un grupo diferencial, ocultar las respuestas y las pistas, elegir un nivel, guardar el progreso y comentar una tarjeta. Cada diagnóstico enlaza con su manejo y variantes. Los dos mazos completos se descargan como archivos `.apkg` para importar en Anki.

**Explorar casos** conserva la muestra de amenorrea secundaria e ictericia obstructiva. Incluye el mapa de contraste, la ampliación de enfermedades y los cambios del caso.

## Fuentes y revisión

El contenido usa el libro completo `Edwino.pdf`, de 1,150 páginas, y la agrupación de `ENARM_Capa1_Completo.pdf`. Los mazos Eje Clínico y Patrones Madre del usuario fijan la estructura. Las viñetas son originales. Las precisiones de fuentes primarias actuales se identifican en el reverso.

Cada sección conserva evidencia de página. La validación comprueba las citas contra la extracción del libro. Un autor distinto revisa el contenido. Su aprobación queda ligada al hash de la sección. Cambiar el contenido invalida la comprobación anterior.

El contenido nuevo de `content/layers/` usa documentos primarios de México y de organizaciones internacionales. Cada fuente registra su versión real, la fecha de comprobación y el apartado que respalda la decisión. Cada sección declara los límites de las fuentes mexicanas disponibles. Una guía antigua no se presenta como una actualización reciente. Un revisor independiente comprueba los escenarios y las fuentes. El compilador exige una revisión vigente para cada sección.

El cotejo de fuentes y la revisión cruzada son controles editoriales. La revisión clínica profesional permanece pendiente. Las tarjetas son material de estudio.

Los PDF, los mazos originales y la extracción bruta no se publican. La [nota de fuentes](content/source-notes.md) conserva la procedencia. El [contrato de autoría](docs/superpowers/specs/2026-10-29-full-book-card-contract.md) define los criterios.

## Desarrollo

Requisitos: las versiones de Node y Python indicadas en `.node-version` y `.python-version`, npm y uv 0.8.22. La [guía de desarrollo](docs/development.md) explica la arquitectura, las pruebas aisladas y el flujo para agentes.

```sh
npm ci
uv sync --locked
npx playwright install chromium
npm run prepare:study
npm run dev
```

Abre `http://127.0.0.1:4178/`. Las rutas diarias son `/#hoy-capa-1`, `/#hoy-capa-2`, `/#capa-1-creadas` y `/#capa-2-creadas`. `/#hoy` conserva el acceso a capa 1. `/#biblioteca?space=capa2` abre la biblioteca de capa 2. `/#avance?space=creadas1` abre el avance de las tarjetas personales de capa 1. Un navegador nuevo muestra la pantalla de cuenta. **Seguir sin cuenta en este dispositivo** conserva el modo anterior. Las pruebas de navegador usan ese modo. `/#avance?section=14&block=14.01&mode=cases` abre los casos de amenorrea. `/#amenorrea` y `/#ictericia` abren la muestra anterior.

```sh
uv run python -m unittest discover -s tests -p 'test_*.py'
npm test
npm run build
```

`npm run build` genera los mazos y audita sus bases SQLite antes de compilar la web. Requiere todas las secciones, la validación de fuentes y las revisiones vigentes. Los archivos generados quedan en `app/public/study/` y se copian a `dist/study/`. Se excluyen de Git.

Durante la autoría, `npm run build:reviewed` permite una vista local con las secciones de capa 2 ya revisadas. La interfaz indica su cobertura real. Esta vista no sustituye la comprobación completa de las 35 secciones.

Playwright usa su propia instalación de Chromium. Usa `CHROME_PATH=/usr/bin/google-chrome` para probar con Chrome instalado. Las pruebas locales usan puertos propios y una base de datos temporal. No reutilizan el servidor de desarrollo.

`npm run check` ejecuta formato, lint, pruebas de Python, compilación auditada, pruebas de Node y pruebas de navegador sobre la versión compilada. GitHub Actions ejecuta el mismo comando en cada push y pull request. `npm run format` aplica el formato al código; no modifica los archivos clínicos de `content/`.

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

Para el suplemento y la capa 2, edita `content/layers/capa1/35.json` o `content/layers/capa2/NN.json`. Sigue el [contrato de contenido por capas](docs/layer-content-contract.md). Un revisor distinto debe comprobar las fuentes y registrar su revisión en `content/layers/reviews/`. `npm run prepare:study` rechaza secciones ausentes, casos repetidos, conceptos sin cobertura y revisiones que no coinciden con el contenido.

Los comentarios y las marcas de práctica libre se guardan en el navegador. El progreso del plan diario se guarda en el VPS. Los comentarios se comparten con **Descargar comentarios** o **Copiar texto**. La web no los envía automáticamente. Anki mantiene su propio progreso.

El [runbook de despliegue](docs/deployment.md) explica cómo publicar y recuperar una versión en el VPS. El [piloto biliar](content/piloto-biliar.json) y su generador anterior siguen disponibles para referencia.
