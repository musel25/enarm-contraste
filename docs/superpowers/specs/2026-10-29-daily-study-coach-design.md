# Daily study coach

The user wants the ENARM site to work like Grind Recall for daily planning. A student chooses a finish date or daily study time. Opening the site presents today's cards, with clear daily and course progress. Each rated card gives useful, satisfying feedback. Finishing the daily assignment gives a larger celebration.

The user has authorized autonomous work through deployment. This continues the existing application and stack. Builder choices below are defaults, not preferences the user explicitly selected.

## Experience

- The default route and `#hoy` open Today. A new student sets up a plan there. `#biblioteca` retains the complete card library. Existing sample routes, comments, references, and Anki exports remain available.
- Setup has two modes: **Fecha objetivo** estimates required minutes per day; **Tiempo diario** estimates the first-pass finish date. Choose sections and either/both card families. Defaults: all 34 sections, both families, 30 days or 60 minutes/day.
- Use actual card reading/recall costs and due reviews, not `number of cards / days` alone. Show the assumptions and an explicit infeasible result. Estimates assume future **Bien** ratings. Completing a plan means every selected card has been practiced once; reviews continue.
- Today shows one main next-card action and the first assigned card. The full library is secondary. Show completed/assigned cards, remaining estimated time, new/review counts, selected-course coverage, calendar goal, and next due reviews. Keep plan editing visible.
- After revealing the answer, choose **Otra vez / Difícil / Bien / Fácil**. Revealing alone never records completion. The student's self-rating controls scheduling. An **Otra vez** response still counts as honest practice and first exposure, while scheduling another review. It is never labeled a correct recall.
- Course coverage counts distinct introduced cards. Retention/accuracy is a separate measure from self-ratings. Never call first exposure mastery. Daily credit counts each assigned card at most once that day. Extra attempts cannot inflate the target.
- Each saved rating gives a brief color pulse, progress fill, and supportive message, then advances automatically. Another-try feedback is gentle. Daily completion gives a larger checkmark/confetti moment once per day. Full first-pass completion has its own milestone and explains continuing reviews.
- Respect `prefers-reduced-motion`. Provide a low-motion preference and optional sound, off by default. No flashing effects, punishment for missing a day, or claims that this treats ADHD.

## Scheduling and forecasts

Use the already proven Grind approach, adapted for short flashcards: pinned `ts-fsrs@5.4.2`, 90% target retention, deterministic intervals, no short-term steps, maximum interval365days. Every rating schedules at least the next calendar day; Again returns tomorrow. Preserve the FSRS memory fields. This is a scheduling target, not a guarantee of knowledge or exam performance.

Calendar days use a saved IANA timezone, defaulted from the device. Day arithmetic uses UTC-noon date keys to avoid DST errors. Deadlines are inclusive. Daily time accepts5–720minutes. Forecast horizon730days; an impossible deadline or pace is explicit, with no invented completion date.

The planner selects due/overdue cards first in due-date/order sequence, then new cards in the existing pedagogical sequence. Whole cards must fit the time budget. If due work exceeds the budget, keep remaining due work visible as backlog; do not silently include it in the achievable daily target. New work waits behind that backlog. Forecasts run the same selection and FSRS transitions as real study, assuming Good ratings. Cache repeated FSRS transitions or otherwise avoid blocking the UI when estimating all2900cards.

The first daily assignment is saved with its ordered IDs, new IDs, estimated costs, and budget. It stays fixed while the student grades cards or reloads. Recompute on a new study day or an explicit plan edit. Preserve completed work during edits. Do not silently add new cards after a fast completion. **Una tarjeta más** adds exactly one explicit extra, without moving the original daily finish line.

Initial cost estimates are derived from front/back reading length and card structure, excluding collapsed source notes. New study includes recall time; reviews are shorter. Calibrate estimates from enough real active-time samples (at least5per new/review class), use a robust median ratio, and clamp adjustments to0.5–2.5times the initial estimate. Exclude pauses and hidden-tab time. Ignore calibration samples shorter than10seconds. Daily target cards define completion; the estimated time is not a forced timer.

## Persistence

This release saves locally on the current device in IndexedDB. Say **Guardado en este dispositivo**. Account/cloud sync is outside this request. JSON export/import keeps a recovery route. Existing browser comments and library practice flags must not be deleted.

Writes must be transactional and revision-checked. Only celebrate and advance after the write succeeds. Prevent double submissions. A stale tab must load the current saved state before writing. If storage fails, retain the in-memory state with a clear export/retry notice; never claim it is saved. Invalid backups do not replace data. Plan edits preserve history and FSRS. Undo restores the last rating and prior memory state.

Legacy library flags can be imported once as prior exposures. Do not invent past grades or timestamps. Imported cards get an uninitialized memory card and baseline reviews spread across seven days. Label them as imported. Free practice in the library remains separate and is labeled; planned recall happens in Today.

## Technical interfaces

Add `study/index.json` with `schema_version:1`, `content_sha256`, and ordered lightweight card metadata. Manifest gains `planner:{url:"index.json",cards:2900,sha256}`. No answer titles or cases in the metadata. A card record is:

```ts
type CoachCard = {
  id:string; section_id:string; block_id:string; family:"eje"|"madre";
  level:number; order:number; new_seconds:number; review_seconds:number;
};
```

Clinical card IDs, content, source hashes, and Anki identities stay intact. Card bodies load by section only when needed and are cached by content hash. Use the same `StudyCard` display for source fidelity, with an optional controlled rating area and reveal callback for the coach. Recognition fronts must not disclose answers through labels.

Pure planning code lives in `app/src/coach/engine.ts` and shared types in `types.ts`. Export `emptyState`, `selectedCards`, `dayKey`, `addDays`, `dayDiff`, `estimatePlan`, `createAssignment`, `recordReview`, `undoReview`, `summary`, `validateState`, and `importLegacy`. Exact TypeScript contracts are recorded in the plan. IndexedDB adapter, resource loading, setup, Today, session feedback, and backups are separate modules.

## Visual direction

Keep Manrope for controls and Lora for clinical vignettes. Use violet ink `#493060`, lilac `#eee5f7`, paper `#ffffff`, soft background `#f7f8fc`, amber `#ffdfac`, and a success teal `#277c69`. Small text needs sufficient contrast. The memorable element is an animated daily path: completed card markers lead toward today's finish flag. The course bar remains visible below it. A focused card is the main visual surface, not a grid of competing dashboards. On phones, show progress before the card and keep grading controls easy to reach.

## Required verification

- Deadline/time forecasts include repeated reviews and use the actual queue algorithm.
- Tiny budgets, impossible/past deadlines, leap days, DST, missed days, all-covered courses, and plan-scope changes behave explicitly.
- Repeated grading/reload cannot move the target, award duplicate daily credit, or overwrite a newer tab.
- Reveal, pause, hidden time, undo, failed saves, malformed backups, and invalid card loads do not fabricate progress.
- Both plan modes, real-card study, automatic advancement, per-card and daily celebrations, reduced motion, reload persistence, backups, and320pxlayout are tested in browser.
- Existing clinical-content audits, all Anki downloads, old sample routes, and review comments still pass.
- Publish only to enarm.musel.dev. Verify the public site, downloads, and existing timer health.
