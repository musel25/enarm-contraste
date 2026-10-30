import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { StudyCardData } from "../app/src/library-types";

const sources = [{ label: "Libro de prueba", pages: [1] }];
const base = { section_id: "01", block_id: "01.01", sources, context: "Un problema compartido." };
export const coachCards: StudyCardData[] = [
  { ...base, id: "eje/01.01", family: "eje", level: 0, prompt: "¿Qué diagnóstico corresponde a cada caso?", front: [{ text: "Una persona tiene una pista alfa.", highlight: "pista alfa" }], back: [{ title: "Respuesta alfa", text: "El mecanismo explica el hallazgo." }] },
  { ...base, id: "madre/1/01.01", family: "madre", level: 1, prompt: "¿Qué patrón organiza este problema?", front: [{ text: "Una función cambia." }], back: [{ title: "Patrón principal", text: "Una explicación del patrón." }] },
  ...[2, 3, 4].map(level => ({ ...base, id: `madre/${level}/01.01-01`, family: "madre" as const, level, topic_id: "01.01-01", prompt: `Pregunta del nivel ${level}`, front: [{ text: `Caso para el nivel ${level}.` }], back: [{ title: `Respuesta del nivel ${level}`, text: "Una explicación útil." }] })),
];
export const coachIndex = { schema_version: 1, content_sha256: "coach-fixture", cards: coachCards.map((c, order) => ({ id: c.id, section_id: c.section_id, block_id: c.block_id, family: c.family, level: c.level, order, new_seconds: 120, review_seconds: 45 })) };
const body = JSON.stringify(coachIndex);
const practiceBank = {schema_version:1,section_id:'01',groups:[{id:'01.01-1',parent_topic_id:'01.01-01',block_id:'01.01',name:'Respuesta alfa',answer_kind:'diagnosis',sources,variants:Object.fromEntries(['easy','medium','contrast'].map((difficulty,i)=>[difficulty,{vignette:i===0?'Una persona tiene una pista alfa.':`Presentación alternativa ${i} con pista alfa.`,discriminator:'pista alfa',explanation:'El mecanismo explica el hallazgo.',confusable_with:'Respuesta beta',why_not:'La pista corresponde a alfa.',distractors:['Respuesta beta']}]))}],decisions:[]};
const practiceBody=JSON.stringify(practiceBank);
const practiceIndexBody=JSON.stringify({schema_version:1,sections:[{id:'01',sha256:createHash('sha256').update(practiceBody).digest('hex')}],cases:3,decisions:0});
export const coachManifest = { practice:{url:'practice/index.json',sha256:createHash('sha256').update(practiceIndexBody).digest('hex'),cases:3,decisions:0}, schema_version: 1, content_sha256: "coach-fixture", review_status: "cross-reviewed", professional_review: "pending", counts: { sections: 1, blocks: 1, topic_occurrences: 1, cards: 5, eje: 1, madre: 4 }, sections: [{ id: "01", title: "Sección de prueba", blocks: 1, cards: 5, url: "sections/01.json" }], downloads: [{ family: "eje", label: "Eje Clínico", url: "enarm-eje.apkg", cards: 1 }, { family: "madre", label: "Patrones Madre", url: "enarm-madre.apkg", cards: 4 }], planner: { url: "index.json", cards: 5, sha256: createHash("sha256").update(body).digest("hex") } };
export async function mockCoach(page: Page) {
  await page.route('**/study/practice/index.json*',route=>route.fulfill({body:practiceIndexBody,contentType:'application/json'}));
  await page.route('**/study/practice/01.json*',route=>route.fulfill({body:practiceBody,contentType:'application/json'}));
  await page.route("**/study/manifest.json", route => route.fulfill({ json: coachManifest }));
  await page.route("**/study/index.json*", route => route.fulfill({ body, contentType: "application/json" }));
  await page.route("**/study/sections/*.json*", route => route.fulfill({ json: { id: "01", title: "Sección de prueba", blocks: [{ id: "01.01", title: "Un problema", topics: 1 }], cards: coachCards } }));
}
