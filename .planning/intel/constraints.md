# Constraints (from SPECs)

Synthesized from SPEC-type documents. Precedence = 1 (below ADR, above PRD/DOC).
Constraint types: `api-contract` | `schema` | `protocol` | `nfr` | `design`

---

## CON-API-001 — V1 REST API contract
- type: api-contract
- source: `docs/technical/api-contract-v1.md`
- status: Accepted for V1 baseline (2026-03-08, non-exhaustive by design); V1.1 parcel/history extension proposed 2026-03-10; auth + `/me` updated 2026-04-06

Principles:
- Base path `/v1`; JSON request/response; Bearer token auth on protected endpoints.
- Idempotent survey upsert keyed on (`id`, `sync_version`).
- UTC ISO-8601 timestamps.

Authentication surface:
- Backend exposes **no** login/register/refresh/logout endpoints — all delegated to Auth0.
- `AuthGuard` validates JWT against Auth0 JWKS (`/.well-known/jwks.json`).
- First login auto-provisions a DB user from Auth0 `/userinfo`; existing email → `auth0_sub` is linked to that record.
- Logout is client-side (clear local tokens); refresh-token revocation goes directly to Auth0.
- Social providers are configured in the Auth0 tenant; adding/removing a provider requires no backend change.

Endpoints (V1):
- Profile: `GET /me`, `PATCH /me` (editable: `first_name`, `last_name`, `display_name`, `profile_picture_url`), `PATCH /me/email` (204), `POST /me/password-reset` (204), `PUT|GET|DELETE /me/profile-picture`, `DELETE /me`.
- Surveys: `POST /surveys`, `GET /surveys?status=&from=&to=&q=`, `GET /surveys/{id}`, `PATCH /surveys/{id}`, `PATCH /surveys/{id}/visibility`, `POST /surveys/{id}/submit`, `DELETE /surveys/{id}`, `GET /surveys/{id}/events`.
- Attachments: `POST /surveys/{id}/attachments`, `GET /surveys/{id}/attachments`, `PUT /surveys/{id}/attachments/{attachment_id}/upload?token=`, `DELETE /surveys/{id}/attachments/{attachment_id}`.
- Sync: `POST /sync` (batch), `GET /sync/changes?cursor=&limit=`.
- Reports: `POST /reports`, `GET /reports?status=open`, `PATCH /reports/{id}`.
- Public: `GET /public/map-items?from=&to=&region=`, `GET /public/parcels/status?bbox=&zoom=&year=`, `GET /parcels/resolve?lat=&lng=`, `GET /parcels/{parcel_id}/surveys/history?limit=`.
- Analytics (V2 addendum, out of MVP): `GET /analytics/regions`, `GET /analytics/factors/distribution`, `GET /analytics/parcels/trends`.

Rules:
- `parcel_ids`: French cadastral parcel identifiers, **at least one required at submit**; `parcel_id` is a compatibility primary-parcel pointer.
- `PATCH /surveys/{id}`: while `draft`, business fields editable (`site_name`, parcel linkage, region/stage, factors, visibility); while `submitted`, observation payload is **read-only** and only visibility changes are allowed (via the dedicated endpoint).
- `DELETE /surveys/{id}` is idempotent in V1 — returns `204` even if already deleted or not found.
- `PATCH /surveys/{id}/visibility` must write a `visibility_changed` audit event; no-op (same value) returns `200` unchanged; mobile may queue it offline as `survey.visibility_update` in `POST /sync`.
- `POST /surveys/{id}/submit` requires parcel linkage complete and valid (`parcel_ids[]`, `observation_year`, `version_number`).
- Public map filter: `visibility = public` AND not deleted AND publishable (recommended `status=submitted`).

Standard error codes: `400` validation, `401` unauthorized, `403` forbidden, `404` not found, `409` conflict/version mismatch, `422` business rule violation, `429` rate limited, `500` internal.
Business error codes (non-exhaustive): `parcel_required`, `parcel_invalid`, `parcel_version_conflict`.

Coverage gaps (no endpoints defined): gamification (points, leaderboard, badges), workshops/events + registrations, editorial/CMS content, donation flows. See `INGEST-CONFLICTS.md`.

---

## CON-SCHEMA-001 — Data Contract V1 (entities and rules)
- type: schema
- source: `docs/technical/data-contract-v1.md`
- status: Accepted for V1 baseline (2026-03-08); V1.1 parcel/history addendum (2026-03-10); V1.2 multi-parcel addendum; Auth Session + `auth0_sub` updated 2026-04-06

Core design rules:
- IDs are UUID v4; timestamps ISO-8601 UTC.
- Backend is source of truth for business validation.
- Sync operations must be idempotent.
- Cadastral parcel identifiers (`parcel_id` / `parcel_ids[]`) are **canonicalized server-side**.

Entities:
1. **User** — `id`, `auth0_sub` (unique), `email` (unique), `role` (`contributor|moderator|admin`), `first_name`, `last_name`, `display_name`, `profile_picture_url|storage_key|mime_type` (nullable), `created_at`, `updated_at`.
2. **Auth Session** — **delegated to Auth0. No `auth_sessions` table is maintained server-side in V1.** Backend only validates the JWT (RS256/JWKS) per request.
3. **Survey** — `id` (generated on mobile), `user_id`, `site_name`, `parcel_id` (nullable compatibility = primary parcel), `parcel_ids[]` (nullable in early draft, **required for submit**), `status` (`draft|submitted|synced|error|expired`), `visibility` (`private|public`), `observation_year`, `version_number` (starts at 1 per parcel history context), `region_version` (`ACA|M`), `vegetation_stage`, `factors` (jsonb A..J), `scores` (jsonb), `created_at`, `updated_at`, `submitted_at?`, `expires_at`, `sync_version`. Optional: `previous_survey_id`, `parcel_snapshot`, `last_sync_error`, `last_sync_error_code`, `last_sync_error_at`, `sync_blocked`, `deleted_at`.
4. **Attachment** — `id`, `survey_id`, `storage_key`, `mime_type`, `size_bytes`, `created_at`; optional `captured_at`, `metadata`, `uploaded_at`, `last_sync_error_code`, `last_sync_error_at`, `deleted_at`.
5. **Survey Event (audit)** — `id`, `survey_id`, `actor_id` (nullable for system), `event_type` (`created|updated|submitted|synced|sync_failed|expired|visibility_changed|deleted|reported|attachment_created|attachment_uploaded|attachment_deleted`), `payload?`, `created_at`.
6. **Sync Operation (mobile queue)** — `id`, `entity_type` (`survey|attachment|report`), `entity_id`, `operation` (`upsert|delete|create|visibility_update`), `payload`, `status` (`pending|processing|failed`), `retry_count`, `next_retry_at?`, `created_at`, `updated_at`; optional `terminal_at`, `terminal_reason`.
7. **Report** — `id`, `survey_id`, `reporter_user_id`, `reason`, `status` (`open|reviewed`), `created_at`, `reviewed_at?`, `reviewed_by?`.
8. **Public Map Item (read model, optional V1)** — `survey_id`, `display_location` (reduced precision, 2 decimals in current API read model), `survey_date`, `region_code`, `ibp_total`.
9. **Parcel (V1.1)** — `id`, `parcel_id` (unique canonical cadastral id), `commune_code`, `section`, `number`, `geometry` (WGS84), `centroid`, `created_at`, `updated_at`; optional `area_m2`, `source`.
10. **Parcel Study Status (read model, V1.1)** — `parcel_id`, `study_status` (`studied|not_studied`), `latest_submitted_survey_id?`, `latest_observation_year?`, `latest_ibp_total?`.
10.1 **SurveyParcel Link (V1.2)** — (`survey_id`, `parcel_id`) unique; **one survey can reference multiple parcels**; `surveys.parcel_id` remains an optional compatibility pointer to the primary parcel.
11. **Analytics Region Snapshot (V2, out of MVP)** — `region_code`, `year`, `sample_size`, `ibp_total_avg`, `ibp_total_median`, `ibp_pg_avg`, `ibp_context_avg`, `factor_avg` (A..J), `refreshed_at`; optional `ibp_total_stddev`, `confidence_note`.

Survey state transitions (V1): `draft→submitted` (complete + not expired), `submitted→synced`, `submitted→error`, `error→submitted`, `draft→expired` (now > `expires_at`).

Consistency rules:
- `expires_at = created_at + 7 days`
- `visibility` default `private`
- `parcel_ids.length >= 1` required for `submitted`
- `observation_year` and `version_number` required for `submitted`
- `submitted` surveys are read-only for observation payload (`site_name`, parcel linkage, region/stage, factors, scores)
- `submitted` surveys may still change `visibility`
- only `public` surveys are eligible for community surfaces; `public → private` must remove from community surfaces
- deleted surveys excluded from user list and community surfaces
- server recomputes/validates scores before final accept; server validates all selected parcels exist
- `version_number` strictly increasing per parcel history context

Idempotency rules:
- Survey upsert idempotency key: (`id`, `sync_version`)
- Same-payload replay returns success without duplication
- Older `sync_version` → conflict `409`
- Parcel/version conflicts return `409` with structured details (`parcel_id`, expected_version_number, client_version_number)

Out of scope: full event sourcing, advanced anti-cheat scoring model, team/organization ranking data model.

---

## CON-SCHEMA-002 — IBP form specification (factors, thresholds, scoring)
- type: schema
- source: `docs/specs/ibp-form-spec.md`
- status: v1.0, last update 2026-03-04. Declares itself "source of truth" for factor entry, classes/scores, UI validation, subscores and submission data contract.

Scope: metropolitan French forest stands; IBP Fr v3.0 biogeographic versions **ACA** (Atlantic/Continental/Alpine) and **M** (Mediterranean). Excludes advanced ecological interpretation and moderation workflows.

Global form rules:
- A survey is linked to one site/stand.
- **A survey must be linked to one French cadastral parcel (`parcel_id`) before submission.** (⚠ contradicts CON-SCHEMA-001 / CON-API-001 multi-parcel rule — see `INGEST-CONFLICTS.md`)
- Metadata includes `observation_year` and `version_number`.
- A draft expires 7 days after creation → status `expired`, submission rejected.
- Submission requires all mandatory factors filled and scorable; blocked when cadastral linkage metadata is missing/invalid.
- Allowed factor scores `{0,1,2,5}`; exception: `I` and `J` use `{0,2,5}`.
- `ibp_peuplement_gestion = A+B+C+D+E+F+G` (max 35); `ibp_contexte = H+I+J` (max 15); `ibp_total` max 50.
- Visibility `private|public`, default `private`; only `public` in community surfaces; owner can switch visibility or delete a submitted survey (with confirmation) — either removes it from community surfaces.
- `ibp_method_version` required; recommended default `cnpf_ibp_fr_v3_0_2023-03-23`; unsupported version blocks submission.

Region/stage typology:
- `region_version`: `ACA` | `M`
- `vegetation_stage` for ACA: `planitiaire`, `collineen`, `montagnard`, `subalpin`, `montagnard_mediterraneen`; for M: `thermo_mediterraneen`, `meso_mediterraneen`, `supra_mediterraneen`
- Special case: `montagnard_mediterraneen` uses ACA thresholds (CNPF rule).

Factors (field id → definition / class thresholds):
- **A `factor_a` Native Tree Taxa** — count of native genera (living h>50cm + dead). ACA planitiaire/collineen/montagnard & M: `0`:0-1, `1`:2, `2`:3-4, `5`:>=5. ACA subalpin: `0`:0, `1`:1, `2`:2, `5`:>=3. Blocking: a count or species entry required. Non-blocking: species outside CNPF list → warning.
- **B `factor_b` Vertical Vegetation Structure** — strata covering >=20% of area, among 5 strata. `0`:1, `1`:2, `2`:3-4, `5`:5. **Capped at `2` if native cover < 50%.** Blocking: >=1 stratum; `covered_autochthonous_percent` required for capping. ACA strata: <1.5m, 1.5-7m, 7-20m, >20m; M: <1.5m, 1.5-5m, 5-15m, >15m.
- **C `factor_c` Standing Deadwood (large)** — `bmg_count`, `bmm_count`, `surface_ha`; density/ha; h>=1m. ACA: BMg D>37.5cm (special >17.5), BMm 17.5-37.5; M: BMg D>27.5 (special >17.5), BMm 17.5-27.5. Scores: `0`: BMg/ha<1 and BMm/ha<1; `1`: BMg/ha<1 and BMm/ha>=1; `2`: 1<=BMg/ha<3; `5`: BMg/ha>=3. Blocking: `surface_ha>0`, counters >=0.
- **D `factor_d` Downed Deadwood (large)** — same counters and score classes as C; length >=1m; ACA BMg D>37.5 at 1m from large end, M BMg D>27.5. Blocking: `surface_ha>0`.
- **E `factor_e` Very Large Living Trees** — `tgb_count`, `gb_count`, `surface_ha`. ACA: TGB D>67.5 (special >47.5), GB 47.5-67.5; M: TGB D>57.5 (special >37.5), GB 37.5-57.5. Scores: `0`: TGB/ha<1 and GB/ha<1; `1`: TGB/ha<1 and GB/ha>=1; `2`: 1<=TGB/ha<5; `5`: TGB/ha>=5.
- **F `factor_f` Trees with Dendromicrohabitats** — 15 dmh groups, **cap 2 trees/ha per group**; a tree may count in multiple groups but once per group. Scores: `0`: <2 trees/ha, `1`: 2-<3, `2`: 3-<8, `5`: >=8. Blocking: >=1 dmh group evaluated (0 allowed). Non-blocking: above-cap value → auto-cap + warning.
- **G `factor_g` Flowering Open Habitats** — % flowering open area; includes gaps/clearings, edges (standard width 2m), open-canopy stands. ACA collineen/montagnard & M: `0`:0%, `2`:<1% or >5%, `5`:1-5%. ACA subalpin: `0`:0%, `2`:<1%, `5`:>=1%. Blocking: described area >0.
- **H `factor_h` Temporal Continuity of Forest Cover** — guided expert class + justification. `0`: recent forest, `2`: partial continuity or continuity with full-soil-disturbance reforestation, `5`: ancient continuous forest. Blocking: class required + `evidence_source` (map, aerial photo, field observation). Reference: 19th-century Etat-major map.
- **I `factor_i` Aquatic Habitats** — multi-select of distinct types inside or bordering stand; natural or artificial, permanent or temporary (excluding flood events). `0`: none, `2`: 1 type, `5`: >=2. Blocking: number of types determined (0 allowed).
- **J `factor_j` Rocky Habitats** — multi-select; type counts only if cumulative area > 20 m². `0`: none, `2`: 1 type, `5`: >=2. Blocking: number of types determined (0 allowed).

Edge cases:
- Low-fertility/low-growth taxa → reduced diameter thresholds for C, D, E.
- Capped survey mode (default mobile): a factor may stop being observed once the final score is secured. Uncapped (study) mode allowed with the same classes.
- Linear forests (<15 m width) use per-km adaptations: C/D BMg/km <9 / 9-<15 / >=15; E TGB/km <9 / 9-<20 / >=20; F trees/km <12 / 12-<15 / 15-<25 / >=25, cap 9 trees/km per dmh group.

Time/status validation: if `now > created_at + 7 days` and status `draft` → force `expired`, block submission, message `This survey has expired (more than 7 days). Please create a new survey.`

Visibility validation: `visibility` required at submission; default `private` at draft creation; if `public`, verify exposed data complies with anonymization/pseudonymization rules.

Post-publication validation: visibility change allowed only for owner (or authorized moderator/admin); deletion requires explicit confirmation; after deletion payload status becomes `deleted` and survey is excluded from list/map/community feeds.

Non-blocking inter-factor consistency: `factor_b >= 3 strata` with `factor_a = 0`; `factor_f >= 5` with `factor_e = 0`; (`factor_g = 5` with `factor_i/j = 0` is explicitly NOT an error).

Canonical error messages (EN): `Missing required field: {field_id}`, `Invalid value for {field_id}`, `Invalid described area (must be > 0)`, `Unsupported IBP version: {ibp_method_version}`, `Inconsistent region/IBP version`, `This survey has expired (more than 7 days).`, `Invalid visibility (expected values: private, public).`, `Deletion cancelled or not confirmed.`

Submission data contract (form-spec view):
- `ibp_method_version: string` (required), `region_version: "ACA"|"M"` (required), `status: "draft"|"expired"|"submitted"|"synced"|"error"|"deleted"`, `visibility` (required, default `private`), `published_at?`, `deleted_at?`, `factors: array[10]` (required).
- Factor structure: `factor_id`, `observed_value_raw`, `selected_class` (`S0|S1|S2|S5`; I/J `S0|S2|S5`), `score_points`, `evidence { notes?, photos?, gps? }`.
- ⚠ `status` enum and `published_at` diverge from CON-SCHEMA-001 — see `INGEST-CONFLICTS.md`.

Rounding: factor scores are discrete (no intermediate rounding); densities/percentages computed as floats then compared strictly to thresholds.

Primary references: CNPF IBP page; IBP Fr v3.0 definition (2023-03-23); IBP Fr v3.0 survey sheets; IBP survey methods (2022-10-10). PDFs not redistributed in the repo.

---

## CON-PROTO-001 — IBP validation matrix (rule-engine reference cases)
- type: protocol
- source: `docs/technical/ibp-validation-matrix-v1.md`
- status: Accepted for implementation baseline (2026-03-09)
- intent: each case is covered by automated tests in `api/test/ibp-rules.spec.ts`

Scope: factor normalization from raw payloads, canonical outputs (`selected_class`, `score_points`), aggregate computation, blocking vs non-blocking outcomes.

Reference cases:
- `MAT-A-01` ACA/collineen, `A.native_genus_count=2` → `A=1` (S1)
- `MAT-A-02` ACA/subalpin, `A.native_genus_count=2` → `A=2` (S2)
- `MAT-B-01` `B.strata_count=5`, `covered_autochthonous_percent=40` → `B=2` (cover cap applied)
- `MAT-C-01` `bmg=0, bmm=2, surface_ha=1` → `C=1` (S1)
- `MAT-D-01` `bmg=4, bmm=0, surface_ha=1` → `D=5` (S5)
- `MAT-E-01` `tgb=0, gb=2, surface_ha=1` → `E=1` (S1)
- `MAT-F-01` `F.trees_per_ha=8` → `F=5` (S5)
- `MAT-F-02` `F.dmh_group_counts=[3,3,3,3]` → `F=5` + non-blocking warning `factor_f_group_capped`
- `MAT-G-01` ACA/collineen, `open_flowering_percent=2` → `G=5` (S5)
- `MAT-H-01` `H.class=partial` → `H=2` (S2)
- `MAT-I-01` `I.type_count=1` → `I=2` (S2)
- `MAT-I-02` direct `I=1` → **blocking error** (I allowed scores `0,2,5`)
- `MAT-J-01` `J.type_count=2` → `J=5` (S5)
- `MAT-CONS-01` `A=0, B=2` → non-blocking warning `consistency_a_b`
- `MAT-CONS-02` `E=0, F=5` → non-blocking warning `consistency_e_f`
- `MAT-SUBMIT-01` expired `expires_at` + incomplete factors → blocking errors (`survey_expired`, missing factors)
- `MAT-SUBMIT-02` complete valid A..J payload → `ok=true` + valid aggregates (`ibp_total`)

Aggregates: `ibp_peuplement_gestion = A+B+C+D+E+F+G`; `ibp_contexte = H+I+J`; `ibp_total = sum`.
Allowed scores: A..H `0|1|2|5`; I, J `0|2|5`. Canonical class mapping: `0→S0`, `1→S1`, `2→S2`, `5→S5`.

Consistency check vs CON-SCHEMA-002: all 17 cases are consistent with the form-spec thresholds. No conflict detected.

---

## CON-PROTO-002 — Sync conflict resolution V1
- type: protocol
- source: `docs/technical/sync-conflict-resolution-v1.md`
- status: In progress (API + mobile baseline implemented)

Non-goals: real-time collaborative editing, CRDT/event sourcing, admin moderation workflows.

Survey upsert conflict policy (`entity=survey`, `action=upsert`):
- Case A — same `id`, **lower** `sync_version` than server → server `fatal_error`, code `sync_version_conflict`; client stops retry, marks local survey `failed`, keeps payload for manual resolution.
- Case B — same `id`, same `sync_version` → `synced` (idempotent replay); client marks queue item synced.
- Case C — same `id`, **higher** `sync_version` → `synced` if validation passes.
- Case D — validation/business failure (`422`) → `fatal_error`; client stops retry and surfaces a clear message.

Attachment lifecycle:
- `attachment.create` validation errors (`400/422`) → `fatal_error`.
- Upload: `5xx`, `429`, network timeout → retryable; `400/401/403/404` → fatal by default.
- Confirm-URL failure after successful binary upload: retryable for `5xx/429`, fatal for `4xx`.

Retry policy (mobile):
- Exponential backoff remains the default.
- **Hard retry cap: queue item becomes terminal at `retry_count >= 8`**; terminal reason stored in `last_sync_error`.
- `retryable_error` → keep in queue with `next_retry_at`; `fatal_error` → remove queue item, mark local entity failed.

UX rules (mobile):
- Per survey/attachment diagnostics: error code, last error message, retry count.
- Actions `Retry now` (reset `next_retry_at`) and `Discard local change` (delete queued operation).
- A survey with a fatal conflict **blocks automatic submit** until the user resolves or discards.

API additions:
- `POST /v1/sync` shape unchanged.
- Standardized operation error payload: `{ status, error: { code, message, http_status, details } }` — e.g. `sync_version_conflict` with `{ survey_id, server_sync_version, client_sync_version }`, `http_status: 409`.
- Stable retryable codes: `transient_upstream_error`, `rate_limited`, `network_gateway_error`.

Data additions: local survey/attachment `last_sync_error_code`, `last_sync_error_at`; optional queue `terminal_at`, `terminal_reason`.

Definition of done: explicit actionable conflict errors; mobile differentiates retryable vs fatal in data and UI; retry cap prevents infinite loops; e2e + mobile integration tests cover conflict and retry behaviour.

---

## CON-PROTO-003 — Publication visibility & post-submit management
- type: protocol
- source: `docs/technical/publication-visibility-post-submit-v1.md`
- status: **Draft for implementation planning** (2026-03-09)

Business rules (V1):
1. Default visibility `private`.
2. `draft` surveys may edit observation fields and visibility.
3. `submitted` surveys are **observation read-only**: not editable — `site_name`, `parcel_ids`, `region_version`, `vegetation_stage`, `factors`, `scores`; editable — `visibility` only.
4. Any visibility change produces a `visibility_changed` event with `{ from, to }`.
5. Public surfaces must never expose `private` or deleted surveys.
6. Recommended publishability gate for map/read models: `submitted` + `public`.

API delta: `PATCH /surveys/{id}/visibility` — request `{ "visibility": "private"|"public" }`, response `{ id, visibility, updated_at }`. `PATCH /surveys/{id}` remains for generic `draft` updates; generic patch of non-visibility fields on `submitted` returns `422` (`submitted_read_only_fields`).

Error policy: `401` not authenticated, `403` not owner/unauthorized role, `404` not found, `422` invalid business transition / forbidden post-submit field edit.

Audit: `visibility_changed`, payload `{ from, to }`, actor = authenticated user id, server-generated timestamp.

Test matrix (backend e2e): draft toggle 200; submitted toggle 200; submitted generic patch with `factors` → 422; toggle writes event in `/surveys/{id}/events`; public map includes `submitted+public` and excludes `submitted+private`; `public→private` removes from public map on next read.
Test matrix (mobile): draft detail shows visibility control applied immediately; submitted detail still shows visibility control; submitted detail keeps observation actions disabled; visibility survives sync round-trip.

Implementation notes: keep the direct endpoint for online calls; V1 also supports queued `survey.visibility_update` in `POST /sync` for offline-first behaviour.

---

## CON-DESIGN-001 — Etats Sauvages graphic charter
- type: design
- source: `docs/design/charte-graphique-etats-sauvages-spec.md`
- status: v1.0 (2026-03-11); derived from internal charter `ETATS_SAUVAGES_CHARTE_EB_V2` (2025-09-16), not redistributed in the repo

Brand markers that must be preserved: `Typography offset`, `Black rectangle`, `Fern`, `Bump`. Product implication: interface stays organic, natural, high-contrast, strongly branded — avoid generic UI patterns.

Color tokens:
- `brand.terracotta` `#CD5833` — strong accent, secondary CTA, brand alerts
- `brand.moss` `#89A33A` — primary accent, success, active states
- `brand.forest` `#334E2B` — main brand color (titles, strong text, deep surfaces)
- `brand.sage` `#B0C78E` — soft backgrounds, secondary surfaces
- `brand.mauve` `#9494B0` — secondary/info accent
- `brand.ochre` `#CC701F` — signal/warm emphasis
- `brand.salmon` `#DA8D77` — editorial accents/backgrounds
- support: `brand.black` `#000000`, `brand.white` `#FFFFFF`

Typography: `Mazzard H` (Light/Regular/Bold/Black) for titles and primary text; `HeadTurn Smooth` for 1-3 word emphasis; `Futura` (Medium/Bold) for secondary text. Screen title = Mazzard H Bold/Black; body/labels/inputs = Mazzard H Regular; metadata/microcopy = Futura Medium. Fallbacks: Mazzard H → Avenir Next / system-ui; Futura → Avenir Next / system-ui; HeadTurn Smooth → Mazzard H Bold.

Logo rules (mandatory): clear space = 1/6 of X around the logo; minimum size 25 mm print / >= 95 px width digital. Forbidden: changing opacity, colors, proportions, typography, or shifting the bump element.

Visual language: highlights always UPPERCASE with 0.5x padding (x = lowercase x-height); icons/arrows may use charter colors for rhythm and emphasis; the Fern is an ornamental/background element, natural tones only on photography.
