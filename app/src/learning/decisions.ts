import type { CardSource } from '../library-types';
export type DecisionQuestion = {
  id: string; section_id: string; block_id: string; topic_id: string; node_id: string;
  path_id: string; path_label: string; step: number; steps: number;
  prompt: string; context: string; answer: string; explanation: string; discriminator: string;
  options: string[]; sources: CardSource[]; corrections?: string[];
};
const sources: CardSource[] = [
  { label: 'Edwino.pdf · amenorrea', pages: [379,380,381,382] },
  { label: 'ASRM: evaluación de amenorrea (2024)', url: 'https://www.asrm.org/practice-guidance/practice-committee-documents/current-evaluation-of-amenorrhea/' },
];
type Step = [node: string, prompt: string, newFact: string, answer: string, explanation: string, options?: string[]];
type Path = { id:string; name:string; primary:boolean; steps:Step[] };
const hormone = (fact:string, answer:string): Step => ['hormones','¿El fallo es gonadal o central?',fact,answer,'La FSH se interpreta con el estradiol y la situación clínica.',['Fallo gonadal: FSH elevada con estradiol bajo.','Fallo central: FSH baja o inapropiadamente normal con estradiol bajo.']];
const gonadal = 'Fallo gonadal: FSH elevada con estradiol bajo.';
const central = 'Fallo central: FSH baja o inapropiadamente normal con estradiol bajo.';
const paths: Path[] = [
  {id:'turner',name:'Síndrome de Turner',primary:true,steps:[
    hormone('El útero está presente. El desarrollo mamario es escaso. La FSH está elevada y el estradiol bajo.',gonadal),
    ['cause','¿Qué estudio distingue la causa de esta disgenesia?','La paciente tiene talla baja.','Cariotipo: 45,X orienta a Turner.','La talla baja apoya la sospecha; el estudio cromosómico define la causa.'],
  ]},
  {id:'swyer',name:'Disgenesia gonadal completa 46,XY',primary:true,steps:[
    hormone('Útero presente, escaso desarrollo mamario, FSH alta y estradiol bajo.',gonadal),
    ['cause','¿Por qué no basta el cariotipo para decir insensibilidad a andrógenos?','El cariotipo es 46,XY, con gónadas disgenéticas y útero presente.','El útero presente y el fallo gonadal orientan a disgenesia 46,XY.','La insensibilidad completa a andrógenos presenta ausencia de útero.'],
  ]},
  {id:'kallmann',name:'Síndrome de Kallmann',primary:true,steps:[
    hormone('Útero presente, pubertad ausente, FSH/LH bajas y estradiol bajo.',central),
    ['cause','¿Qué dato distingue una deficiencia congénita de GnRH?','La paciente no percibe olores desde la infancia.','Anosmia congénita: sospechar Kallmann.','La alteración olfatoria dirige la evaluación de la causa central.'],
  ]},
  {id:'functional-hypothalamic',name:'Amenorrea hipotalámica funcional',primary:true,steps:[
    hormone('Útero presente. Tras aumentar el ejercicio y restringir la ingesta, el estradiol es bajo y la FSH no está elevada.',central),
    ['cause','¿Puedes confirmar la causa funcional solo con ese antecedente?','Existe déficit energético y olfato conservado.','No. Es un diagnóstico de exclusión; evaluar otras causas.','El contexto orienta al hipotálamo, pero no excluye una lesión orgánica.'],
  ]},
  ...(['mrkh','cais'] as const).map(id => ({id,name:id==='mrkh'?'Agenesia mülleriana (MRKH)':'Insensibilidad completa a los andrógenos',primary:true,steps:[
    ['distinguish','¿Qué estudios distinguen las dos causas principales con útero ausente?','La imagen confirma útero ausente y hay desarrollo mamario.','Testosterona y cariotipo.','La anatomía por sí sola no distingue ambas causas.'],
    ['cause','¿A qué causa orientan estos nuevos resultados?',id==='mrkh'?'Cariotipo 46,XX, ovarios y testosterona en intervalo femenino.':'Cariotipo 46,XY, vello púbico escaso y testosterona en intervalo masculino.',id==='mrkh'?'Agenesia mülleriana (MRKH).':'Insensibilidad completa a los andrógenos.','Integra anatomía, función gonadal y cariotipo.',['Agenesia mülleriana (MRKH).','Insensibilidad completa a los andrógenos.']],
  ] as Step[]})),
  ...(['imperforate-hymen','transverse-septum'] as const).map(id => ({id,name:id==='imperforate-hymen'?'Himen imperforado':'Tabique vaginal transverso',primary:true,steps:[
    ['outflow','¿Qué sistema debes revisar ante este patrón?','Útero presente, desarrollo mamario y dolor pélvico mensual sin salida de sangre.','Revisar la vía de salida y localizar una obstrucción.','La presencia de hormonas no garantiza una vía de salida permeable.'],
    ['cause','¿Dónde se localiza la obstrucción?',id==='imperforate-hymen'?'Se observa una membrana himeneal cerrada y abombada con hematocolpos.':'El himen es permeable; la imagen localiza un tabique obstructivo más arriba.',id==='imperforate-hymen'?'En el himen: himen imperforado.':'Por encima del himen: tabique vaginal transverso.','La localización distingue los dos problemas.',['En el himen: himen imperforado.','Por encima del himen: tabique vaginal transverso.']],
  ] as Step[]})),
  {id:'pregnancy',name:'Embarazo',primary:false,steps:[
    ['result','¿Qué rama sigue con este resultado?','La hCG es positiva.','Evaluar embarazo según síntomas y localización.','La hCG positiva cambia la evaluación. El dolor o sangrado requieren valorar complicaciones.'],
    ['next','¿Conviene pasar directamente a una causa endocrina?','La paciente tiene amenorrea y prueba de embarazo positiva.','No. La evaluación inicial se dirige al embarazo.','No interpretar la amenorrea como anovulación sin resolver el estado gestacional.'],
  ]},
  {id:'secondary-functional-hypothalamic',name:'Amenorrea hipotalámica funcional secundaria',primary:false,steps:[
    hormone('Embarazo excluido. Tras una restricción de ingesta o ejercicio excesivo, el estradiol es bajo y la FSH no está elevada.',central),
    ['cause','¿Qué datos apoyan la causa funcional y qué falta resolver?','Los ciclos cesaron tras un déficit energético o estrés.','Investigar el contexto adquirido y excluir causas orgánicas.','La supresión central funcional no se confirma solo por el peso o la actividad física.'],
  ]},
  {id:'poi',name:'Insuficiencia ovárica primaria',primary:false,steps:[
    hormone('Con embarazo excluido, la FSH está elevada y el estradiol bajo.',gonadal),
    ['cause','¿Qué localización explica el patrón?','Había menstruado antes y ahora tiene fallo gonadal.','Insuficiencia ovárica; confirmar y estudiar su causa.','La FSH elevada distingue esta rama de la supresión central.'],
  ]},
  {id:'pcos',name:'Síndrome de ovario poliquístico',primary:false,steps:[
    ['androgens','¿Qué rama orienta este patrón?','Embarazo excluido. Hay anovulación e hiperandrogenismo persistente.','Evaluar síndrome de ovario poliquístico y excluir otras causas.','No basta una imagen de ovarios para el diagnóstico.'],
    ['limit','¿Basta el cociente LH/FSH para confirmar el diagnóstico?','La paciente tiene ciclos irregulares e hiperandrogenismo.','No. Integrar criterios y descartar causas alternativas.','El cociente hormonal aislado no establece el diagnóstico.'],
  ]},
  {id:'hyperprolactinemia',name:'Hiperprolactinemia',primary:false,steps:[
    ['prolactin','¿Qué resultado requiere confirmación y estudio de causas?','La hCG es negativa. La prolactina está elevada.','Confirmar la elevación y revisar causas, fármacos y función tiroidea.','Una elevación aislada no permite atribuir la amenorrea a un tumor.'],
    ['next','¿Qué cambia si la elevación persiste sin una causa explicativa?','La elevación de prolactina se confirma tras evaluar causas reversibles.','Estudiar la hipófisis; valorar resonancia.','La persistencia dirige el estudio anatómico.'],
  ]},
  {id:'thyroid',name:'Alteración tiroidea',primary:false,steps:[
    ['thyroid','¿Qué resultado cambia la rama endocrina?','Embarazo excluido. La TSH está alterada.','Evaluar la función tiroidea con el contexto y T4 libre.','Una alteración tiroidea puede modificar la ovulación.'],
    ['limit','¿Una TSH aislada explica siempre el problema?','Se estudia amenorrea y una alteración de TSH.','No. Confirmar e interpretar la función tiroidea y completar la evaluación.','Si se sospecha lesión hipofisaria, la T4 libre es necesaria para interpretar el eje.'],
  ]},
  {id:'asherman',name:'Síndrome de Asherman',primary:false,steps:[
    ['history','¿Qué antecedente cambia la dirección hacia la cavidad uterina?','Embarazo excluido. La amenorrea empezó después de un legrado.','Investigar sinequias uterinas.','Una cavidad antes funcional puede quedar afectada por cicatrices.'],
    ['confirm','¿Cómo se confirma la alteración intracavitaria?','Se sospechan adherencias uterinas tras instrumentación.','Histeroscopia diagnóstica.','Permite observar las adherencias de la cavidad.'],
  ]},
  {id:'sheehan',name:'Síndrome de Sheehan',primary:false,steps:[
    ['history','¿Qué antecedente dirige la evaluación a la hipófisis?','Tras hemorragia obstétrica intensa no se establece lactancia y no vuelven los ciclos.','Sospechar lesión hipofisaria posparto.','La hemorragia y la ausencia de lactancia son datos que cambian la decisión.'],
    ['extent','¿Basta estudiar las hormonas gonadales?','Se sospecha necrosis hipofisaria posparto.','No. Evaluar también los ejes suprarrenal y tiroideo.','El fallo puede afectar varios ejes y requiere atención especializada.'],
  ]},
];

export function amenorrheaDecisions(): DecisionQuestion[] {
  return paths.flatMap(path => {
    const initial = path.primary ? 'Una paciente consulta porque nunca ha menstruado.' : 'Una paciente con menstruaciones previas presenta ausencia de ciclos.';
    const prefix: Step[] = [
      ['classify','¿Nunca ha menstruado o dejó de menstruar?',initial,path.primary?'Amenorrea primaria.':'Amenorrea secundaria.','La historia de menstruación establece la primera bifurcación.',['Amenorrea primaria.','Amenorrea secundaria.']],
      ['pregnancy','¿Qué causa debes excluir primero?',initial,'Embarazo: medir hCG.','El estado gestacional se resuelve antes de atribuir el problema a otro eje.'],
    ];
    if(path.primary) {
      const absent = path.id==='mrkh'||path.id==='cais';
      prefix.push(['anatomy','¿Hay útero y qué rama sigue?',absent?'hCG negativa. La imagen confirma ausencia de útero.':'hCG negativa. La imagen identifica útero.',absent?'Útero ausente: distinguir agenesia mülleriana e insensibilidad a andrógenos.':'Útero presente: integrar desarrollo mamario, vía de salida y hormonas.','La anatomía define qué posibilidades siguen abiertas.']);
      if(!absent) prefix.push(['puberty','¿Qué aporta el desarrollo mamario?',path.id==='imperforate-hymen'||path.id==='transverse-septum'?'Hay desarrollo mamario y dolor cíclico.':'El desarrollo mamario es escaso o no progresa.',path.id==='imperforate-hymen'||path.id==='transverse-septum'?'Hubo acción estrogénica: revisar la vía de salida.':'Valorar FSH y estradiol para distinguir fallo gonadal y central.','La pubertad y la anatomía se interpretan juntas.']);
    }
    const steps = [...prefix,...path.steps];
    let context = initial;
    return steps.map(([node_id,prompt,newFact,answer,explanation,options=[]],i) => {
      if(newFact !== initial) context += '\n' + newFact;
      if(!path.primary && i===2 && path.id!=='pregnancy') context += '\nEmbarazo excluido mediante hCG.';
      return {id:`decision/14.01/${path.id}/${node_id}`,section_id:'14',block_id:'14.01',topic_id:path.id,node_id,path_id:path.id,path_label:path.name,step:i+1,steps:steps.length,prompt,context,answer,explanation,discriminator:newFact,options,sources};
    });
  });
}
