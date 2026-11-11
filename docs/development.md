# Development

This is the current development reference. Plans under `docs/superpowers/plans/` record individual tasks. Historical plans can describe an earlier architecture.

## Architecture

- `app/src/coach/engine.ts`: pure study scheduling, grading, forecasting, and state validation.
- `app/src/coach/repository.ts`: server reads and writes, revision conflicts, and confirmed snapshot caching.
- `app/src/coach/storage.ts`: IndexedDB cache, profile identity, local recovery, and backup export.
- `app/src/coach/`: daily study UI, account UI, sessions, timers, and progress displays.
- `app/src/learning/`: progress analysis and subtests.
- `server/`: private progress API, accounts, request limits, and online SQLite backup.
- `scripts/`: content compilation, source checks, development runner, and deployment.
- `content/sections/` and `content/reviews/`: authored content and section reviews.

SQLite is authoritative for progress. The browser stores a private progress code and a cache. A server-confirmed write advances the UI. Expected revisions prevent a stale device from replacing newer progress. An identical retry returns its confirmed result. Imports preserve the previous snapshot.

## Setup

Use the Node version in `.node-version`, the Python version in `.python-version`, and uv 0.8.22. CI uses the same versions.

```sh
npm ci
uv sync --locked
npx playwright install chromium
npm run prepare:study
npm run dev
```

Development uses `http://127.0.0.1:4178/`, API port 4187, and `tmp/progress.sqlite`. Use `ENARM_WEB_PORT`, `ENARM_PORT`, and `ENARM_DATABASE` to select other local resources.

Playwright uses its own Chromium installation. Set `CHROME_PATH=/usr/bin/google-chrome` to use installed Chrome instead.

## Checks

```sh
npm run format
npm run lint
npm run typecheck
npm run test:python
npm run test:unit
npm run test:browser
npm run check
```

`format` applies the source formatters. `format:check` checks formatting without writes. `check` runs formatting checks, lint, Python tests, the audited content and application build, Node tests, and browser tests against the built application. CI runs this same command.

Clinical JSON and historical documents are excluded from source formatting. Editing their bytes must be deliberate because content approval uses hashes. Private PDFs are not needed for an unchanged-content build. The tracked source-validation report and reviews must match the authored sections.

## Browser test isolation

Local Playwright runs start a dedicated server with `node scripts/dev.mjs --test`. Test mode creates a fresh database in a private temporary directory. It ignores an inherited `ENARM_DATABASE`. The runner removes the directory after both child processes stop. It raises API limits only for this disposable local server.

The default test ports are 4278 for the web and 4287 for the API. Set `ENARM_TEST_WEB_PORT` and `ENARM_TEST_API_PORT` to change them. Playwright never reuses an existing server. An occupied port causes failure instead of connecting to development data.

```sh
npm run test:browser -- tests/sessions.spec.ts
npm run build
npm run test:browser:preview
```

`PLAYWRIGHT_BASE_URL` selects an explicit remote target and disables the local test server. These tests create accounts and progress on that target. Use it only when a remote check is part of the authorized task.

## Changes and review

Use one topic branch per repair or feature. Preserve unrelated edits. Run checks appropriate to each unit before its commit. Push each commit. Run `npm run check` before final review. Submit a pull request with behavior changes and check results.

The CI workflow runs on pushes and pull requests. Repository administrators can require its `check` job in branch protection. The workflow file alone does not configure branch protection.

## Plans and source material

The 2026-10-29 plans are historical records. Their unchecked boxes are original planning notes, not a current backlog. Deployment authorization recorded in those tasks applied to those tasks only. Use this document for current architecture and the current user request for scope.

For clinical changes, follow the content contract and source-validation instructions in the README. Keep source extraction outside the public tree. Never regenerate an approval hash without the required independent review.

## Clinical layers

`content/layers/` contains guideline-based authoring and independent reviews. Follow `docs/layer-content-contract.md`. The original book sections stay unchanged. `prepare:study:base` compiles and audits the original 2,900 cards. `prepare:study` then validates all 35 layer-2 sections and the layer-1 electrolyte supplement before generating their web data.

During authoring, `npm run build:reviewed` creates a local preview with only sections that already have independent reviews. It still rejects stale or invalid reviews. The interface shows the actual reviewed coverage. This command is for local verification. It does not replace the full `npm run check` required for final review and deployment.

The version-2 progress profile separates `capa1`, `capa2`, `creadas1` and `creadas2`. Each has its own plan and FSRS history. A shared private card catalog records source-layer ownership. The migration retains unknown version-1 identities with explicit ownership metadata. Older clients cannot downgrade a migrated profile. Backups contain the whole profile.

Active session counters, timers and breaks use keys for the selected space and plan. Old global browser values stay preserved. They are not assigned to a new space because they do not identify the cards that produced them. Aggregate sessions from the old profile remain in the migration archive.

Supplemental card IDs use the immutable scenario ID. The family and clinical objective are metadata, so changing them does not create a new scheduled identity. Native personal-card imports must resolve their published origins against the correct layer inventory. A personal card's `section_id` is the section the user chose. It can differ from the source card's section. `source_block_id` must still equal the source card's block. A saved personal card can change only `front` and `back`; `updateSpace` rejects changes to its ID, section, origin, creation time and layer. Explicit migrated references remain recoverable when old content is unavailable.
