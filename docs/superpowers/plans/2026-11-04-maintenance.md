# Code and agent development maintenance plan

> **For agentic workers:** Use superpowers:executing-plans for this approved repair scope. Keep this checklist current. Use one fresh whole-branch reviewer at completion.

**Goal:** Fix the review findings and make development checks repeatable.

**Architecture:** Preserve the study engine and server-authoritative progress. Extract focused account and Today modules. Use disposable local browser test resources.

**Tech Stack:** React, TypeScript, Node SQLite, npm, Python, uv, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-04-maintenance-design.md`.

## Global constraints

- Preserve clinical content, card identifiers, persisted state, and production data.
- Use a topic branch. Verify each unit. Commit and push each unit separately.
- Do not deploy. Historical plans do not extend authorization to this task.

## Review focus

- Rate limits must cover successful registration and concurrent requests before password derivation.
- Invalid enum types must fail both backup validation and API writes.
- Browser tests must not reuse the user's development server or progress database.
- Refactoring must preserve study, timer, settings, account, and save-retry behavior.
- A clean checkout must run the same checks in CI without private PDF files.

## Task 1: Request and creation limits

Files: `server/api.ts`, `server/rate-limit.ts`, `tests/unit/progress-api.test.ts`.

- [ ] Add real HTTP regressions for account request limits, registration limits, and concurrent bursts. Run them and observe failures.
- [ ] Apply request limits before account routes. Reserve registration capacity before password derivation. Keep existing login failure limits.
- [ ] Run Node tests. Commit and push `fix: enforce account request and registration limits`.

## Task 2: Strict state validation

Files: `app/src/coach/engine.ts`, engine and API unit tests.

- [ ] Add malformed mode/kind tests and rejected API-write tests. Observe failures.
- [ ] Require exact enum values. Run Node tests and type checks.
- [ ] Commit and push `fix: reject non-string study state enum values`.

## Task 3: Isolated browser tests

Files: `playwright.config.ts`, `scripts/test-server.mjs`, `scripts/dev.mjs`, Vite config, runner tests.

- [ ] Add a real runner test for disposable database isolation and cleanup. Observe failure.
- [ ] Use dedicated test ports and a temporary database. Disable existing-server reuse. Keep preview and explicit remote tests supported.
- [ ] Run runner and browser tests. Commit and push `test: isolate browser servers and progress databases`.

## Task 4: Readable, focused modules

Files: account HTTP/database/crypto modules, Today presentation/hooks modules, JavaScript and Python tooling/configuration.

- [ ] Add formatting and lint tools with explicit configuration. Format maintained source, tests, and configuration.
- [ ] Extract account handling and Today responsibilities. Preserve behavior under existing tests.
- [ ] Run format, lint, type, Python, and browser checks. Commit and push `refactor: separate account and daily study responsibilities`.

## Task 5: Repeatable checks and instructions

Files: runtime pins, package scripts, CI workflow, `AGENTS.md`, `README.md`, `docs/development.md`, historical plan/spec headers, global instructions.

- [ ] Pin runtimes. Add one full check command and a matching CI workflow.
- [ ] Document setup, disposable tests, current architecture, invariants, branch policy, and validation requirements.
- [ ] Mark historical plans and superseded architecture. Clarify historical authorization.
- [ ] Update global branch/validation guidance and shorten Bluetooth guidance to its runbook link.
- [ ] Run the full check command. Commit and push `chore: enforce repeatable development and agent checks`.

## Task 6: Final review

- [ ] Request one fresh read-only review of the full branch.
- [ ] Fix material findings with regression tests. Run the complete checks after fixes.
- [ ] Push all commits. Create a pull request with results. Record completed tasks and any remaining limits.
