# Study Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the application. Independent clinical authors use superpowers:dispatching-parallel-agents. Steps use checkbox syntax for tracking.

**Goal:** Implement four daily study spaces and source-reviewed layer 2 for the existing curriculum, plus water and electrolyte disorders in both layers.

**Architecture:** A version-2 profile holds four version-1 study states and a shared private card catalog. React context selects a space. A deterministic migration preserves the existing memories and history. A supplemental compiler produces source-reviewed content without changing the original authored sections or Anki identities.

**Tech Stack:** React, TypeScript, Node, SQLite, npm, Python and uv.

**Spec:** `docs/superpowers/specs/2026-11-06-study-layers-design.md` (approved).

## Global Constraints

- Four keys: `capa1`, `capa2`, `creadas1`, `creadas2`.
- Preserve original card IDs, Anki IDs, section hashes, FSRS memories and answer history.
- SQLite remains authoritative. Only confirmed writes advance study.
- Preserve revision checks, retry safety, import recovery and undo.
- Validate types without coercion at every boundary.
- Do not write generated content by hand or publish private source files.
- All 35 sections need current source checks and independent review before completed coverage is claimed.
- Commit and push each completed unit. Do not merge or deploy.

## Review Focus

- A client using version 1 after migration must not erase version-2 data. Task 1 tests rejection.
- Historical IDs absent from today's index must survive migration. Task 1 tests unknown IDs.
- Creating a card from either layer must not insert it into the source session. Task 2 tests both routes.
- Backups must include all four spaces and restore the previous profile after failure. Task 2 tests round trips.
- Shared clinical links must not create duplicate memories or answer leaks. Tasks 3 and 4 test identity and fronts.

## Task 1: Profile migration and transport

**Files:** Create `app/src/coach/profile.ts`, `tests/unit/study-profile.test.ts`. Modify `app/src/coach/types.ts`, `personal.ts`, `engine.ts`, `cloud.ts`, `storage.ts`, `repository.ts`, `server/api.ts`, `tests/unit/progress-api.test.ts`.

**Interfaces:** Export `StudySpace`, `StudyProfile`, `isStudyProfile(value)`, `migrateProfile(state)`, `spaceState(profile, space)`, `updateSpace(profile, space, state)`. Transport accepts `CoachState | StudyProfile`. Inner engine states remain version 1. A projection carries runtime `workspace` and its layer's personal catalog. Profile updates strip runtime metadata from inner states. A migration archive preserves original plans, assignments and aggregate sessions; the server also preserves the complete pre-migration profile.

- [x] Add failing tests for splitting histories and assignments without changing memory, unknown IDs, deterministic retries, personal origins, malformed profiles and single-space updates.
- [x] Run `npx tsx --test tests/unit/study-profile.test.ts`; confirm failure because the profile interface does not exist.
- [x] Implement the profile types, strict validation, migration, space projection and updates.
- [x] Add a failing API test for version downgrade after migration; retain identical retry and previous-state recovery checks.
- [x] Adapt transport and storage. Keep legacy reads valid. Preserve the original state on first migration. Reject stale version-1 writes after a version-2 save.
- [x] Run `npm run test:unit` and `npm run typecheck`. Both must pass.
- [x] Commit `feat: isolate study progress in four profile spaces`; push.

## Task 2: Four daily views and card ownership

**Files:** Create `app/src/coach/StudySpace.tsx`, `tests/study-layers.spec.ts`. Modify `App.tsx`, `Library.tsx`, `learning/Learning.tsx`, `coach/hooks.ts`, `Coach.tsx`, `PlanSetup.tsx`, `PersonalCardTools.tsx`, `BackupPanel.tsx`, `resources.ts`, styles and affected browser tests.

**Interfaces:** `StudySpaceProvider` supplies the active key. `useCoachStore()` returns the selected `CoachState` and commits through `updateSpace`. `layerOf(space)` returns 1 or 2. `loadResources(signal?, layer = 1)` returns a manifest and index. `loadSection(id, hash)` routes by the index hash, so concurrent requests cannot select another layer's section.

- [x] Add browser tests for four principal tabs, isolated new/review queues, reload, creation from each layer, failed saves and a narrow screen.
- [x] Run the new test file. Confirm that the four-tab test fails.
- [x] Add the context and hash routes. Retain `#hoy` as an alias. Preserve the existing visual style and keyboard focus. Use a wrapping navigation layout.
- [x] Project personal content for editing, but include it in the index only in personal spaces. Enforce source-layer ownership in the profile update.
- [x] Add space selectors to Biblioteca and Mi avance. Remount their state when changing space. Keep each card's grading in its owning space.
- [x] Export/import the whole profile. Validate referenced identities for each layer before accepting a backup. Show the true total of answers across spaces.
- [x] Adapt tests whose former mixed-card behavior was explicitly changed. Preserve their storage, undo, failure and timing assertions.
- [x] Run affected browser tests, `npm run test:unit` and `npm run typecheck`. All must pass.
- [x] Commit `feat: add independent daily tabs for study layers`; push.

## Task 3: Source-backed supplemental compiler

**Files:** Create `scripts/build_layers.py`, `tests/test_layers.py`, `docs/layer-content-contract.md`. Modify `package.json`, `app/src/library-types.ts`, `coach/resources.ts`.

**Interfaces:** Authoring follows `docs/layer-content-contract.md`. Compile into `app/public/study/` after the original deck audit. Add section 35 to the layer-1 web manifest and index. Compile layer 2 under `study/layers/capa2/`. Preserve original Anki packages. Every layer-2 card ID starts with `capa2/`; block and section IDs remain numeric. Supplemental metadata records source/review status and coverage.

- [x] Write failing Python tests for missing/stale independent reviews, unknown source references, insufficient coverage, duplicate IDs, answer leaks and stable original cards.
- [x] Run `uv run python -m unittest tests/test_layers.py`; confirm missing compiler failure.
- [x] Implement source and review validation, unique scenario coverage, the compiler and manifest/index hashing.
- [x] Compile each scenario as one independently scheduled card. Use family `eje` for explicit contrasts; use `madre` and a compatible level for other objectives. Do not duplicate the same vignette just to create cards.
- [x] Make `prepare:study` run the original compiler and audit before the supplemental compiler. Load layer 2 by its own root and hash.
- [x] Run Python tests and `npm run prepare:study` after reviewed authoring exists. All 41 Python tests and strict full compilation pass for all 35 reviewed sections.
- [x] Commit `feat: compile independently reviewed clinical layers`; push.

## Task 4: Clinical authoring and independent review

**Files:** Create `content/layers/capa2/01.json` through `35.json`, `content/layers/capa1/35.json`, and corresponding reviews. Leave original sections unchanged.

**Interfaces:** Exact schema is in `docs/layer-content-contract.md`. Every section covers its source anchors and has more distinct scenarios than its original vignette count. Source references include actual document version and check date. Review approval is tied to the exact canonical JSON hash.

- [x] Assign disjoint section ranges to independent clinical authors. Each author researches primary Mexican and international references and writes only their assigned files.
- [x] Write genuine variants, neighboring differentials, incomplete presentations, missing-data decisions and severity-dependent initial actions. Use the user's eight functions as a guide, not a quota.
- [x] Author all ten electrolyte blocks in both layers. Use adult guidance only for adult cases. Record national-source limitations rather than claiming an old guide is recent.
- [x] Rotate authors for independent review of other ranges. Review source support, every vignette, the discriminating data, uncertainty and initial action. Fix issues before recording approval.
- [x] Run compiler coverage validation. Missing sections, missing anchors, stale reviews or insufficient unique cases must fail.
- [x] Commit reviewed sections in self-contained batches and push every commit.

## Task 5: Complete verification and review

**Files:** Update `README.md`, `docs/development.md`, the current PR and this plan's checked steps.

- [x] Run `env -u PLAYWRIGHT_BASE_URL npm run check` using disposable local resources. Confirm all checks pass.
- [x] Inspect desktop and phone screenshots of all four daily tabs and the library selector.
- [x] Compare original authored section hashes and Anki IDs with the branch base. Original34 section bytes and2,900 planner entries match the original compiler output. Both packages retain identical GUIDs, model/deck IDs, fields and card relationships.
- [x] Request an independent whole-branch review. Resolve important findings with regression tests. A second independent review found no remaining code issues; final integrated verification also passes.
- [x] Update the PR with actual section/case counts, checks and remaining clinical-review limits. Mark it ready for review when the complete scope is verified. Do not merge or deploy.
