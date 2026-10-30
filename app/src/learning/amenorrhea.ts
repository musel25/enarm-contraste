import type { CardSource } from '../library-types';

export type ExpandedDiagnosis = {
  id: string; name: string; discriminator: string; explanation: string;
  contrast: string; cases: [string, string, string]; sources: CardSource[];
};
const asrm: CardSource = { label: 'ASRM: evaluación de amenorrea (2024)', url: 'https://www.asrm.org/practice-guidance/practice-committee-documents/current-evaluation-of-amenorrhea/' };
const acog: CardSource = { label: 'ACOG: agenesia mülleriana', url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2018/01/mullerian-agenesis-diagnosis-management-and-treatment' };

// Original teaching vignettes. This extension is separate from the reviewed book decks.
// The order groups related mechanisms; it is not a prevalence ranking.
export const amenorrheaDiagnoses: ExpandedDiagnosis[] = [
  {
    id: 'turner', name: 'Síndrome de Turner',
    discriminator: 'FSH elevada con talla baja y disgenesia gonadal; cariotipo 45,X.',
    explanation: 'La pérdida de función ovárica reduce los estrógenos y eleva la FSH. El útero está presente. El cariotipo confirma la alteración cromosómica.',
    contrast: 'Kallmann también puede impedir la pubertad, pero suele tener gonadotropinas bajas. La ausencia de cuello alado no excluye Turner.',
    cases: [
      'Una adolescente de 15 años nunca ha menstruado. Tiene talla baja, cuello alado y escaso desarrollo mamario. El útero está presente. La FSH está elevada y el estradiol es bajo. El cariotipo muestra 45,X.',
      'A los 16 años, una paciente consulta por ausencia de menarquia. Su crecimiento ha sido menor que el de sus compañeras. No presenta pubertad completa. El ultrasonido identifica útero pequeño; la FSH está elevada en mediciones repetidas. El estudio cromosómico informa 45,X.',
      'Una adolescente de talla baja no tiene menarquia ni desarrollo mamario completo. No tiene cuello alado. Se consideró un retraso central de la pubertad, pero la FSH está muy elevada y el estradiol es bajo. El cariotipo identifica una línea 45,X y otra 46,XX.',
    ], sources: [asrm],
  },
  {
    id: 'mrkh', name: 'Síndrome de Mayer-Rokitansky-Küster-Hauser',
    discriminator: 'Útero ausente con ovarios funcionales, vello habitual y cariotipo 46,XX.',
    explanation: 'La agenesia mülleriana afecta el útero y la parte superior de la vagina. Los ovarios producen estrógenos, por lo que el desarrollo mamario puede ser normal.',
    contrast: 'La insensibilidad completa a andrógenos también puede presentar útero ausente y mamas desarrolladas. El cariotipo y la testosterona permiten distinguirlas.',
    cases: [
      'Una joven de 16 años nunca ha menstruado. Tiene mamas desarrolladas y vello púbico habitual. La imagen confirma ausencia de útero y presencia de ovarios. El cariotipo es 46,XX y la testosterona está en el intervalo femenino.',
      'Una paciente de 17 años consulta por amenorrea desde siempre. La vagina termina en un fondo corto y no se identifica cuello uterino. Tiene desarrollo puberal habitual. La resonancia muestra ovarios y ausencia de útero; se encuentra además agenesia renal unilateral.',
      'A los 16 años, una paciente tiene mamas desarrolladas, vagina corta y útero ausente. Se propuso insensibilidad a andrógenos. Sin embargo, conserva vello púbico habitual, la testosterona está en el intervalo femenino y el cariotipo es 46,XX.',
    ], sources: [asrm, acog],
  },
  {
    id: 'cais', name: 'Insensibilidad completa a los andrógenos',
    discriminator: 'Útero ausente, vello escaso, testosterona en intervalo masculino y cariotipo 46,XY.',
    explanation: 'La falta de respuesta a andrógenos produce genitales externos femeninos. La hormona antimülleriana testicular impide el desarrollo uterino. La aromatización permite desarrollo mamario.',
    contrast: 'MRKH suele tener cariotipo 46,XX y ovarios. La disgenesia gonadal 46,XY conserva útero y no suele producir desarrollo mamario espontáneo.',
    cases: [
      'Una adolescente de 16 años presenta amenorrea primaria, mamas desarrolladas y vello púbico muy escaso. No se identifica útero. La testosterona está en el intervalo masculino y el cariotipo es 46,XY.',
      'Una joven consulta porque nunca ha menstruado. Tiene genitales externos femeninos y antecedente de una masa inguinal. La vagina es corta. La imagen no muestra útero; el cariotipo es 46,XY y la testosterona es de rango masculino.',
      'A una paciente con mamas desarrolladas y útero ausente se le sugirió agenesia mülleriana. En la revisión tiene poco vello axilar y púbico. El cariotipo es 46,XY y la testosterona está en el intervalo masculino.',
    ], sources: [asrm, acog],
  },
  {
    id: 'imperforate-hymen', name: 'Himen imperforado',
    discriminator: 'Dolor cíclico y hematocolpos con membrana himeneal cerrada y abombada.',
    explanation: 'La producción hormonal y el sangrado pueden ser normales, pero una obstrucción en el himen impide la salida de sangre.',
    contrast: 'Un tabique vaginal transverso está por encima del himen. La localización de la obstrucción es necesaria para distinguirlos.',
    cases: [
      'Una adolescente de 15 años no ha visto sangrado menstrual. Tiene desarrollo mamario y dolor pélvico mensual. La exploración muestra una membrana himeneal azulada y abombada. El ultrasonido confirma hematocolpos con útero presente.',
      'Una joven de 14 años tiene dolor pélvico recurrente y dificultad para orinar. Nunca ha menstruado. Tiene desarrollo puberal. Se identifica vagina distendida por sangre y una membrana cerrada y abombada en el sitio del himen.',
      'Se sospechó una anomalía uterina en una adolescente con amenorrea primaria y dolor mensual. La imagen sí muestra útero y hematocolpos. La obstrucción se localiza en una membrana himeneal cerrada; no está en un tabique vaginal alto.',
    ], sources: [asrm, acog],
  },
  {
    id: 'transverse-septum', name: 'Tabique vaginal transverso',
    discriminator: 'Obstrucción vaginal por encima de un himen permeable, con útero presente.',
    explanation: 'Un tabique transversal puede bloquear el flujo menstrual. La exploración y la imagen definen su nivel y permiten planear la atención especializada.',
    contrast: 'No basta con dolor y hematocolpos para decir himen imperforado. Aquí el himen es permeable y la obstrucción se encuentra más arriba.',
    cases: [
      'Una adolescente de 15 años tiene amenorrea primaria y dolor cíclico. El himen es permeable. La resonancia muestra un tabique transversal que obstruye la vagina en su tercio medio y sangre acumulada por encima. El útero está presente.',
      'Una joven de 16 años tiene desarrollo mamario y episodios de dolor pélvico sin sangrado. El introito y el himen son permeables. La vagina termina en una obstrucción proximal. La imagen identifica un útero y un tabique vaginal transverso completo.',
      'Una paciente con dolor mensual y hematocolpos fue referida por posible himen imperforado. Al explorar, el himen tiene una abertura. La resonancia ubica la obstrucción varios centímetros por encima del introito y confirma un tabique transversal.',
    ], sources: [asrm, acog],
  },
  {
    id: 'kallmann', name: 'Síndrome de Kallmann',
    discriminator: 'Ausencia de pubertad con gonadotropinas bajas y anosmia congénita.',
    explanation: 'La deficiencia congénita de GnRH reduce la estimulación gonadal. La alteración del desarrollo olfatorio explica la anosmia asociada.',
    contrast: 'Turner suele elevar la FSH. La amenorrea hipotalámica funcional requiere un contexto adquirido y no explica por sí sola la anosmia de toda la vida.',
    cases: [
      'Una adolescente de 16 años nunca ha menstruado y no tiene desarrollo mamario. El útero está presente. FSH, LH y estradiol están bajos. Refiere que nunca ha podido percibir olores.',
      'Una joven consulta por pubertad ausente. No hay pérdida de peso, ejercicio intenso ni enfermedad crónica identificada. Las gonadotropinas son bajas. En la entrevista explica que desde niña no reconoce el olor de la comida.',
      'Una adolescente con amenorrea primaria y estradiol bajo fue estudiada por posible falla ovárica. La FSH no está elevada, sino baja. No tiene restricción energética. Una prueba olfatoria confirma anosmia que existe desde la infancia.',
    ], sources: [asrm],
  },
  {
    id: 'functional-hypothalamic', name: 'Amenorrea hipotalámica funcional',
    discriminator: 'Déficit energético o estrés con estradiol bajo y gonadotropinas bajas o normales, tras excluir otras causas.',
    explanation: 'La baja disponibilidad energética o el estrés pueden suprimir la señal de GnRH. Es un diagnóstico de exclusión, también posible antes de la menarquia.',
    contrast: 'Un peso en intervalo habitual no descarta déficit energético. La historia adquirida y el olfato conservado ayudan frente a una deficiencia congénita de GnRH.',
    cases: [
      'Una deportista de 16 años nunca ha menstruado. Entrena muchas horas y restringe su alimentación. Tiene estradiol bajo y gonadotropinas bajas. El útero está presente. Se excluyen embarazo, alteraciones tiroideas, hiperprolactinemia y otras causas orgánicas.',
      'Una adolescente de 17 años consulta por ausencia de menarquia tras aumentar su entrenamiento y reducir la ingesta. El olfato es normal. Tiene estradiol bajo con FSH y LH bajas. La evaluación anatómica y el estudio de otras causas no muestran alteraciones.',
      'Una joven de 16 años tiene peso dentro del intervalo habitual, pero duplicó su entrenamiento sin aumentar la ingesta. Nunca ha menstruado. El estradiol está bajo y las gonadotropinas no están elevadas. Se descartan causas orgánicas y tiene olfato conservado.',
    ], sources: [asrm],
  },
  {
    id: 'swyer', name: 'Disgenesia gonadal completa 46,XY (síndrome de Swyer)',
    discriminator: 'Cariotipo 46,XY con útero presente, escaso desarrollo mamario y FSH elevada.',
    explanation: 'Las gónadas disgenéticas no producen suficiente hormona antimülleriana ni esteroides sexuales. Por eso el útero persiste y la pubertad no progresa de forma espontánea.',
    contrast: 'En insensibilidad completa a andrógenos el útero está ausente y suele haber mamas desarrolladas. El cariotipo 46,XY por sí solo no distingue ambas condiciones.',
    cases: [
      'Una paciente de 16 años con genitales externos femeninos nunca ha menstruado. Tiene escaso desarrollo mamario, útero presente, FSH elevada y estradiol bajo. El cariotipo informa 46,XY y el estudio confirma gónadas disgenéticas.',
      'Una adolescente de talla habitual tiene amenorrea primaria y ausencia de progresión puberal. La imagen muestra útero. El estudio hormonal indica hipogonadismo hipergonadotrópico y el cariotipo es 46,XY. No se identifica función testicular conservada.',
      'Se planteó insensibilidad completa a andrógenos por un cariotipo 46,XY en una joven con amenorrea primaria. Sin embargo, el útero está presente, no hay desarrollo mamario espontáneo y la testosterona es baja. Se documentan gónadas disgenéticas.',
    ], sources: [asrm],
  },
];
