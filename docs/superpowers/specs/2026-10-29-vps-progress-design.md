# VPS progress

The user requires study progress to be saved on the VPS. The existing daily coach saves only in IndexedDB. Continue through deployment. Preserve existing progress and independent ENARM hosting.

## Builder choices

- Add a dedicated Node service using built-in SQLite. The VPS already runs Node24.15. Bundle the service and its existing state validator. Do not modify the timer service.
- Store the database at `/var/lib/enarm-contraste/progress.sqlite`, outside web releases. Use WAL, synchronous FULL, transactional revision checks and a systemd service bound to127.0.0.1:4187. nginx proxies only `/api/` on enarm.musel.dev.
- Use a random256-bit private recovery code per student. Keep the code in IndexedDB and send it only as an Authorization bearer header over HTTPS. Store its SHA256 hash on the server. No global shared student profile. No email provider or password setup. The UI explains that the code grants access to progress.
- On first upgrade, create a private server profile and upload existing local plan, history, schedules, daily targets, preferences and Undo. An existing server profile always wins over a stale browser copy. Missing server data can initialize only with expected_revision0.
- Server-confirmed writes are authoritative. Celebrate and advance only after confirmation. Browser caching is secondary; a cache failure after a confirmed server write must not invent a server failure. Network failures pause study and retain the pending candidate for retry/export. Cached progress remains visible when the server is unavailable.
- A SHA256 fingerprint of the complete mutation makes a retried successful request idempotent. Distinct stale requests return409 with the latest state. No silent merging of grades or destructive last-write-wins.
- Validate every state with the existing validator. Reject missing/malformed credentials, cross-origin requests, malformed JSON, oversized bodies and invalid revisions. Return no-store headers. Never log tokens or bodies. Use a bounded per-IP creation/request limit.
- Preserve the pre-import state on the VPS in the same transaction as replacement. GET `/api/progress/previous` retrieves it. A retried import must not replace this recovery snapshot twice.
- The recovery panel shows/copies the private code. A second device can enter it, preview the existing plan, then explicitly connect. Connecting never writes the second device's blank state over the first. Keep its previous code locally for return. Manual JSON backups stay available.
- The interface says “Guardado en el VPS” only when connected. Update the device-only copy. Keep the daily learning experience and clinical content unchanged.
- Add a nightly SQLite online backup under the private data directory. Keep14dated backups. Back up before a service deployment. Service restarts and static releases preserve the database.

## API

`GET /api/health` returns `{ok:true}`. Progress routes require `Authorization: Bearer <43-character base64url code>`.

`GET /api/progress` returns `{state}` or404. `PUT /api/progress` accepts `{expected_revision:number,state:CoachState,preserve:boolean}`. New profiles accept expected0 and return a revision above the imported local revision. Existing profiles require expected=current revision and return revision+1. Identical last requests return the same saved result.409 returns `{state,error}`. `GET /api/progress/previous` returns `{state:null|CoachState}`.

## Acceptance

Test server persistence across restart, independent students, authorization/origin/body validation, concurrent stale writes, idempotent retry and pre-import recovery. Test migration, a second isolated browser, unavailable API, failed cache writes, resume after retry, and all existing daily/clinical flows. Publish and verify a real two-browser save/restore on the VPS. Keep the recovery code out of logs and final output.
