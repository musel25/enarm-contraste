import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {amenorrheaDecisions} from '../app/src/learning/decisions';

test('published practice covers every source topic with reviewed distinct variants and decisions',async({request})=>{
 test.setTimeout(60000);
 const manifest=await (await request.get('./study/manifest.json')).json();
 expect(manifest.practice?.cases).toBeGreaterThanOrEqual(2190);
 const indexResponse=await request.get('./study/practice/index.json');
 const indexBytes=await indexResponse.body();
 expect(createHash('sha256').update(indexBytes).digest('hex')).toBe(manifest.practice.sha256);
 const index=JSON.parse(indexBytes.toString());expect(index.sections).toHaveLength(34);
 let topics=0,cases=0;const blocks=new Set<string>();const nodeIds=new Set<string>();
 for(const entry of index.sections){
  const response=await request.get(`./study/practice/${entry.id}.json`);expect(response.ok()).toBe(true);
  const bytes=await response.body();expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
  const bank=JSON.parse(bytes.toString());expect(bank.professional_review).toBe('pending');
  for(const group of bank.groups){
   if(group.id===group.parent_topic_id){topics++;expect(bank.decisions.filter((q:{topic_id:string})=>q.topic_id===group.id).length).toBeGreaterThanOrEqual(4);}
   const variants=Object.values(group.variants) as {vignette:string;facts?:unknown}[];
   expect(variants).toHaveLength(3);expect(new Set(variants.map(v=>v.vignette)).size).toBe(3);
   expect(variants.every(v=>!v.facts)).toBe(true);expect(group.corrections.every((note:unknown)=>typeof note==='string')).toBe(true);cases+=3;blocks.add(group.block_id);
  }
  for(const q of bank.decisions){expect((q.corrections||[]).every((note:unknown)=>typeof note==='string')).toBe(true);expect(nodeIds.has(q.id)).toBe(false);nodeIds.add(q.id);}
 }
 expect(topics).toBe(730);expect(blocks.size).toBe(355);expect(cases).toBe(manifest.practice.cases);expect(nodeIds.size).toBe(manifest.practice.decisions);
});

test('primary amenorrhea cases launch from the library and retain their own saved progress',async({page})=>{
 await page.goto('./#biblioteca');
 await page.getByRole('button',{name:/Ginecología/}).click();
 await page.getByRole('link',{name:'Ampliar casos diagnósticos',exact:true}).click();
 await page.getByRole('combobox',{name:'Diagnóstico o concepto',exact:true}).selectOption('turner');
 await page.getByRole('button',{name:'Seleccionar todas',exact:true}).click();
 await page.getByRole('button',{name:'Empezar subtest (1)',exact:true}).click();
 await expect(page.getByRole('heading',{name:'¿Cuál es el diagnóstico?',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Síndrome de Turner',exact:true}).click();
 await expect(page.getByText('Respuesta correcta.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Ver resultado',exact:true}).click();
 await page.getByRole('button',{name:'Volver a mi avance',exact:true}).click();
 await expect(page.getByTestId('section-progress-14')).toContainText('1 casos diagnósticos practicados');
 await expect(page.getByTestId('section-progress-14')).toContainText('0 de ');
 await page.reload();
 await expect(page.getByTestId('section-progress-14')).toContainText('1 casos diagnósticos practicados');
});

test('amenorrhea decision practice reaches the MRKH branch one decision at a time',async({page})=>{
 await page.goto('./#biblioteca');
 await page.getByRole('button',{name:/Ginecología/}).click();
 await page.getByRole('button',{name:'Patrones Madre',exact:true}).click();
 await page.getByRole('link',{name:'Practicar decisiones paso a paso',exact:true}).click();
 await page.getByRole('combobox',{name:'Ruta de decisiones',exact:true}).selectOption('mrkh');
 await page.getByRole('button',{name:'Seleccionar todas',exact:true}).click();
 await page.getByRole('button',{name:/Empezar subtest/}).click();
 const path=amenorrheaDecisions().filter(q=>q.path_id==='mrkh');
 for(let i=0;i<path.length;i++){
  const step=path[i];await expect(page.getByRole('heading',{name:step.prompt,exact:true})).toBeVisible();
  if(step.options.length) await page.getByRole('button',{name:step.answer,exact:true}).click();
  else{await page.getByLabel('Escribe tu siguiente decisión').fill(step.answer);await page.getByRole('button',{name:'Comparar decisión',exact:true}).click();await page.getByRole('button',{name:'Acerté',exact:true}).click();}
  await expect(page.getByText('Respuesta correcta.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:i+1===path.length?'Ver resultado':'Siguiente pregunta',exact:true}).click();
 }
 await expect(page.getByText(`${path.length} respuestas guardadas`,{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Volver a mi avance',exact:true}).click();
 await expect(page.getByTestId('section-progress-14')).toContainText(`${path.length} decisiones practicadas`);
});
