# Study Progress and Tests Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Make study progress, selected subtests, and diagnostic practice available across the library.

**Architecture:** Derive analytics from the existing CoachState. Add a practice review function that shares FSRS and writes through useCoachStore. Add focused components under app/src/learning and a Mi avance route.

**Tech Stack:** React 19, TypeScript, ts-fsrs, node:test, Playwright.

**Spec:** docs/superpowers/specs/2026-10-29-study-progress-tests-design.md

## Global Constraints

Spanish product text. Preserve persistence interface, source audits, original card IDs, and other agent changes. Commit and push each self-contained unit.

## Review Focus

- Practice before creating a daily plan must save valid state.
- Repeated attempts must not inflate unique coverage.
- Errors on a multi-case Eje card must not be attributed to every topic.
- Save failure must retain the active question and allow retry.
- New section loading must not display cases or answers from the previous section.

## Task 1: Progress and practice model

Files: app/src/learning/model.ts; app/src/coach/engine.ts; tests/unit/learning.test.ts.
Interfaces: progressRows(state, index, day); completionNotices(before, after, index); recordPractice(state, meta, grade, seconds, day, id).
- [x] Write failing tests for unique coverage, first start, errors, next due, milestones, repeated practice, no-plan practice, and undo.
- [x] Run unit tests to confirm failure.
- [x] Implement shared FSRS practice recording and derived analytics.
- [x] Run unit suite. Commit and push.

## Task 2: Clinical exercises and study screens

Files: app/src/learning/{cases.ts,amenorrhea.ts,Learning.tsx,TestSession.tsx,learning.css}; app/src/App.tsx; app/src/Library.tsx; app/src/coach/Today.tsx; tests/learning.spec.ts; tests/unit/learning.test.ts.
Interfaces: clinicalCases(section) returns stable case IDs and source-backed answers. Learning uses existing resource and persistence hooks.
- [x] Write failing tests for all case levels, amenorrhea breadth, selected subtests, wrong answers, retry, same-session repetition, and reload.
- [x] Implement section/block analytics, question selection, clinical answer flow, completion notices, and next review dates.
- [x] Run browser tests and inspect desktop/mobile rendering.
- [x] Commit and push.

## Task 3: Repository cleanup and verification

Files: README.md; .gitignore as needed.
- [x] Correct study workflow docs. Ignore reproducible outputs. Preserve sources and parallel work.
- [x] Run npm test, Python tests, and npm run build.
- [x] Request independent code review. Fix material findings.
- [x] Commit and push. Confirm git status.

## Verification record

- `npm test`: 29 unit tests and 52 browser tests passed.
- `uv run python -m unittest discover -s tests -p 'test_*.py'`: 32 tests passed.
- `npm run build`: generated and audited the original 2,900 cards and both Anki packages; production build passed.
- Desktop and mobile screenshots inspected. The 320 px browser test reports no horizontal overflow.
- Independent review identified diagnostic Undo queue blocking, stale completion notices, keyboard focus loss, missing source pages, diagnostic backup rejection, legacy mark resurrection after Undo, missing retry notices, and stale asynchronous backup validation. Fixes include browser regressions for all behavior defects.
- New Library answers use the canonical Coach state. Old Library marks remain read-only. Diagnostic cases use stable `clinical/<block>/<topic>/<difficulty>` IDs in the same state version and save interface.
- Removed unused `.gitkeep` files. Ignored operating-system and TypeScript cache files. Preserved private source inputs and other agent work.
- Deployment and VPS persistence are outside this change and remain with the parallel work.
