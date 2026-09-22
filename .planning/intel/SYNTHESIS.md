# Synthesis Summary

Entry point for `gsd-roadmapper`. Produced by `gsd-doc-synthesizer` on 2026-09-22.
Mode: `new` (no pre-existing PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md).
Precedence applied: ADR (0) > SPEC (1) > PRD (2) > DOC (3), per `.planning/ingest-manifest.yaml`.

---

## Project in one paragraph

Cortege / IBP is a French field-survey mobile app (React Native + Expo, NestJS + PostgreSQL) for the
association Etats-Sauvages. Ecologists score ten biodiversity factors (A–J) on forest parcels using
the CNPF IBP Fr v3.0 method, entirely offline, and the app syncs to a shared national database when
connectivity returns. Surveys are linked to cadastral parcels and tracked longitudinally by
observation year and version, with private/public visibility control, a public anonymized map,
planned gamification, association visibility and donation flows, and V2 analytics.

---

## Documents synthesized: 22

- **ADR: 1** — `docs/technical/adr-001-technical-stack-and-engineering-principles-v1.md`
- **SPEC: 7** — api-contract-v1, data-contract-v1, ibp-form-spec, ibp-validation-matrix-v1, sync-conflict-resolution-v1, publication-visibility-post-submit-v1, charte-graphique-etats-sauvages-spec
- **PRD: 11** — user-stories + epics A, B, C, D, E, F, G, H, I + z-infrastructure (empty)
- **DOC: 3** — technical-architecture-v1, presentation-association, user-tests/epic-a

Cross-ref graph: 2 edges (`user-tests/epic-a → specs/epic-a`; `ibp-validation-matrix → api/test/ibp-rules.spec.ts`, external code leaf). Max depth 1. **No cycles.**

---

## Decisions: 14 (all LOCKED)

All come from the single Accepted ADR-001. See `intel/decisions.md`.

`DEC-001` React Native + Expo + TypeScript · `DEC-002` Node.js + NestJS, single modular service ·
`DEC-003` PostgreSQL · `DEC-004` S3-compatible object storage · `DEC-005` Auth0 (RS256/JWKS), full
auth delegation, backend stateless on sessions · `DEC-006` offline-first with local queue and retry ·
`DEC-007` server is source of truth · `DEC-008` idempotent sync · `DEC-009` `/v1` API versioning ·
`DEC-010` security baseline (TLS, short-lived JWT, encrypted local storage) · `DEC-011`
observability baseline · `DEC-012` stable data contract required early · `DEC-013` explicitly out of
scope: cloud provider, event sourcing, microservices · `DEC-014` Scaleway recorded as an option, not
ratified.

No LOCKED-vs-LOCKED contradiction is possible (single ADR).

---

## Requirements: 69

See `intel/requirements.md`. 48 story-derived + 15 cross-epic business rules + 6 non-functional.

| Epic | Count | Release label |
|---|---|---|
| A — Access and Security | 7 | MVP |
| B — Survey Preparation | 5 | MVP |
| C — IBP Survey Data Entry | 9 | MVP (US-C8 marked V1) |
| D — Offline and Synchronization | 7 | MVP |
| E — Data Quality and Trust | 3 | V1 |
| F — Participatory Experience and Gamification | 5 | V1 (US-F1 marked MVP) |
| G — Information, Association Visibility, Donation | 3 | V1 |
| H — Forest Insights and Analytics | 4 | V2 |
| I — Workshops & Training | 5 | V1 (uncontracted) |
| Z — Infrastructure | 0 | empty placeholder |

IDs use `REQ-{epic}-{slug}` because Epic D reuses three story IDs for six stories.
Suggested delivery priority from `user-stories.md`: A → C → D → B → E → F → G → H (Epic I unranked).

---

## Constraints: 7

See `intel/constraints.md`.

- `CON-API-001` api-contract — V1 REST surface, `/v1`, Bearer auth, idempotent upsert on (`id`, `sync_version`), full endpoint list, standard error codes
- `CON-SCHEMA-001` schema — Data Contract V1: 12 entities, state transitions, consistency rules, idempotency rules
- `CON-SCHEMA-002` schema — IBP form spec: 10 factors with ACA/M thresholds, caps, blocking and non-blocking validations, submission payload
- `CON-PROTO-001` protocol — IBP validation matrix: 17 reference cases for the rule engine (`api/test/ibp-rules.spec.ts`)
- `CON-PROTO-002` protocol — sync conflict resolution: fatal vs retryable policy, retry cap of 8, error payload contract, mobile diagnostics UX
- `CON-PROTO-003` protocol — publication visibility and post-submit read-only policy (status: Draft)
- `CON-DESIGN-001` design — Etats Sauvages graphic charter: 9 color tokens, 3 typefaces with fallbacks, logo rules, visual language

Type breakdown: api-contract 1, schema 2, protocol 3, design 1.

---

## Context topics: 3

See `intel/context.md`.

1. **System architecture (V1)** — 8 blocks, responsibilities per block, 12 technical flows (A–L including account deletion), security baseline, V1 out-of-scope list
2. **Project status, roadmap and budget** — MVP status table (business logic done, UX and field tests pending, database still a PoC), V1/V2 roadmap, timeline to January 2027 store launch, ~€346/yr running cost, GDPR and data-ownership position, four open asks to the association
3. **Epic A field-test results** — 28 manual cases with outcomes, 2 open bugs (`BUG-A3-4` duplicate-email error message, medium; `BUG-A6-2` reset email in spam, low), no user-test coverage for Epics B–I

---

## Conflicts: 0 blockers · 7 competing-variants · 8 auto-resolved

Full detail: `.planning/INGEST-CONFLICTS.md`

Warnings requiring a user decision before routing:
1. Single-parcel vs multi-parcel survey linkage — two precedence-1 SPECs disagree, no tiebreaker
2. Survey `status` enum and `published_at`/`submitted_at` — two precedence-1 SPECs disagree
3. "V1" means the whole first release in `user-stories.md` but a post-MVP phase in the epics
4. Epic D reuses three story IDs for six stories
5. US-C9 tree species recognition is labelled MVP with zero stack, architecture or contract coverage
6. Epic E and Epic G V1 stories require an undefined back-office / CMS surface
7. Production hosting (alwaysdata + Cloudflare R2) is declared only in a DOC, not ratified by an ADR

Auto-resolved (recorded, no action needed): no `auth_sessions` table (ADR over DOC); submitted
surveys stay observation read-only (SPEC over PRD); US-A4 is MVP (PRD over DOC); story-level release
labels beat stale epic headers; validation matrix confirmed consistent with the form spec; plus
notes on the empty `z-infrastructure.md`, the uncontracted Epic I, and schedule context.

---

## Status

**AWAITING USER** — 0 blockers, but 7 competing variants must be resolved before routing.
Conflicts 1, 2 and 3 are structural: they change the data model and every phase assignment, so they
should be answered before `gsd-roadmapper` runs.

## Files

- `.planning/intel/decisions.md` — locked decisions from ADR-001
- `.planning/intel/requirements.md` — 69 requirements with acceptance criteria and provenance
- `.planning/intel/constraints.md` — 7 binding technical and design constraints
- `.planning/intel/context.md` — 3 descriptive context topics
- `.planning/INGEST-CONFLICTS.md` — full conflict report
- `.planning/intel/classifications/` — 22 per-document classification JSON files
- `.planning/ingest-manifest.yaml` — type and precedence overrides
