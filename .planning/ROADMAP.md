# Roadmap: Cortege — IBP

## Overview

Most of the MVP is already built. This milestone closes the gap between "business logic works on my
phone" and "an ecologist trusts it in a forest". It opens with the milestone's one real unknown —
on-device tree species recognition — behind two deliberate gates: an ADR that measures the approach
on real devices, and a data/API contract extension, so a no-go costs days rather than months. It
then completes the offline map the field actually needs, gives the surveyor a way to get a survey
out of the app as a PDF, takes PostgreSQL out of PoC status and ratifies the hosting that has been
running unofficially, and finishes by proving the whole thing in the field — which is the milestone's
success metric, not its afterthought.

**Milestone framing:** internal-only. The community and social dimension (public map, gamification,
moderation, association section, donation) is deferred to the next milestone. See
`.planning/REQUIREMENTS.md` for what is deferred and why.

**Schedule reality:** the published plan (May 2026) put MVP finalization at September 2026, field
tests October–December 2026, store publication January 2027. Today is 2026-09-22 and species
recognition is unbuilt and unresearched. Phases 1–3 front-load that unknown so the slip is measured
in October rather than discovered in December.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Species Recognition — Approach Decision** - Measure on-device ML on real devices and ratify a go/no-go in an ADR
- [ ] **Phase 1.1: Reconcile the IBP method version** (INSERTED) - Establish whether the app still implements the current CNPF method, and what changes if not
- [ ] **Phase 2: Species Contracts & Data-Contract Corrections** - Give species a data model, an API surface and a migration; correct the stale form spec
- [ ] **Phase 3: Species Recognition for Factor A** - Photograph a tree, get a species suggestion, keep or reject it
- [ ] **Phase 4: Offline Map & Own-Survey Navigation** - Navigate a parcel with no network, and see your own surveys on the map
- [ ] **Phase 5: Survey Export & Ownership** - Export a survey as a PDF offline and delete your own surveys
- [ ] **Phase 6: Durable Backend** - Backups that restore, migrations that hold, hosting ratified, dead and unsafe code gone
- [ ] **Phase 7: Field Validation** - Prove the offline survey-to-sync loop on real parcels with real observers

## Phase Details

### Phase 1: Species Recognition — Approach Decision

**Goal**: We know, with numbers from real devices, how on-device tree species recognition will work — or that it cannot ship in this milestone.
**Depends on**: Nothing (first phase)
**Requirements**: REQ-ML-adr
**Success Criteria** (what must be TRUE):

  1. An accepted ADR in `docs/technical/` names the inference runtime, the model and its licence, the on-device model size, and how suggestions behave when the model or the network is unavailable.
  2. A throwaway spike on a real iOS device and a real Android device produces recorded figures for inference latency, model size on disk, and top-1/top-3 accuracy on a handful of French tree species.
  3. The ADR states an explicit go/no-go for US-C9 in this milestone, and if it is a no-go, describes the fallback (manual species entry) and what moves to the next milestone.
  4. The ADR adds no recurring inference cost to the ~€346/yr budget, or states plainly what it would cost.

**Plans**: 1/6 plans executed
Plans:

- [x] 01-01-PLAN.md — Spike scaffold, benchmark-device and field-photo asks, measurement document skeleton
- [ ] 01-02-PLAN.md — CNPF Factor A genus label set (34 classes) and a licence-clean image corpus
- [ ] 01-03-PLAN.md — On-device TFLite harness on real iOS and Android, proven with a stock model
- [ ] 01-04-PLAN.md — Fine-tune, export quantised .tflite, measure top-1/top-3 accuracy per genus
- [ ] 01-05-PLAN.md — Real-device latency against the 3 s budget and field-photograph validation
- [ ] 01-06-PLAN.md — ADR-002 with the go / partial go / no-go for US-C9, ratified

### Phase 01.1: Reconcile the IBP method version — repo implements Fr v3.0, CNPF publishes FR v3.2 (INSERTED)

**Goal**: Know whether the app still implements the current CNPF IBP method, and exactly what changes if it does not.
**Depends on**: Nothing — independent of the species-recognition track. Must land before Phase 2, which writes the Factor A genus list.
**Requirements**: REQ-QA-ibp-version
**Success Criteria** (what must be TRUE):

  1. A written comparison of IBP Fr v3.0 (the version this repo cites, PDFs dated 2023-03-23 in `docs/references/README.md`) against the CNPF's currently published FR v3.2 (dated 2026-02-02), covering all ten factors: field definitions, class thresholds, and the Factor A native-genus list.
  2. Every divergence found is recorded with its concrete impact on `api/src/surveys/ibp-rules.service.ts`, `mobile/src/app/ibp-scoring.ts`, and the 17 reference cases in `docs/technical/ibp-validation-matrix-v1.md`.
  3. An explicit decision is recorded in `docs/technical/`: this milestone either migrates to v3.2 or stays on v3.0. Staying is a legitimate outcome for internal-only use, but it must be a stated choice with its reasoning, not an accident.
  4. If migration is chosen, the effect on surveys already recorded under v3.0 is stated plainly: whether their computed scores change, and what happens to them.
  5. `docs/references/README.md` and `docs/specs/ibp-form-spec.md` cite the version the app actually implements, whichever that turns out to be.

**Why this exists**: surfaced by the Phase 1 research (`01-RESEARCH.md`), which recovered the Factor A genus list from the current official CNPF PDF and found it was v3.2, three years newer than the v3.0 this repo cites. If the method moved, the app computes outdated scores — which matters more than any single feature in this milestone.

**Plans**: TBD

Plans:

- [ ] TBD (run /gsd-plan-phase 01.1 to break down)

### Phase 2: Species Contracts & Data-Contract Corrections

**Goal**: A species observation can be stored, synced and read back through contracts written down before any UI exists — and the two stale spec sections that contradict shipped behaviour are corrected.
**Depends on**: Phase 1, Phase 1.1 (the Factor A genus list must come from the ratified method version)
**Requirements**: REQ-ML-contracts, REQ-DOC-form-spec
**Success Criteria** (what must be TRUE):

  1. `docs/technical/data-contract-v1.md` defines a species entity linked to a survey's Factor A, carrying the species, its confidence score, and whether the suggestion was confirmed, edited or rejected.
  2. `docs/technical/api-contract-v1.md` documents the species endpoint(s) under `/v1` with request and response shapes and standard error codes.
  3. A migration creates the species schema and `npm run migrate:api` applies it cleanly on an empty database.
  4. Species data survives a round-trip through `POST /surveys/sync`: an E2E test replays the same payload twice and no species row is duplicated.
  5. `docs/specs/ibp-form-spec.md` §4 states that a survey may reference one or many parcels (`parcel_ids[]`), and §10.1 lists the shipped status enum `draft | submitted | synced | error | expired` with `submitted_at` and `deleted_at` — no `deleted` value, no `published_at`.

**Plans**: TBD

### Phase 3: Species Recognition for Factor A

**Goal**: A surveyor fills Factor A faster by photographing a tree than by naming it from memory.
**Depends on**: Phase 2
**Requirements**: REQ-C-species-recognition
**Success Criteria** (what must be TRUE):

  1. From the Factor A section, the surveyor adds one or more photos and sees suggested species, each with a confidence score.
  2. The surveyor can confirm, edit or reject each suggestion; the retained species is saved with the survey and is there again when the survey is reopened.
  3. With the device in airplane mode, suggestions still work on-device — or the app states plainly that recognition needs connectivity, exactly as the Phase 1 ADR decided.
  4. Confirmed species reach the server through the normal sync flow and appear in the survey read back from the API.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Offline Map & Own-Survey Navigation

**Goal**: The surveyor can find their way around a parcel and see their own past work on the map, with no network at all.
**Depends on**: Nothing (independent of the species-recognition track; sequenced after it)
**Requirements**: REQ-B-own-surveys-map, REQ-D-offline-map, REQ-D-area-download, REQ-D-offline-parcel-warning, REQ-D-basemap-switch
**Success Criteria** (what must be TRUE):

  1. The map screen shows the surveyor's own surveys instead of the public anonymized set, with its navigation unchanged.
  2. The surveyor switches between a satellite and a map basemap, and the choice persists while navigating.
  3. The surveyor selects an area, sees its estimated download size and progress, and the downloaded area is still usable after force-quitting and relaunching the app; downloaded areas can be listed and deleted.
  4. In airplane mode the map shows an offline indicator, renders the downloaded basemap and cached parcels, follows GPS, and still allows zoom, pan and parcel selection.
  5. When a parcel is missing from the offline cache, the app says so plainly and offers a download action that runs once the network returns — no infinite spinner.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Survey Export & Ownership

**Goal**: The surveyor can get a survey out of the app and clean up their own surveys — with no network and no back-office.
**Depends on**: Nothing (independent of Phases 1–4)
**Requirements**: REQ-C-pdf-export, REQ-B-manage-published
**Success Criteria** (what must be TRUE):

  1. From a survey's detail, the surveyor generates a PDF on the device and sends it through the OS share sheet to any installed target — Google Drive, Wimi, mail, AirDrop.
  2. The export works in airplane mode: the PDF is produced and shared with no API call.
  3. The PDF contains the survey's identifying data (site, parcel ids, observation year, version, date), the ten factor scores and the IBP total.
  4. The surveyor deletes their own survey behind a confirmation step, and it disappears from their list.
  5. No private/public visibility control is presented anywhere in the app.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Durable Backend

**Goal**: The production database can survive a failure, the hosting that is actually running is the hosting that is written down, and the API no longer carries dead or unsafe code.
**Depends on**: Nothing (independent of Phases 1–5)
**Requirements**: REQ-INF-hosting-adr, REQ-INF-backups, REQ-INF-migrations, REQ-INF-deadcode, REQ-QA-sql-injection, REQ-QA-indexes
**Success Criteria** (what must be TRUE):

  1. An accepted ADR ratifies the current VPS stack — Docker + Caddy + GHCR + systemd timer + MinIO on `cortege.algernon.ovh` — as the hosting target, superseding the unratified alwaysdata + Cloudflare R2 note.
  2. A scheduled PostgreSQL backup runs unattended, and a restore of one of those backups into a clean database has been performed and recorded at least once.
  3. A fresh database and the production database reach the same schema version through one documented path, and a deliberately failed migration leaves the schema unchanged rather than half-applied.
  4. `api/src/users/email.service.ts` and the vestigial `SMTP_*` variables are gone from the repo, from `api/.env.example` and from the deployment env.
  5. Account deletion runs on fully parameterized SQL, and `attachments(survey_id, created_at)`, `survey_parcels(survey_id)` and `users(auth0_sub)` are indexed — confirmed by `EXPLAIN` on the queries that scan them today.

**Plans**: TBD

### Phase 7: Field Validation

**Goal**: An ecologist completes a full IBP survey offline on a real parcel, and it syncs back with no data loss and no duplicates — on record.
**Depends on**: Phases 3, 4, 5, 6
**Requirements**: REQ-FT-field-tests, REQ-QA-bug-a3-4, REQ-QA-bug-a6-2, REQ-QA-screen-tests, REQ-DOC-taxonomy, REQ-DOC-epicd-ids
**Success Criteria** (what must be TRUE):

  1. A field-test report exists for each of Epics B, C and D, in the form of `docs/user-tests/epic-a-access-and-security.md`, with a recorded outcome for every case.
  2. At least one full run is recorded end to end — survey created offline on a real parcel, ten factors scored, photos attached, submitted offline, synced on reconnection — with the resulting server record checked for completeness and for the absence of duplicate surveys and attachments.
  3. Signing up with an already-registered email shows a specific message inviting the user to log in (`BUG-A3-4`), and password-reset deliverability is closed as an Auth0 tenant configuration item with the change recorded (`BUG-A6-2`).
  4. The survey list, survey detail, survey form and map screens have tests covering their sync-status, filter and error states, so the flows the field tests exercise are protected against regression.
  5. Every field-test case cites a unique story ID: the six Epic D stories have six distinct IDs, and `docs/specs/user-stories.md` §4 uses the MVP / V1 / V2 taxonomy.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

Phases 4, 5 and 6 declare no dependency on the species-recognition track and can be reordered ahead
of it if Phase 1 returns a no-go, or run in parallel with it.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Species Recognition — Approach Decision | 1/6 | In Progress|  |
| 2. Species Contracts & Data-Contract Corrections | 0/TBD | Not started | - |
| 3. Species Recognition for Factor A | 0/TBD | Not started | - |
| 4. Offline Map & Own-Survey Navigation | 0/TBD | Not started | - |
| 5. Survey Export & Ownership | 0/TBD | Not started | - |
| 6. Durable Backend | 0/TBD | Not started | - |
| 7. Field Validation | 0/TBD | Not started | - |

## Coverage

All 42 MVP requirements map to exactly one phase. 23 carry build work across Phases 1–7; the other
19 are already built and are verified in Phase 7's field tests. Full mapping in
`.planning/REQUIREMENTS.md` → Traceability.

## Deferred

Recorded in `.planning/REQUIREMENTS.md`, not dropped:

- **Next milestone (community / social):** `REQ-F-france-map`, `REQ-B-parcel-status-map`, `REQ-B-explore-analysis`, `REQ-C-privacy-choice`, and all of Epics E, F, G and I. Code already exists for several of them. **Prerequisite:** a back-office / CMS surface, which needs its own ADR, architecture block and contract before Epics E and G can be planned.
- **V2:** all of Epic H (regional overviews, parcel trends, factor distributions, analytics trust).

---
*Roadmap created: 2026-09-22*
