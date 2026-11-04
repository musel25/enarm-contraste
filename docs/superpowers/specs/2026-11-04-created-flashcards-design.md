# Personal flashcards and suspension

Status: approved by the user on 2026-11-04. Proceed with implementation and routine builder decisions without further design approval.

Builder check: an independent software-engineer reviewer found no important questions left before planning.

## Purpose

During a new-card or review session, the student can create a personal flashcard without leaving the current question. The student can select details from the front or back, paste information, and save a question and answer. The new card belongs to the current section. The student can study only these cards through a third format, **Creadas**.

The student can suspend any flashcard that they no longer want to study. A separate list lets them inspect and restore suspended cards. Suspension preserves content and study history.

## Requested behavior

- Add **Añadir flashcard** beside the current flashcard in new-card and review sessions.
- Let the student use selected text from either visible side of the current card.
- Let the student type and paste text into the new card.
- Save the new card in the current card's section.
- Show these cards as an extra **Creadas** block in that section.
- Add **Creadas** to format filters so the student can study that format alone.
- Add suspension and a way to inspect and restore suspended cards.

## Implementation choices proposed by the builder

These are defaults, not user decisions.

### Ownership and storage

Personal cards and suspension flags belong to the current progress profile. They use the existing revision-checked API and authoritative SQLite snapshot. The IndexedDB cache and progress JSON export/import include them. They synchronize through the student's existing account or private progress code.

Keep the state version compatible with existing version-1 backups. Add optional fields for personal cards and suspended card IDs. Older snapshots without these fields remain valid. Validate all new data on reads, writes, and imports. Accept strings and booleans only where specified. Reject invalid field types, duplicate IDs, forbidden object keys, and excessive text or collection sizes.

Personal cards use stable IDs in a separate namespace, such as `created/<uuid>`. Store their section ID, source card ID, source block ID, front text, back text, and creation timestamp. The source card ID supplies provenance; it does not authorize changes to source content. Personal cards remain valid if a later library revision removes the source card.

Do not change generated clinical cards, existing IDs, Anki packages, source hashes, or review approvals. Personal text is private study content. The app must distinguish it from reviewed library content.

### Create a card

Use the current React, TypeScript, Node, and SQLite structure. Add the action to daily sessions, library cards, and flashcard subtests through shared card controls.

Open an inline editor with **Frente**, **Reverso**, **Guardar flashcard**, and **Cancelar**. Show the destination section and **Creadas**. Both text fields are required. Native textareas accept multiline paste and retain plain text. Render saved text through React text nodes. Preserve line breaks. Do not interpret HTML from pasted text.

Selecting text within the displayed front or revealed back enables **Usar en el frente** and **Usar en el reverso**. Capture the selection before a button or editor field takes focus. Ignore selection outside the current card, hidden answers, form fields, and controls. Allow several selections to be appended to either field before saving. The student can also open an empty editor and type directly. Keep captured excerpts visible in the draft. Persistent underlining of the original library card is outside this proposed scope.

Pause the per-card active study timer while the editor is open. Do not grade the source card, reveal its hidden answer, or move to the next question when a personal card is saved. Disable grading shortcuts while editing. Disable conflicting save actions during a request. Keep the draft if saving fails. Show success only after the server confirms it. Cancel discards only the unsaved draft.

Generate the new ID once per draft so a retry cannot create a second card. An identical confirmed retry retains the same result. A revision conflict uses the existing recovery interface.

### Section and format

The section is inherited from the source card. Store the original block as provenance and use a distinct virtual block ID for the section's **Creadas** block. Do not append to or regenerate the public section files. Merge private card data with the read-only library in memory.

Show **Creadas** beside **Eje Clínico** and **Patrones Madre** in the library, plan setup, session settings, and subtest format selectors. Show an empty state if the section has no created cards. The virtual block contains all created cards for that section. Existing source-block filters do not silently include this new block.

For an existing plan, permit created cards in its selected sections without requiring the student to recreate the plan. The **Creadas** session filter must work even when the plan was saved before the new format existed. A plan edit can select **Creadas** alone. Do not add unrelated sections to the plan.

New created cards enter the new-card pool after server confirmation. Preserve the current day's saved goal and current question. Offer these cards through the existing additional-new-card flow. A filtered **Creadas** session must let the student start new created cards even when none were in today's original goal. Once graded, use the same FSRS scheduling, grading, undo, due-review, and revision checks as other flashcards.

Include active personal cards in the relevant plan estimates and section progress totals. Keep the fixed published library inventory and Anki download counts unchanged.

### Suspend and restore

Use **Suspender flashcard** as the removal action. Explain beside the action that the card can be restored from **Suspendidas**. Do not add permanent deletion in this change.

Apply suspension to both library and created flashcards. On server confirmation, remove the card from new-card queues, due-review queues, additional-card selection, subtests, and current study selection. Move to the next eligible question without recording a grade or answer. If no eligible card remains, show the existing session-completion or empty state.

Exclude suspended cards from active workload and first-pass denominators. Keep existing progress, due dates, assignments, attempt history, and undo data. The current day's original goal remains an immutable record; compute its active pending targets without suspended cards so suspension cannot leave an unreachable pending question. Historical answer counts remain unchanged.

Add **Suspendidas** in the section library with the card front, format, and **Reintegrar flashcard**. Show the answer on request. Do not offer grading in this list. Restoration preserves its previous schedule. A never-studied card returns to the new pool. An overdue card returns to due reviews. A card already answered today follows the existing rule for same-day repeats.

Suspension is separate from **Pausar**, **Profundizar**, and **Al final de la sesión**. No suspension action applies to diagnostic case variants in this change.

## Constraints and exclusions

- Preserve unrelated work and use the topic branch `feat/created-flashcards`.
- Save all personal content through the existing confirmed-write path.
- Keep private content, progress codes, and credentials out of logs and URLs.
- Preserve strict validation, import recovery, retry safety, and undo behavior.
- Preserve all reviewed clinical content and generated artifacts.
- Do not publish, deploy, or merge without current authorization.
- No rich-text HTML editor, image attachments, Anki export of personal cards, permanent deletion, or public sharing.
- Editing a saved personal card is outside this initial scope. The student can suspend it and create a replacement.

## Verification required for implementation

Use disposable local resources. Add unit and API coverage for backward-compatible validation, private card persistence, invalid payloads, retry safety, new/review selection, format-only filters on old plans, suspension, restoration, goal handling, and undo. Include export/import round trips and attempts to overwrite a library identity.

Add browser coverage that creates a card during a new-card session, uses selected front and back text, pastes multiline information, saves without advancing the source card, reloads, opens the section's **Creadas** block, and studies only **Creadas**. Cover creation during review and suspension/restoration for both card types. Check that failed saves retain the draft and do not advance the session. Check keyboard and narrow-screen controls.

Run affected tests per completed implementation unit. Run `npm run check` before final review. Commit each self-contained unit with a Conventional Commit and push each commit. Keep the pull request description current. Report checks and limits.

## Approved interpretation

Selected text is copied into the new card editor. Persistent underlining of the original card is not included. The user approved this design and authorized routine builder decisions.
