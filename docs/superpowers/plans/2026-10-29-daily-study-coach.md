# Daily Study Coach Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for integration. Delegate the isolated pure engine with its unit tests; the coordinator owns data generation, persistence and UI. All writers have disjoint files. Steps use TDD. One fresh whole-branch review precedes publication.

**Goal:** Open ENARM directly into a paced daily recall session with deadline/time planning and satisfying, honest progress feedback.

**Architecture:** Lightweight generated index supplies costs and stable IDs. A pure FSRS engine produces the same queue for forecasting and real practice. Transactional IndexedDB stores the plan, daily snapshots and attempts. React presents setup, Today, focused cards, milestones and backups. Existing card bodies remain lazy-loaded.

**Tech Stack:** Existing React/TypeScript/Vite, ts-fsrs5.4.2, tsx4.23.15 for Node unit tests, browser IndexedDB, CSS animation, existing Playwright and VPS deployment.

**Spec:** `docs/superpowers/specs/2026-10-29-daily-study-coach-design.md`.

## Global Constraints

- No clinical-content, source-hash, card-ID or Anki-identity changes.
- Every commit is immediately pushed. Deployment is already authorized.
- FSRS deterministic,0.9retention,no short-term steps,365day maximum. Again due tomorrow. Dates are calendar days in the saved timezone.
- Deadlines inclusive;5–720minutes/day;730day forecast horizon. Forecast assumes future Good ratings and never invents a feasible date.
- Daily targets are saved and stable. Reveal alone earns no credit. Rating credits each assigned card once per day. Coverage is distinct first exposure, not mastery.
- Locally saved data must say current device. IndexedDB transaction/revision protection, backup validation, undo and storage-error recovery are required.
- Source labels and answer titles do not appear on recognition fronts. Respect reduced motion; sound defaults off.

## Review Focus

- A due backlog or card larger than the remaining budget must not produce a false deadline or silently hide work.
- A grade, reload, new day, plan edit or Undo must not refill the original target or double-count completion.
- Pausing, changing visibility and midnight must not fabricate study time or assign a rating to the wrong day.
- Two tabs, blocked storage and malformed backups must not overwrite saved progress or report a failed write as saved.
- Selected subsets, old saved practice, unavailable card data, reduced motion and narrow phones must stay usable.

## Shared model contract

`app/src/coach/types.ts` exports the following. Snake-case metadata matches generated JSON.

```ts
type Grade = 1|2|3|4;
type CoachCard = {id:string;section_id:string;block_id:string;family:"eje"|"madre";level:number;order:number;new_seconds:number;review_seconds:number};
type CoachIndex = {schema_version:1;content_sha256:string;cards:CoachCard[]};
type StudyPlan = {id:string;revision:number;mode:"deadline"|"time";start_day:string;deadline_day:string|null;minutes_per_day:number;section_ids:string[];families:("eje"|"madre")[];timezone:string};
type Memory = {card:SerializedFSRS|null;due_day:string;introduced_day:string;last_rating:Grade|null;imported:boolean};
type Attempt = {id:string;card_id:string;day:string;rating:Grade;elapsed_seconds:number;was_new:boolean;estimated_seconds:number};
type Assignment = {day:string;plan_key:string;ids:string[];new_ids:string[];costs:Record<string,number>;budget_seconds:number;extra_ids:string[]};
type CoachState = {version:1;revision:number;plan:StudyPlan|null;progress:Record<string,Memory>;history:Attempt[];days:Record<string,Assignment>;celebrated_days:string[];celebrated_plans:string[];preferences:{sound:boolean;low_motion:boolean};undo:{attempt_id:string;previous:Memory|null}|null};
type Forecast = {feasible:boolean;finish_day:string|null;daily_minutes:number;total_seconds:number;remaining_new:number;reason?:string};
type StudySummary = {today_done:number;today_goal:number;pending_ids:string[];extra_done:number;new_done:number;reviews_done:number;covered:number;total:number;coverage_percent:number;today_seconds:number;remaining_seconds:number;backlog_due:number;correct_today:number;attempts_today:number;due_tomorrow:number};
```

`SerializedFSRS` is the library Card with ISO strings for due/last_review. Memory dates are not invented for legacy imports; `imported:true` identifies baseline exposure.

Pure exports from `engine.ts`:

```ts
emptyState():CoachState;
selectedCards(index:CoachIndex,plan:StudyPlan):CoachCard[];
dayKey(timezone:string,now?:Date):string;
addDays(day:string,count:number):string;
dayDiff(start:string,end:string):number;
estimatePlan(state:CoachState,index:CoachIndex,day:string):Forecast;
createAssignment(state:CoachState,index:CoachIndex,day:string,budgetMinutes?:number):Assignment;
recordReview(state:CoachState,index:CoachIndex,cardId:string,rating:Grade,elapsedSeconds:number,day:string,attemptId:string):CoachState;
undoReview(state:CoachState):CoachState;
addExtra(state:CoachState,index:CoachIndex,day:string):CoachState;
summary(state:CoachState,index:CoachIndex,day:string):StudySummary;
validateState(value:unknown):value is CoachState;
importLegacy(state:CoachState,index:CoachIndex,flags:Record<string,"known"|"again">,day:string):CoachState;
```

Functions are pure and do not increment state.revision; the storage transaction does. Duplicate attempt IDs are idempotent. `recordReview` rejects unknown/unselected IDs and invalid grades/times. The UI saves a created assignment in state.days before rating. Existing matching assignments are returned unchanged. Explicit plan edits increment plan.revision and rebuild pending work while retaining eligible completed work. `summary` counts only selected IDs and assigned daily IDs; extra attempts stay separate. Celebration flags are set by recordReview only when a nonzero daily target or selected first-pass course is newly complete. Undo removes the latest attempt and restores its previous Memory, retaining the original target and one-time celebration flags.

## Task 1: Pure planner and review engine

**Owner:** engine implementer. **Files:** `app/src/coach/types.ts`, `engine.ts`, optional focused pure helper files in that folder; `tests/unit/coach-engine.test.ts`.

- [ ] Write failing unit tests for deadline/time estimates with reviews, due-first budgets, impossible/past deadlines, DST/leap days, all-covered courses, fixed targets, scopes, missed days, duplicate grades, Undo, legacy exposure and invalid backups.
- [ ] Implement the shared contract. Use one selection algorithm for forecast and assignment; keep future FSRS transitions efficient enough for2900cards.
- [ ] Run `npm run test:unit`; run representative2900card timing/deadline scenarios and report runtime and resulting estimates.
- [ ] Coordinator checks output, commits this unit and pushes.

## Task 2: Index and durable state

**Owner:** coordinator. **Files:** `scripts/build_full_decks.py`, `scripts/verify_full_library.py`, Python tests; `app/src/coach/resources.ts`, `storage.ts`, browser persistence tests; package/config setup.

- [ ] RED tests for metadata preserving all2900IDs with positive costs and manifest checksum.
- [ ] Generate `study/index.json`. Estimate new seconds from main front/back word counts at180wpm plus25s recall, minimum30s. Estimate review from front words at220wpm plus12s, minimum15s, and always below new cost. Exclude collapsed bibliography/corrections.
- [ ] Add pinned dependencies and separate Node unit-test collection from Playwright.
- [ ] Implement validated metadata loading and section cache. Reject wrong hashes/shapes and expose retry.
- [ ] Implement IndexedDB version1 with state/revision in one readwrite transaction, conflict handling, fallback unsaved state, backup export/validated import and one-step Undo support. Never delete old browser keys.
- [ ] Verify failed/stale writes and malformed imports in browser, then commit/push.

## Task 3: Plan setup and Today experience

**Owner:** coordinator. **Files:** `app/src/coach/{Coach,PlanSetup,Today,Session,Feedback}.tsx`, `coach.css`, focused hooks; `App.tsx`, optional `StudyCard.tsx` presentation extensions; browser tests.

- [ ] RED browser flows for both setup modes, selected scope, saved plan reload, Today's visible card, grade-only progress, automatic next card, fixed targets and daily/overall milestones.
- [ ] Implement plan setup with honest live forecast and local-device notice. Save after feasibility check. Preserve history while editing.
- [ ] Implement the focused card session with hidden answers, four self-ratings, upcoming due previews, active-time pause/visibility handling, save lock and failure recovery.
- [ ] Show daily path, coverage, review backlog, remaining time, accuracy and last14days of activity. Add plan edit, backup and Undo controls.
- [ ] Implement per-card and daily rewards, single extra-card action, reduced-motion and optional sound. No celebration on failed writes.
- [ ] Make Today the default route. Preserve explicit library/sample routes and original comments. Label library practice as free practice.
- [ ] Verify320pxphone, keyboard/focus, blocked storage, cross-tab conflict, mid-session reload, and day rollover. Commit/push each coherent unit.

## Task 4: Final verification and deployment

- [ ] Run pure unit tests, existing30Python audits, strict deck build and complete browser suite against built output.
- [ ] Fresh whole-branch review against the spec, including representative real-card sessions, forecast accuracy and persistence failures. Fix Important/Critical findings with RED→GREEN tests.
- [ ] Push, integrate the tested commit and deploy with the existing isolated ENARM script.
- [ ] Check public plan setup, Today, saved progress, animations/reduced motion, card downloads and timer health. Keep user study data intact.
