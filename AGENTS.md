# ENARM Contraste

Spanish clinical study application. React and TypeScript serve the UI. A Node/SQLite API owns study progress. Python tools compile reviewed content into web data and Anki packages.

## Start here

- Use `README.md` for setup and product behavior.
- Use `docs/development.md` for architecture, commands, and test isolation.
- Use `docs/deployment.md` only when preparing an authorized deployment.
- Use `docs/superpowers/specs/2026-10-29-full-book-card-contract.md` when editing clinical content.
- Old plans are historical records. Their checkboxes and deployment permissions do not define the current task.

## Work and verification

- Use a topic branch. Preserve unrelated user changes. Do not rewrite shared history.
- Use npm with `package-lock.json`. Use uv with `pyproject.toml` and `uv.lock`.
- Run `npm run test:unit` for engine or API changes. Add a regression test for each defect.
- Run affected browser tests for UI changes. Run `npm run check` before requesting final review.
- Use disposable local test resources. `npm test` starts its own server and temporary database. Remote browser tests write data; use `PLAYWRIGHT_BASE_URL` only for an explicitly requested remote check.
- Check each completed unit before committing. Use Conventional Commits. Push every commit to the topic branch.
- Report changed behavior, checks, and remaining limits. Keep the pull request description current.

## Invariants

- Preserve card IDs, Anki IDs, content hashes, and existing progress unless the task explicitly changes them.
- SQLite on the VPS is authoritative. IndexedDB caches confirmed state. Advance study progress only after server confirmation.
- Preserve revision checks, retry safety, import recovery, and undo behavior.
- Validate unknown data at API, import, storage, and generated-data boundaries. Reject incorrect types without coercion.
- Keep account credentials and progress codes out of logs, URLs, and commits.
- Keep PDF files, raw source extraction, original decks, `.env` files, databases, and backups private.
- Do not edit generated `app/public/study/`, `dist/`, or `dist-server/` files. Regenerate them with the documented commands.
- Content changes require current source validation and an independent review tied to the section hash. Professional clinical review remains pending.
- The user authorizes merge and production deployment as the default completion steps for requested repository changes. After required checks pass, merge the pull request and deploy with `docs/deployment.md`, unless the user explicitly limits the task or withdraws this authorization. Do not leave completed changes at an unmerged pull request. Historical plans alone do not authorize deployment.
