# Clinical Decision Practice Implementation Plan

> **For agentic workers:** Coordinator uses superpowers:executing-plans. The applicable dispatching-parallel-agents skill authorizes three independent content authors with disjoint section files. Then cross-review the other authors' files. Coordinator owns all code, audits and integration. One fresh whole-branch review before deployment.

**Goal:** Complete the missing case expansion, guided clinical decisions and session skip behavior in Alessa's request.

**Architecture:** Source-anchored supplemental JSON case bank, independently reviewed per section, joins the existing lazy study resources. Source-based guided questions cover every topic; a curated amenorrhea branch graph adds the detailed protocol requested. New practice metadata uses the existing FSRS/VPS transaction flow.

**Tech stack:** Existing React/TypeScript/Vite, Node/SQLite, Python via uv, Playwright and node:test.

**Spec:** `docs/superpowers/specs/2026-10-29-clinical-decision-paths-design.md`.

## Global constraints

- Original source files, Anki identities, current progress and existing VPS data remain valid.
- No invented epidemiologic ranking or unsupported medical facts. Source corrections prevail.
- All730topic occurrences get3distinct variants. Every355source block gets source-derived guided steps. Authored amenorrhea branches use primary guidance.
- Each graded node saves before advance. Skips earn no grade, exposure or daily-goal credit.
- New memories/errors/backups use the same private VPS profile. Supplemental counts stay separate from the2900-card denominator.
- Commit and immediately push each coherent unit. Deploy only the independent ENARM application.

## Review focus

- Named diseases must retain diagnosis answers at all three levels. Check that action labels apply only to actual procedures or umbrella classifications.
- A plausible distractor, diagnostic label, reused vignette or absent source fact must not teach a false distinction.
- Primary/secondary amenorrhea, absent uterus, central/ovarian failure and pregnancy/outflow branches must remain reachable and consistent.
- A skipped or retried item must not earn invented progress or duplicate a saved response.
- New decision IDs must survive analytics, backup validation and paired-device restoration.
- Existing daily assignments, course completion and clinical-source attestations must remain valid.

## Task1: Supplemental bank and audit

- [ ] Authors01–12,13–23,24–34 write disjoint JSON files under the shared contract; no code edits or commits.
- [ ] Cross-review source facts, variant distinctions and clinical ambiguity. Write independent review hashes; fix findings before approval.
- [ ] Add Python validation/generation tests RED→GREEN for full coverage, reviewed content, facts, variants and identity stability. Generate private-source-free public section JSON/index.
- [ ] Commit/push each complete content cohort and the audit/build integration.

## Task2: Guided decisions

- [ ] RED tests for all-topic step generation and amenorrhea branch reachability, hidden later facts, wrong-answer handling and stable node IDs.
- [ ] Implement typed decision questions and the source-derived case/action progression, with a separately authored amenorrhea graph and cited sources.
- [ ] Extend practice metadata, progress/error rows and backup validation for decisions. Verify no schema/denominator migration damage.
- [ ] Commit/push.

## Task3: Study interaction

- [ ] RED browser checks for Eje case launch, Mother decision launch, answer-per-node, wrong answers, skip/no-credit/return, repeat selection, due dates, loading failure and mobile layout.
- [ ] Add decision runner, new builder mode and explicit Library routes. Add skip/return to the existing subtest and preserve the progress feedback.
- [ ] Verify device pairing/backup retains both new memory kinds. Commit/push.

## Task4: Verify and deploy

- [ ] Run supplemental audits, all original content audits, full Node/Python and production-browser suites.
- [ ] Fresh whole-branch review; fix Important findings with RED→GREEN tests. Report scope honestly.
- [ ] Integrate latest main, push, deploy and verify public routes, expanded cases/branches, skipped counts, VPS persistence and existing timer health.
