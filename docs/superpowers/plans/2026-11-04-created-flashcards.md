# Personal Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Create and study private flashcards during sessions, and suspend or restore any flashcard.

**Architecture:** Extend the existing optional version-1 progress fields. Merge personal cards into read-only library resources in memory. Use the current confirmed-write API for all changes.

**Tech Stack:** React, TypeScript, Node, SQLite, Playwright, npm, uv.

**Spec:** `docs/superpowers/specs/2026-11-04-created-flashcards-design.md`

## Global Constraints

- Preserve unrelated work and use the topic branch `feat/created-flashcards`.
- Save all personal content through the existing confirmed-write path.
- Keep private content, progress codes, and credentials out of logs and URLs.
- Preserve strict validation, import recovery, retry safety, and undo behavior.
- Preserve all reviewed clinical content and generated artifacts.
- Do not publish, deploy, or merge without current authorization.
- Use existing project dependencies and style conventions.

## Review Focus

- Legacy plans can select only Creadas without editing the plan first.
- A suspended target cannot leave a session blocked, and history stays unchanged.
- Saving an excerpt does not grade or reveal the source card.
- Lost acknowledgments and reloads retain one personal card per draft ID.
- Text from other cards, hidden answers, or editor controls cannot enter a captured excerpt.

### Task 1: Private data and scheduling

**Files:** `app/src/coach/types.ts`, new `app/src/coach/personal.ts`, `app/src/coach/engine.ts`, `app/src/learning/model.ts`, new `tests/unit/personal-cards.test.ts`, `tests/unit/progress-api.test.ts`.

**Interfaces:** Produce `CardFamily`, `PersonalCard`, optional `CoachState.created_cards` and `CoachState.suspended_cards`; `personalIndex(index, state)`, `personalSection(section, state)`, `addPersonalCard(state, card)`, `setSuspended(state, id, boolean)`. Extend `selectedCards(index, plan, state?)` to include personal cards and exclude suspension. Keep historical assignments unchanged.

- [x] Write failing unit tests for personal-card scheduling, strict validation, same-day goal preservation, suspension/restoration, history, and undo. Write API persistence/retry/import coverage.
- [x] Run `npx tsx --test tests/unit/personal-cards.test.ts tests/unit/progress-api.test.ts`; confirm failure for missing behavior.
- [x] Implement types, bounded data validation, merges, scheduling filters, and active progress denominators. Personal IDs use UUIDs and virtual block IDs use `<section>.creadas`. Old plans include created cards in their selected sections. A Creadas session can use additional-new-card flow.
- [x] Run `npm run test:unit` and `npm run typecheck`; expect no failures. Format changed files.
- [x] Commit `feat: store personal flashcards and suspension in progress` and push.

### Task 2: Shared authoring and suspension controls

**Files:** new `app/src/coach/PersonalCardTools.tsx` and CSS, `app/src/StudyCard.tsx`, `app/src/coach/Session.tsx`, `app/src/coach/Today.tsx`, `app/src/coach/Coach.tsx`, `app/src/learning/TestSession.tsx`, new `tests/personal-cards.spec.ts`.

**Interfaces:** Consume Task 1 state helpers. Add optional personal-card controls to StudyCard using existing store state and commit callbacks passed by parents. Report editor-open state to timers and block grading while editing. No new independent store per card.

- [x] Add browser tests for creation with multiline text, front/back selection, cancel, failure, no grade, keyboard safety, daily new and review contexts, and suspension. Run affected tests and confirm the missing controls fail.
- [x] Implement a plain-text inline editor, captured selection actions, stable draft ID, confirmed save handling, source provenance, timer pause, and suspension. On failure retain the draft. On confirmed suspension remove the current question without a grade.
- [x] Run affected browser tests, `npm run test:unit`, and `npm run typecheck`; expect no failures. Format changed files.
- [x] Commit `feat: create and suspend flashcards during study` and push.

### Task 3: Formats, library restoration, and complete review

**Files:** `app/src/Library.tsx`, `app/src/coach/SessionScope.tsx`, `app/src/coach/PlanSetup.tsx`, `app/src/learning/Learning.tsx`, `README.md`, browser tests.

**Interfaces:** Consume private index/section merges and shared StudyCard tools. Add Creadas to plan, library, daily session, and subtest filters. Add a library Suspendidas view with restoration and no grading.

- [x] Add failing browser tests for creation persistence/reload, Creadas-only sessions on a legacy plan, subtests, a section's virtual block, and suspended library/personal cards with restoration. Confirm failures before implementing.
- [x] Implement merged resources, format choices, empty states, restoration, and study controls in library/subtests. Preserve published inventory counts. Update README with behavior and limits.
- [x] Run `npm run check`; expect all checks to pass. Review the full branch with a fresh reviewer. Fix material findings with regression tests.
- [x] Commit `feat: browse created and suspended flashcards by section` and push. Update PR title/body and mark ready for review. Do not merge or deploy.

## Completion evidence

Implementation used the existing topic branch. No unrelated work was present. Task 1 passed 61 unit tests and type checking before commit `b119017`. Task 2 passed 27 affected browser tests, 61 unit tests, and type checking before commit `d59eda6`.

The final independent review found two Important issues: completed Today counts after suspension, and progress calculations that ignored an explicit index scope. Both received failing unit regressions and fixes. A navigation issue was treated as Important because it could open the wrong clinical topic after suspension. Two browser regressions failed before the navigation fix and passed after it. The full check also caught a subtest retry regression; the existing failed-answer test and a new failed-creation test now pass.

Final `npm run check`: formatting, lint, 33 Python tests, audited library/application build, 64 unit tests, and 86 browser tests passed. The phone editor was visually inspected. Lost creation acknowledgments, backup restoration into an older profile, new/review sessions, subtests, restoration, keyboard behavior, and timer pause were checked.

Builder decisions: an optional `created_cards_enabled` flag preserves inclusion for old plans and explicit exclusion for edited plans. Progress analysis retains its original caller-supplied index scope; callers merge personal content before filtering. No review findings remain deferred. Deployment and clinical review were outside this task. The pull request remains unmerged.
