# Daily Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dated checklist that saves in the student's profile and can show prior days.

**Architecture:** Store an optional dated task map in the version 3 profile. Use the existing confirmed profile API. Render a separate route behind the account gate.

**Tech Stack:** React, TypeScript, Node, SQLite, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-daily-checklist-design.md`

## Global Constraints

- Keep profile version 3 and existing card identities and study progress.
- Show a mutation only after server confirmation.
- Use the existing code and revision mechanism.

## Review Focus

- A malformed date, task, duplicate ID, or unexpected field is rejected.
- An old profile without checklist data still opens.
- Failed and conflicting writes do not display an unconfirmed change.
- Reload and account access preserve both today's and yesterday's data.
- Small screens keep the form and date controls usable.

---

### Task 1: Profile data

**Files:** `app/src/coach/types.ts`, `app/src/coach/profile.ts`, `tests/unit/study-profile.test.ts`

- [ ] Write unit tests for valid dated tasks, absent checklist, and malformed values.
- [ ] Run the focused unit test and see the new cases fail.
- [ ] Add the optional field and strict validation.
- [ ] Run the focused unit test and `npm run test:unit`.
- [ ] Commit and push the unit.

### Task 2: Checklist screen

**Files:** `app/src/App.tsx`, `app/src/coach/DailyChecklist.tsx`, `app/src/coach/daily-checklist.css`, `tests/daily-checklist.spec.ts`, `README.md`

- [ ] Write browser tests for adding, completing, reopening, history, reload, and a failed write.
- [ ] Run the focused browser test and see the new cases fail.
- [ ] Add the route and screen with confirmed profile writes.
- [ ] Run the focused browser tests, `npm run check`, and review the screen at phone width.
- [ ] Commit and push the unit.

### Task 3: Review and release

- [ ] Review the final diff and open a pull request.
- [ ] Merge after checks pass and deploy with `docs/deployment.md`.
