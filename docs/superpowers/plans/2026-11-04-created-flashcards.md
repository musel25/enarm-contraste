# Personal Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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

- [ ] Write failing unit tests for personal-card scheduling, strict validation, same-day goal preservation, suspension/restoration, history, and undo. Write API persistence/retry/import coverage.
- [ ] Run `npx tsx --test tests/unit/personal-cards.test.ts tests/unit/progress-api.test.ts`; confirm failure for missing behavior.
- [ ] Implement types, bounded data validation, merges, scheduling filters, and active progress denominators. Personal IDs use UUIDs and virtual block IDs use `<section>.creadas`. Old plans include created cards in their selected sections. A Creadas session can use additional-new-card flow.
- [ ] Run `npm run test:unit` and `npm run typecheck`; expect no failures. Format changed files.
- [ ] Commit `feat: store personal flashcards and suspension in progress` and push.

### Task 2: Shared authoring and suspension controls

**Files:** new `app/src/coach/PersonalCardTools.tsx` and CSS, `app/src/StudyCard.tsx`, `app/src/coach/Session.tsx`, `app/src/coach/Today.tsx`, `app/src/coach/Coach.tsx`, `app/src/learning/TestSession.tsx`, new `tests/personal-cards.spec.ts`.

**Interfaces:** Consume Task 1 state helpers. Add optional personal-card controls to StudyCard using existing store state and commit callbacks passed by parents. Report editor-open state to timers and block grading while editing. No new independent store per card.

- [ ] Add browser tests for creation with multiline text, front/back selection, cancel, failure, no grade, keyboard safety, daily new and review contexts, and suspension. Run affected tests and confirm the missing controls fail.
- [ ] Implement a plain-text inline editor, captured selection actions, stable draft ID, confirmed save handling, source provenance, timer pause, and suspension. On failure retain the draft. On confirmed suspension remove the current question without a grade.
- [ ] Run affected browser tests, `npm run test:unit`, and `npm run typecheck`; expect no failures. Format changed files.
- [ ] Commit `feat: create and suspend flashcards during study` and push.

### Task 3: Formats, library restoration, and complete review

**Files:** `app/src/Library.tsx`, `app/src/coach/SessionScope.tsx`, `app/src/coach/PlanSetup.tsx`, `app/src/learning/Learning.tsx`, `README.md`, browser tests.

**Interfaces:** Consume private index/section merges and shared StudyCard tools. Add Creadas to plan, library, daily session, and subtest filters. Add a library Suspendidas view with restoration and no grading.

- [ ] Add failing browser tests for creation persistence/reload, Creadas-only sessions on a legacy plan, subtests, a section's virtual block, and suspended library/personal cards with restoration. Confirm failures before implementing.
- [ ] Implement merged resources, format choices, empty states, restoration, and study controls in library/subtests. Preserve published inventory counts. Update README with behavior and limits.
- [ ] Run `npm run check`; expect all checks to pass. Review the full branch with a fresh reviewer. Fix material findings with regression tests.
- [ ] Commit `feat: browse created and suspended flashcards by section` and push. Update PR title/body and mark ready for review. Do not merge or deploy.
