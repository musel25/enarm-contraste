import type { PracticeCard, Scenario } from "./types";

export const amenorrheaVariants: Scenario[] = [
  {
    id: "AME-V0",
    title: "Caso base",
    from: null,
    vignette:
      "Mujer de 23 años con amenorrea hipotalámica funcional tras excluir otras causas, déficit energético y estradiol bajo con FSH baja; está estable, con frecuencia cardíaca de 75 lpm.",
    changes: [],
    unchanged: [],
    diagnosis: "Amenorrea hipotalámica funcional",
    decision:
      "Corregir el déficit energético y organizar seguimiento con apoyo nutricional y psicológico según la evaluación.",
    reason:
      "El abordaje se dirige al factor que suprime la señal reproductiva.",
    severity: "Sin inestabilidad en la viñeta",
    sources: ["fha"],
  },
  {
    id: "AME-V1",
    title: "Bradicardia grave",
    from: 0,
    vignette:
      "Se conserva el caso base y cambia únicamente la frecuencia cardíaca: ahora es de [[38 lpm]].",
    changes: [
      { field: "Frecuencia cardíaca", before: "75 lpm", after: "38 lpm" },
    ],
    unchanged: [
      "Déficit energético",
      "Embarazo y otras causas excluidos",
      "Estradiol bajo con FSH baja",
    ],
    diagnosis: "Amenorrea hipotalámica funcional con bradicardia grave",
    decision:
      "Valorar hospitalización y evaluación inmediata de la estabilidad y los electrolitos; adaptar el manejo nutricional al riesgo.",
    reason:
      "El diagnóstico de base sigue igual. El riesgo asociado a la bradicardia modifica el lugar y la prioridad de atención.",
    severity: "La estabilidad requiere nueva valoración",
    sources: ["fha"],
  },
  {
    id: "AME-V2",
    title: "Deseo de embarazo",
    from: 0,
    vignette:
      "Se conserva el caso base estable, con frecuencia de 75 lpm, pero la paciente expresa [[deseo de embarazo]].",
    changes: [
      {
        field: "Objetivo reproductivo",
        before: "Sin búsqueda de embarazo actual",
        after: "Deseo de embarazo",
      },
    ],
    unchanged: [
      "Estabilidad clínica",
      "Déficit energético",
      "Patrón hormonal y diagnóstico",
    ],
    diagnosis: "Amenorrea hipotalámica funcional",
    decision:
      "Mantener la recuperación energética y añadir valoración reproductiva antes de decidir tratamiento para fertilidad.",
    reason:
      "Cambia el objetivo del manejo. Este factor añade una decisión, pero no representa mayor gravedad clínica.",
    severity: "La gravedad no aumenta por este cambio",
    sources: ["fha"],
  },
];

export const biliaryVariants: Scenario[] = [
  {
    id: "BIL-V0",
    title: "Caso base",
    from: null,
    vignette:
      "Persona con ictericia, colestasis y cálculo confirmado en colédoco, temperatura de 37 °C, leucocitos de 7,500/µL y presión de 110/70 mmHg.",
    changes: [],
    unchanged: [],
    diagnosis:
      "Coledocolitiasis; sin datos suficientes de infección en esta evaluación",
    decision:
      "Evaluar infección y planear la resolución de la obstrucción según el contexto.",
    reason:
      "El cálculo explica el drenaje alterado. Es necesario vigilar datos de infección, incluso si no hay fiebre.",
    severity: "Estable en los datos aportados",
    sources: ["book-biliar", "asge2019", "tg18"],
  },
  {
    id: "BIL-V1",
    title: "Se agrega infección",
    from: 0,
    vignette:
      "Se conservan la obstrucción, la ictericia y la presión de 110/70 mmHg; aparecen [[temperatura de 39 °C y leucocitos de 16,000/µL]].",
    changes: [
      { field: "Temperatura", before: "37 °C", after: "39 °C" },
      { field: "Leucocitos", before: "7,500/µL", after: "16,000/µL" },
    ],
    unchanged: [
      "Cálculo demostrado",
      "Ictericia y colestasis",
      "Presión de 110/70 mmHg",
    ],
    diagnosis: "Colangitis aguda sobre coledocolitiasis",
    decision:
      "Evaluar disfunción orgánica, iniciar el manejo de la infección y valorar drenaje según gravedad y respuesta.",
    reason:
      "La inflamación sistémica se suma a la colestasis y a la imagen. Ya no basta con describir el cálculo.",
    severity: "Requiere estratificar gravedad con criterios completos",
    sources: ["capa-biliar", "book-biliar", "tg18", "tg18_initial"],
  },
  {
    id: "BIL-V2",
    title: "Aparece hipotensión",
    from: 1,
    vignette:
      "Se conserva el cuadro previo de colangitis y cambia únicamente la presión arterial: de 110/70 mmHg pasa a [[80/50 mmHg]].",
    changes: [
      { field: "Presión arterial", before: "110/70 mmHg", after: "80/50 mmHg" },
    ],
    unchanged: [
      "Cálculo e ictericia",
      "Temperatura de 39 °C",
      "Leucocitos de 16,000/µL",
    ],
    diagnosis: "Colangitis con inestabilidad hemodinámica",
    decision:
      "Priorizar evaluación y estabilización inmediata; coordinar atención urgente y control de la fuente de infección.",
    reason:
      "La alteración circulatoria cambia la prioridad. No se debe esperar a completar todos los estudios para atender la inestabilidad.",
    severity:
      "Inestabilidad; no se asigna un grado completo con una sola cifra",
    sources: ["book-biliar", "tg18_initial"],
  },
];

export const amenorrheaPractice: PracticeCard[] = [
  {
    id: "AME-P01",
    type: "ancla",
    vignette:
      "Una mujer con ciclos antes regulares consulta por retraso menstrual y tiene [[β-hCG positiva]].",
    question:
      "¿Qué causa de la ausencia de menstruación debes valorar primero?",
    answer: "Embarazo",
    explanation:
      "Una prueba positiva cambia la ruta de evaluación. No establece por sí sola la localización ni la viabilidad.",
    decision:
      "Valorar el embarazo y buscar datos de complicación según el contexto.",
    limit:
      "No corresponde asumir una causa funcional antes de considerar embarazo.",
    sources: ["capa-gine", "asrm", "nice"],
  },
  {
    id: "AME-P02",
    type: "ancla",
    vignette:
      "Una mujer con amenorrea tras restricción alimentaria y ejercicio intenso, embarazo excluido y evaluación sin otra causa identificada tiene [[estradiol bajo con FSH baja o normal]].",
    question: "¿Qué diagnóstico explica mejor este patrón?",
    answer: "Amenorrea hipotalámica funcional",
    explanation:
      "La señal central es insuficiente para estimular la función ovárica. El diagnóstico exige excluir otras causas.",
    decision:
      "Recuperar el equilibrio energético y valorar la estabilidad clínica.",
    limit: "El ejercicio aislado no confirma el diagnóstico.",
    sources: ["capa-gine", "fha"],
  },
  {
    id: "AME-P03",
    type: "contraste",
    vignette:
      "Una mujer de 32 años, con cinco meses de amenorrea y embarazo excluido, tiene estradiol bajo y [[FSH elevada]].",
    question:
      "¿Qué alternativa debes distinguir de una supresión hipotalámica?",
    answer: "Insuficiencia ovárica primaria",
    explanation:
      "La FSH elevada, junto con el contexto, orienta a función ovárica reducida.",
    decision:
      "Aplicar los criterios completos y confirmar cuando exista incertidumbre.",
    limit: "El estradiol bajo solo no confirma el diagnóstico.",
    sources: ["capa-gine", "poi"],
  },
  {
    id: "AME-P04",
    type: "discriminador",
    vignette:
      "Una mujer con amenorrea, embarazo excluido y secreción láctea tiene [[prolactina persistentemente elevada]].",
    question:
      "¿Qué mecanismo debe investigarse sin asumir todavía que existe un tumor?",
    answer: "Hiperprolactinemia",
    explanation:
      "La prolactina elevada puede alterar la función reproductiva. Hay causas farmacológicas, tiroideas e hipofisarias.",
    decision: "Revisar las causas antes de elegir tratamiento o imagen.",
    limit: "La hiperprolactinemia no equivale a prolactinoma.",
    sources: ["capa-prol", "prol"],
  },
  {
    id: "AME-P05",
    type: "microvariacion",
    vignette:
      "Caso base: mujer de 32 años, cinco meses de amenorrea, embarazo excluido, estradiol bajo y FSH baja; cambia solo [[la FSH de baja a elevada]].",
    question: "¿Hacia qué alternativa cambia la orientación diagnóstica?",
    answer: "Insuficiencia ovárica primaria",
    explanation:
      "La FSH ahora elevada orienta hacia una respuesta ovárica reducida. Se conservan edad, tiempo de amenorrea, estradiol y prueba de embarazo.",
    decision:
      "Comprobar los criterios diagnósticos y el contexto de las mediciones.",
    limit:
      "Es un cambio didáctico de un solo campo; no describe la evolución esperada de una paciente.",
    sources: ["asrm", "poi"],
  },
  {
    id: "AME-P06",
    type: "primera_decision",
    vignette:
      "Una mujer estable con amenorrea, embarazo excluido y sin síntomas neurológicos tiene [[prolactina levemente elevada en una sola medición]].",
    question:
      "¿Qué debes hacer antes de atribuir el resultado a una lesión hipofisaria?",
    answer: "Confirmar la elevación y revisar causas secundarias",
    explanation:
      "Una elevación leve aislada requiere interpretación y confirmación antes de atribuirle una causa.",
    decision:
      "Revisar la toma, los fármacos, la función tiroidea y repetir el estudio según la evaluación.",
    limit:
      "Una elevación persistente sin explicación requiere otra ruta de investigación.",
    sources: ["asrm", "prol"],
  },
];
