# Code and agent development maintenance

Status: approved scope from the 2026-11-04 code review and the user's instruction to fix all findings.

## Scope

- Limit account requests and account creation before expensive password work. Keep progress request limits and login failure limits effective. Reject bursts from concurrent requests.
- Reject non-string plan modes and session kinds in state validation. Preserve valid saved state and existing identifiers.
- Give local browser tests a disposable database, dedicated ports, and their own server. Keep remote test execution explicit. Support both installed Chrome and Playwright Chromium.
- Pin development runtimes. Add formatting, lint, type checks, content audits, tests, and build checks to one local command and CI.
- Split account handling from progress routing. Split Today presentation and session/timer responsibilities into focused modules without changing product behavior.
- Add a short repository AGENTS.md and current development documentation. Mark old plans and superseded designs as historical. Historical deployment permissions apply only to their original tasks.
- Update the user's global instructions with branch and verification rules. Keep a link to the existing Bluetooth runbook. Preserve all unrelated preferences.

## Architecture and constraints

React uses a pure study engine. The Node/SQLite API is authoritative for progress. IndexedDB caches confirmed snapshots and stores the private progress code. Server revision checks protect concurrent writes. Clinical content, content hashes, card identifiers, Anki identifiers, and production data remain unchanged.

Use the existing npm and uv toolchains. Run repair work on a topic branch. Push every commit. This maintenance request authorizes code and setup changes; production deployment is outside this task.

## Completion

Regression tests must reproduce the two defects before fixes. Existing browser behavior must remain covered. All local checks must pass. A fresh reviewer checks the complete branch. Commits are pushed and a reviewable pull request records the results.
