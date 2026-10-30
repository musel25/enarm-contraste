# Complete clinical contrast and decision practice

The user asks to audit every item in Alessa's messages and finish the missing behavior through VPS deployment. Standing authorization permits autonomous work and deployment.

## Audit and intent

Present: section/block progress, started dates, unique practiced/pending cards, attempts/errors/difficult ratings, FSRS due dates, completion notices, selectable subtests, repeat selection, VPS storage and device recovery.

Missing: a real per-topic case bank across the PDF instead of repeating one vignette in three modes; case expansion accessible from Eje Clínico; explicit session skip; Patrones Madre asking each diagnostic/management decision in sequence. Primary amenorrhea already has24authored cases for8etiologies, but no decision sequence. Secondary amenorrhea needs its own etiologic expansion.

## Product

- Keep the established violet/teal, Manrope controls and Lora vignette design. The memorable new element is a visible decision path, showing one question and the collected facts at a time. Number only actual steps. Show the current node, progress and a clear Continue action after feedback.
- Eje Clínico offers individual easy, medium and confusable cases for every PDF topic occurrence. Each variant has a different vignette, its own decisive data and explanation. Cases use the reviewed source facts and preserve existing clinical IDs. Umbrella/procedure topics are labeled as classification/action questions where appropriate. Named diseases must keep diagnosis answers in all three variants. Do not replace a named disease with a generic treatment answer to avoid diagnostic uncertainty or repeated cases. If a modifier describes another disease, use a source-supported child group. Read the book for distinct presentations of the original disease. Do not pretend a procedural topic is a disease.
- Expand amenorrhea with named primary and secondary etiologies. Do not invent a universal frequency ranking. Use clinical priority and mechanism groups; state frequency only where a cited source supports it for a specified population.
- Patrones Madre offers guided decisions across every source block: identify decisive data, localize the system failure, choose the initial action, and apply each modifying factor. Use source-derived teaching paths. These are not represented as universally validated guidelines. Amenorrhea has a specifically authored branching evaluation covering primary/secondary, pregnancy, uterine anatomy, breast development, gonadotropins/estradiol, prolactin/thyroid, central/ovarian/outflow causes and the relevant etiologic leaves.
- Each node asks one decision. Later findings and answers remain hidden until reached. Incorrect choices teach the correct branch, record the precise node/topic error and never navigate down an incorrect clinical path. Confirm the saved answer before continuing.
- A selected subtest supports “Omitir por ahora” without credit or an invented grade. Show skipped questions and let the student return to them. Preserve repeat selection and offer immediate same-session repetition.
- Library buttons open cases or decision practice for the selected block/family. Mi avance also offers these modes with topic/question selection. New cases/decision nodes have FSRS memory and error analytics in the same VPS profile. Keep the original2900-card first-pass denominator stable; report supplemental clinical/decision practice separately.

## Supplemental content contract

Authors own only `content/practice/sections/NN.json`. Each file:

```
{schema_version:1,section_id:"NN",author:"name",source_sha256:"raw source file SHA256",groups:[
 {id:"stable topic or expanded slug",parent_topic_id:"NN.BB-TT",block_id:"NN.BB",name:"answer",answer_kind:"diagnosis"|"decision",variants:{
   easy:{vignette,discriminator,explanation,confusable_with,why_not,distractors:[],facts:[{field:"pattern",text:"exact source field text"}]},
   medium:{...},contrast:{...}
 }}]}
```

Every original topic has a group with its original ID. Expanded etiologies use additional stable IDs; the existing eight primary-amenorrhea IDs remain stable. Facts refer to exact fields of the group's parent topic, including findings/modifiers/limits/corrections. Do not invent doses, cutoffs, negative tests or clinical facts not supported by the provided content/book or explicitly cited primary evidence. Variants must be clinically distinct in presentation or source-supported modifying context, not just differently prefixed duplicates. The confusable diagnosis must be justified by data. Avoid putting the answer name in the vignette unless the learning target is an action.

Each variant has zero to three reviewed false alternatives in `distractors`. The application never infers choices from other group names. Do not offer a valid synonym, parent diagnosis or child diagnosis as a false answer. An empty list uses written recall and self-rating.

Independent cross-review writes `content/practice/reviews/NN.json` with section_id, author, reviewer (different), content_sha256 of the practice file, source_sha256, status:"source-checked", professional_review:"pending", notes. It also records `case_checks[group_id][difficulty]` for every case. Each check includes `evidence`, an exact distinctive clinical snippet of 8–180 characters; `difference`, the clinical change from the other variants; and `options_checked:true`. The evidence must not appear in either sibling case. The reviewer must compare all three cases and all answer choices. These structural checks support the semantic review; they cannot replace it. The application and coverage audit reject missing or stale reviews. New vignettes remain labeled teaching material with professional review pending.

## Data and safety

Preserve original book content, source attestations, Anki IDs, VPS profiles and existing practice histories. Load supplemental files by section and hash. A generated supplemental index supplies stable metadata. Decision IDs use `decision/<block>/<topic>/<node>`; parse them in analytics and backup validation. Do not count a skipped card as practiced or a first exposure as mastery. Existing source corrections take priority. Cite primary guidance for authored amenorrhea decision branches. Export/import and paired devices must retain the new memories.

## Acceptance

All34sections,355blocks and730topic occurrences have three source-anchored variants and a reachable source-based decision path. Verify coverage, exact source references, review hashes, unique stable IDs, coherent answer labels and distinct case text. Verify amenorrhea's named etiologies and all important branch outcomes with primary guidance and PDF pages379–382. Test wrong answers, retries, repeats, skip/return, answer hiding, narrow screens, backup/import, VPS persistence and old daily plans. Deploy and test the public application.
