import type { CardSource, StudyManifest } from '../library-types';
import { amenorrheaDecisions, type DecisionQuestion } from './decisions';
import type { Difficulty } from './cases';
export type PracticeVariant = { vignette:string; discriminator:string; explanation:string; confusable_with:string; why_not:string };
export type PracticeGroup = { id:string;parent_topic_id:string;block_id:string;name:string;answer_kind:'diagnosis'|'decision';variants:Record<Difficulty,PracticeVariant>;sources:CardSource[];corrections?:string[] };
export type PracticeSection = {schema_version:number;section_id:string;groups:PracticeGroup[];decisions:DecisionQuestion[]};
const root = `${import.meta.env.BASE_URL}study/`;
const cache = new Map<string,Promise<PracticeSection>>();
async function checkedJson(url:string,expected:string) {
  const response = await fetch(`${root}${url}?v=${expected}`);
  if(!response.ok) throw new Error('No se pudo cargar la práctica ampliada.');
  const bytes=await response.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==expected) throw new Error('La práctica cambió. Vuelve a cargarla.');
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function loadPractice(id:string,manifest:StudyManifest):Promise<PracticeSection|null> {
  if(!manifest.practice) return Promise.resolve(null); // Supports older saved curriculum fixtures.
  if(!/^\d{2}$/.test(id)) return Promise.reject(new Error('Sección no válida.'));
  const key=`${manifest.practice.sha256}/${id}`;
  if(!cache.has(key)) {
    const request=(async()=>{
      const index=await checkedJson('practice/index.json',manifest.practice!.sha256);
      const entry=index.sections?.find((s:{id:string})=>s.id===id);
      if(!entry || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Falta el índice de práctica.');
      const bank=await checkedJson(`practice/${id}.json`,entry.sha256) as PracticeSection;
      if(bank.schema_version!==1 || bank.section_id!==id || !Array.isArray(bank.groups) || !bank.groups.length || !Array.isArray(bank.decisions)) throw new Error('La práctica no es válida.');
      for(const group of bank.groups) {
        if(!group.name || !group.id || !group.block_id.startsWith(`${id}.`) || !['easy','medium','contrast'].every(d=>group.variants?.[d as Difficulty]?.vignette) || !Array.isArray(group.sources) || !group.sources.length) throw new Error('Hay un caso incompleto.');
      }
      return bank;
    })().catch(error=>{cache.delete(key);throw error;});
    cache.set(key,request);
  }
  return cache.get(key)!;
}
export function decisionQuestions(bank:PracticeSection|null):DecisionQuestion[] {
  if(!bank) return [];
  return bank.section_id==='14' ? [...amenorrheaDecisions(),...bank.decisions] : bank.decisions;
}
