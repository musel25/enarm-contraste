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
- [ ] Write failing tests for unique coverage, first start, errors, next due, milestones, repeated practice, no-plan practice, and undo.
- [ ] Run unit tests to confirm failure.
- [ ] Implement shared FSRS practice recording and derived analytics.
- [ ] Run unit suite. Commit and push.

## Task 2: Clinical exercises and study screens

Files: app/src/learning/{cases.ts,amenorrhea.ts,Learning.tsx,TestSession.tsx,learning.css}; app/src/App.tsx; app/src/Library.tsx; app/src/coach/Today.tsx; tests/learning.spec.ts; tests/unit/learning.test.ts.
Interfaces: clinicalCases(section) returns stable case IDs and source-backed answers. Learning uses existing resource and persistence hooks.
- [ ] Write failing tests for all case levels, amenorrhea breadth, selected subtests, wrong answers, retry, same-session repetition, and reload.
- [ ] Implement section/block analytics, question selection, clinical answer flow, completion notices, and next review dates.
- [ ] Run browser tests and inspect desktop/mobile rendering.
- [ ] Commit and push.

## Task 3: Repository cleanup and verification

Files: README.md; .gitignore as needed.
- [ ] Correct study workflow docs. Ignore reproducible outputs. Preserve sources and parallel work.
- [ ] Run npm test, Python tests, and npm run build.
- [ ] Request independent code review. Fix material findings.
- [ ] Commit and push. Confirm git status.
