# VPS Progress Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Steps use TDD. One fresh whole-branch reviewer precedes deployment. The user's standing instruction authorizes autonomous completion through VPS deployment.

**Goal:** Save each student's daily coach progress on the VPS and restore it on another device with a private code.

**Architecture:** A dedicated bundled Node/SQLite API stores validated coach snapshots with revision checks. The browser keeps the recovery code and a cache. Server acknowledgment controls progress. nginx and systemd keep API and data independent of static releases.

**Tech stack:** Existing React/TypeScript/Vite, Node22.21+ built-in SQLite (VPS24.15), IndexedDB, node:test, Playwright, nginx/systemd.

**Spec:** `docs/superpowers/specs/2026-10-29-vps-progress-design.md`.

## Global constraints

- Clinical content, timer service and stable card identities stay unchanged.
- Each coherent commit is immediately pushed. Use the existing native worktree and feature branch.
- Bearer codes have256bits of entropy. Store only code hashes in SQLite. No tokens in URLs, logs or public files.
- Revision checks and pre-import copies occur in one database transaction. Replay identical mutations without duplicating a grade or replacing the recovery copy.
- Maximum request20MB. Responses no-store. The database and14daily backups live outside release directories.
- A failed server write cannot advance a card. A confirmed server write survives a browser-cache failure. Cached data stays available for export during an outage.

## Review focus

- An ambiguous network failure followed by retry must not duplicate a response or corrupt pre-import recovery.
- Migration, simultaneous first tabs and switching profiles must not upload stale or blank state over another student's progress.
- A service restart or failed deployment must preserve the database and its backups.
- Missing/wrong codes, cross-origin requests, oversized bodies and stale revisions must fail without exposing another profile.
- Cached writes, pending attempts, paired-device conflicts and browser storage failures must show an honest saved status.

## Task1: Durable progress API

Files: `server/{api,main,vite.config}.ts`, `tests/unit/progress-api.test.ts`, package/build config.

- [ ] RED: tests call real HTTP API against a temporary SQLite database. Assert auth/origin rejection; create/migrate; reopen database; separate codes; stale409; identical PUT retry; pre-import snapshot; invalid/oversized state.
- [ ] Implement `createProgressServer({database,origin,maxBytes?})` returning an http.Server and closeable database. Reuse `validateState`.
- [ ] Bundle a dependency-free server entry with Vite SSR and include server code in type checks.
- [ ] GREEN: Node suite and TypeScript pass. Commit/push.

## Task2: Browser migration and recovery

Files: `app/src/coach/{storage,repository,cloud,hooks,CloudPanel,Coach,PlanSetup,Today,BackupPanel}`, browser tests.

- [ ] RED: real API integration checks migration, a second browser/code, isolation, a failed network write/retry, stale device, successful remote save with failed local cache, and server-side import recovery.
- [ ] Add atomic IndexedDB identity creation, exact remote cache adoption, prior-profile retention and local cached-state access.
- [ ] Implement authenticated API calls and repository orchestration. Fetch server state on open. Initialize only missing profiles. Validate responses. Preserve pending attempts and distinguish offline cached state.
- [ ] Add private-code display/copy/connect preview, latest-state reload and accurate VPS labels. Keep JSON backup/import and fetch the previous snapshot from the VPS.
- [ ] Update existing tests where server authority changes the expected storage behavior. GREEN all browser/unit checks. Commit/push.

## Task3: Deployment and backup

Files: `deploy/enarm-progress.*`, nginx config, deploy scripts, README/runbook.

- [ ] Add a dedicated least-privilege service, persistent data directory, loopback proxy, online backup command/timer and14-day retention.
- [ ] Update deploy to upload the server outside the public web root, back up data, validate service health, and roll back the service symlink with the static release on failure.
- [ ] Run strict content build, Python, Node and production-browser suites. Use a fresh whole-branch review; fix Important findings with regressions.
- [ ] Push/merge, deploy, and verify real VPS two-device progress plus restart persistence, snapshots/backups, downloads and timer health.
