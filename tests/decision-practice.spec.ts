import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {mockCoach,coachManifest} from './coach-fixtures';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const sources=[{label:'Libro de prueba',pages:[1]}];
const bank={schema_version:1,section_id:'01',groups:[{id:'01.01-01',parent_topic_id:'01.01-01',block_id:'01.01',name:'Respuesta alfa',answer_kind:'diagnosis',sources,variants:Object.fromEntries(['easy','medium','contrast'].map((d,i)=>[d,{vignette:`Un caso diferente ${i}.`,discriminator:'La pista cambia.',explanation:'Una explicación.',confusable_with:'Otra causa',why_not:'Tiene otro dato.'}]))}],decisions:[1,2].map((n)=>({id:`decision/01.01/01.01-01/step-${n}`,section_id:'01',block_id:'01.01',topic_id:'01.01-01',node_id:`step-${n}`,path_id:'01.01-01',path_label:'Ruta alfa',step:n,steps:2,prompt:n===1?'¿Cuál es la primera bifurcación?':'¿Cuál es la segunda bifurcación?',context:n===1?'Situación inicial.':'Nuevo dato reservado.',answer:n===1?'Respuesta correcta':'Evaluar el nuevo dato',explanation:'La pista cambia la decisión.',discriminator:'Pista',options:n===1?['Respuesta incorrecta','Respuesta correcta']:[],sources}))};
const bankBody=JSON.stringify(bank);
const indexBody=JSON.stringify({schema_version:1,sections:[{id:'01',sha256:hash(bankBody)}]});
test.beforeEach(async({page})=>{
  await mockCoach(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/study/manifest.json',route=>route.fulfill({json:{...coachManifest,practice:{url:'practice/index.json',sha256:hash(indexBody),cases:3,decisions:2}}}));
  await page.route('**/study/practice/index.json*',route=>route.fulfill({body:indexBody,contentType:'application/json'}));
  await page.route('**/study/practice/01.json*',route=>route.fulfill({body:bankBody,contentType:'application/json'}));
});

test('guided decisions hide future data, record errors, and save before the next node',async({page})=>{
 await page.goto('./#avance?section=01&block=01.01&mode=decisions');
 await page.getByRole('button',{name:'Seleccionar todas',exact:true}).click();
 await page.getByRole('button',{name:/Empezar subtest/}).click();
 await expect(page.getByRole('heading',{name:'¿Cuál es la primera bifurcación?'})).toBeVisible();
 await expect(page.getByText('Nuevo dato reservado.',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Respuesta incorrecta',exact:true}).click();
 await expect(page.getByText('Error registrado.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Respuesta correcta',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Siguiente pregunta',exact:true}).click();
 await expect(page.getByRole('heading',{name:'¿Cuál es la segunda bifurcación?'})).toBeFocused();
 await page.getByLabel('Escribe tu siguiente decisión').fill('Evaluar el nuevo dato');
 await page.getByRole('button',{name:'Comparar decisión',exact:true}).click();
 await page.getByRole('button',{name:'Acerté',exact:true}).click();
 await page.getByRole('button',{name:'Ver resultado',exact:true}).click();
 await page.getByRole('button',{name:'Volver a mi avance',exact:true}).click();
 await expect(page.getByTestId('section-progress-01')).toContainText('2 decisiones practicadas');
 await expect(page.getByTestId('section-progress-01')).toContainText('0 de 5');
 await page.reload();
 await expect(page.getByTestId('section-progress-01')).toContainText('2 decisiones practicadas');
});

test('skip gives no credit and skipped questions can return in the same session',async({page})=>{
 await page.goto('./#avance?section=01&mode=decisions');
 await page.getByRole('button',{name:'Seleccionar todas',exact:true}).click();
 await page.getByRole('button',{name:/Empezar subtest/}).click();
 await page.getByRole('button',{name:'Omitir por ahora',exact:true}).click();
 await expect(page.getByRole('heading',{name:'¿Cuál es lasegunda bifurcación?'.replace('lasegunda','la segunda')})).toBeVisible();
 await page.getByRole('button',{name:'Omitir por ahora',exact:true}).click();
 await expect(page.getByText(/0 respuestas guardadas/)).toBeVisible();
 await expect(page.getByText('2 preguntas omitidas. No cuentan como practicadas.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Volver a las omitidas',exact:true}).click();
 await expect(page.getByRole('heading',{name:'¿Cuál es la primera bifurcación?'})).toBeVisible();
});

test('supplemental load failure blocks practice and supports retry',async({page})=>{
 let fail=true;
 await page.route('**/study/practice/01.json*',route=>fail?route.fulfill({status:503}):route.fallback());
 await page.goto('./#avance?section=01&mode=cases');
 await expect(page.getByText('No se pudo cargar la práctica ampliada.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Empezar subtest/})).toHaveCount(0);
 fail=false;
 await page.getByRole('button',{name:'Reintentar sección',exact:true}).click();
 await expect(page.getByText('Respuesta alfa · Fácil',{exact:false})).toBeVisible();
});

test('decision progress exports, imports, and returns on a separate device',async({page,browser})=>{
 await page.goto('./#avance?section=01&mode=decisions');
 await page.getByRole('checkbox').first().check();
 await page.getByRole('button',{name:/Empezar subtest/}).click();
 await page.getByRole('button',{name:'Respuesta correcta',exact:true}).click();
 await expect(page.getByText('Respuesta correcta.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Hoy',exact:true}).click();
 await page.getByRole('button',{name:'Empezar mi plan',exact:true}).click();
 await page.getByRole('button',{name:'Copia de mi progreso'}).click();
 const downloaded=page.waitForEvent('download');
 await page.getByRole('button',{name:'Exportar mi progreso',exact:true}).click();
 const file=await downloaded;
 await page.getByLabel('Importar una copia').setInputFiles((await file.path())!);
 await expect(page.getByText('Copia comprobada',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Reemplazar con esta copia',exact:true}).click();
 await page.getByRole('button',{name:'Mi progreso en el VPS'}).click();
 const code=await page.getByLabel('Tu código de progreso',{exact:true}).inputValue();
 const context=await browser.newContext({reducedMotion:'reduce'});
 try {
   const other=await context.newPage();await mockCoach(other);
   await other.goto('./');
   await other.getByRole('button',{name:'Mi progreso en el VPS'}).click();
   await other.getByLabel('Código de otro dispositivo',{exact:true}).fill(code);
   await other.getByRole('button',{name:'Ver progreso',exact:true}).click();
   await expect(other.getByText('1 respuestas guardadas',{exact:true})).toBeVisible();
   await other.getByRole('button',{name:'Conectar este progreso',exact:true}).click();
   // Metadata uses stable IDs. Progress rows do not need the answer bank to count saved decisions.
   await other.getByRole('button',{name:'Mi avance',exact:true}).click();
   await expect(other.getByTestId('section-progress-01')).toContainText('1 decisiones practicadas');
 } finally {await context.close();}
});

test('due decision reminders open only the questions that need review',async({page})=>{
 const {emptyState,recordPractice,dayKey,addDays}=await import('../app/src/coach/engine');
 const {practiceMeta}=await import('../app/src/learning/model');
 const state=recordPractice(emptyState(),practiceMeta('decision/01.01/01.01-01/step-1')!,1,12,addDays(dayKey('UTC'),-2),'old-decision');
 await page.goto('./#amenorrea');
 await page.evaluate(state=>new Promise<void>((resolve,reject)=>{
   const open=indexedDB.open('enarm-coach-v1',1);open.onupgradeneeded=()=>open.result.createObjectStore('state');
   open.onsuccess=()=>{const db=open.result;const tx=db.transaction('state','readwrite');tx.objectStore('state').put(state,'current');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(new Error('Seed failed'));};
 }),state);
 await page.goto('./');
 await page.getByRole('button',{name:'Empezar mi plan',exact:true}).click();
 await page.getByRole('link',{name:'Repasar 1 decisiones de la sección 01',exact:true}).click();
 await expect(page.getByRole('button',{name:'Empezar subtest (1)',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Empezar subtest (1)',exact:true}).click();
 await expect(page.getByRole('heading',{name:'¿Cuál es la primera bifurcación?'})).toBeVisible();
});
