# Context (from DOCs)

Descriptive, non-binding context. Precedence = 3 (lowest). Where these documents assert something
that contradicts an ADR or SPEC, the higher-precedence source wins — see `INGEST-CONFLICTS.md`.

---

## Topic: System architecture (V1)
source: `docs/technical/technical-architecture-v1.md`
status: aligned with accepted V1 data/API contracts (2026-03-08); V1.1 parcel/history addendum (2026-03-10); Auth0 delegation + account deletion flow added 2026-04-06

Architecture blocks: mobile app (iOS/Android); backend API; relational database; object storage for
photos; external services (maps/geocoding, donation provider); cadastral parcel service/layer
(France); optional public read model for map surfaces; optional analytics aggregation read model (V2).

Responsibilities:
- **Mobile app** — screens and IBP form UX, baseline client validation; local survey persistence (drafts + pending sync ops); sync queue handling (retry and error state); photo capture and geolocation; parcel lookup/selection UX and parcel history visualization; profile management UI (`/me`); auth flows via Auth0 SDK (login, sign-up, social providers, logout, token refresh — all delegated).
- **Backend API** — JWT validation (Auth0 RS256/JWKS) and user auto-provisioning on first login; Auth0 Management API calls (email update, password reset trigger, account deletion); user profile read/update/delete; survey CRUD and business workflow enforcement; server-side IBP validation and score verification; parcel linkage validation and versioning checks; final survey status transitions; minimal audit trail; attachment upload orchestration (record + signed upload URL); reporting and moderation actions; public map read endpoint (anonymized); parcel history read endpoints.
- **PostgreSQL** — core tables `users`, `auth_sessions`, `surveys`, `attachments`, `survey_events`, `reports`, `parcels`; status integrity constraints; search indexes (`site_name`, `status`, `date`); parcel-workflow indexes (`parcel_id`, `observation_year`, `version_number`); role-based access for moderation endpoints. ⚠ `auth_sessions` contradicts ADR-001 and the data contract — see conflicts report.
- **Object storage** — survey media files; optional signed URLs for controlled access.
- **Public map read model (optional)** — materialized/read table, reduced geographic precision, strict exclusion of private/deleted surveys.
- **Cadastral parcel layer (V1.1)** — resolve parcel from `lat/lng`, serve geometry metadata, high-zoom `studied`/`not_studied` overlay, mobile caching strategy for recently viewed parcel areas.
- **Analytics aggregation read model (V2)** — region/year/factor aggregates for Explore, trend payloads without personal data, refreshed by scheduled or incremental jobs.

Main technical flows (A–L): Login (Auth0 → JWT RS256 → JWKS validation → auto-provision from
`/userinfo`, linking `auth0_sub` to an existing email match → client-side token refresh);
Save draft offline (local SQLite, status stays `draft`); Synchronization (connectivity detected →
queued `pending` ops sent → API validates/persists → local status `synced` or `error`);
Profile update (`PATCH /me`); Attachment upload (`POST /surveys/{id}/attachments` → `attachment_id`,
`storage_key`, signed `upload_url` → binary upload → referenced in later sync payloads);
Report and moderation (`POST /reports`, `GET /reports?status=open`, `PATCH /reports/{id}`);
Public map read (`GET /public/map-items`, only `visibility=public` and not deleted);
Parcel resolution and versioning (GPS/address → resolve candidate `parcel_id` → user confirms →
API validates existence and version sequencing at submit); Parcel history comparison;
High-zoom parcel map status (bbox/zoom request → statuses without personal data);
Explore analytics (V2); **Account deletion (US-A7)** — confirm → `DELETE /me` → Auth0 Management API
`DELETE /api/v2/users/{auth0_sub}` with an M2M token holding `delete:users` → Auth0 invalidates all
tokens → backend deletes personal data and profile picture → backend anonymises surveys → `204`,
mobile clears local state and returns to login.

Security and compliance baseline (V1): TLS for all API communication; encrypted local storage for
sensitive mobile data; anonymized/pseudonymized data on public surfaces; logging of critical
actions; `user_id` ownership enforced server-side from the authenticated context.

Out of scope for V1: advanced moderation workflows; advanced push notification workflows; full data
warehouse architecture; full national cadastral offline mirror on device; Explore advanced
analytics dashboards.

---

## Topic: Project status, roadmap and budget (stakeholder view)
source: `docs/project/presentation-association.md` (French, dated May 2026)

Problem framing: IBP surveys are done today on paper or in spreadsheets — data is hard to
centralize (each observer keeps their own files, no shared view or parcel history) and entry errors
are only detected after leaving the field. The app guides the observer factor by factor, validates
in real time in the field, and syncs automatically on return to coverage.

Audiences: field ecologists and observers (survey entry on smartphone, offline); Etats Sauvages
coordinators (tracking submitted surveys, parcel history); members and volunteer observers (map
exploration, gamification engagement — planned for V1).

Claimed benefit: total time drops from ~2h field + ~30min re-entry to ~1h30 field only; data-loss
risk drops from high (wet paper, overwritten file) to nil (local save + cloud); an API is available
for export and analysis.

**Current status — MVP being finalized** (business logic ✅ functional / UX and field tests 🔵 pending):
authentication (email, Google, Apple); 10-factor IBP entry with validation; cadastral selection on
map; offline mode + automatic sync; photos and attachments; public survey map; parcel score
history; user profile management; secured backend API. **Database: ⚠ working PoC — deployment on a
durable solution still to do.**

Next — V1: gamification (points, badges, leaderboard); reporting of suspicious surveys; in-app
Etats Sauvages section; donation button; **moderation interface (dashboard for coordinators)**.
Horizon — V2: regional analyses; per-parcel trends; factor distribution.

**Timeline** (as published): MVP finalized (UX + DB deployment) **September 2026**; field tests with
pilot observers October–December 2026; App Store and Google Play publication **January 2027**;
V1 (gamification, moderation, association section, donation) during 2027.

**Costs** — launch ~€23 total (Apple App Store €0 via the non-profit fee waiver; Google Play ~€23
one-off). Annual ~€346 TTC: server hosting **alwaysdata** ~€72 (Small plan: 1 GB RAM, 50 GB disk,
Node.js + PostgreSQL); photo storage **Cloudflare R2** €0 (10 GB free/month); **Auth0** €0 (free to
7,500 MAU, 50% non-profit discount beyond); **Cadastre IGN** €0 (French government public API);
domain ~€10 (already owned); Claude Pro ~€264. Strong growth would move hosting to ~€230/yr,
totaling ~€500/yr.
⚠ Hosting and object-storage targets named here (alwaysdata, Cloudflare R2) are not ratified by any
ADR — see `INGEST-CONFLICTS.md`.

GDPR: data collected — email and name (account identification, kept until account deletion);
profile picture (display, until deletion); GPS location (parcel selection aid, not stored
continuously, kept for the duration of the survey only); survey data incl. IBP factors and field
photos (biodiversity database, kept indefinitely, anonymized after account deletion). Hosting all in
Europe: server and DB alwaysdata Paris; Auth0 EU region; survey photos in object storage with an EU
hosting option. No data transmitted to third parties for commercial purposes. Rights implemented
natively: access, rectification, erasure (account deletion in-app — personal data erased, scientific
surveys anonymized and retained), portability (export via API).
**Data ownership: submitted IBP surveys belong to Etats Sauvages; observers cede their data to the
association at submission, as stated in the terms of use.**

Technical summary for non-technical stakeholders: React Native single codebase for iOS and Android;
phone acts as a mini-server with local SQLite so the app works fully offline and syncs automatically
on reconnection; server is Node.js + NestJS hosted at alwaysdata (Paris) with PostgreSQL;
authentication delegated to Auth0; code is TypeScript, automatically tested, with a GitHub Actions
CI chain; development accelerated with Claude (AI assistant) while all technical decisions remain
human.

**Open asks to the association** (decisions pending): (1) go-ahead to continue development to
production; (2) **prioritization among the four V1 features** — gamification, reporting +
moderation interface, in-app association section, donation button; (3) budget validation (~€346/yr
running, ~€23 launch); (4) provisioning of accounts once the MVP is finalized (September 2026):
alwaysdata hosting, Apple Developer (fee-waiver request in the association's name), Google Play
Console, DNS access for the production domain.

---

## Topic: Epic A field-test results and known bugs
source: `docs/user-tests/epic-a-access-and-security.md` (cross-ref: `docs/specs/epic-a-access-and-security.md`)

Manual test plan and results matrix for login, logout, sign-up, profile and password reset.
Legend: ✅ pass · ❌ fail · ⚠️ pass with issue · 🔲 not tested.

- **US-A1 Login** — all 10 cases pass. Notable: session survives app restart; branded loading screen
  on session restore (typewriter loader with scientific species names on forest-green background, no
  flash of the login form); two distinct buttons "Se connecter" (primary) and "Créer un compte"
  (secondary); light haptic feedback before Auth0 opens (`Haptics.impactAsync`, not verified on a
  physical device); Auth0 errors surface user-friendly messages with no client ID/callback/technical
  details; legal links ("Conditions d'utilisation", "Politique de confidentialité") visible and
  opening in the browser.
- **US-A2 Logout** — both cases pass.
- **US-A3 Sign up** — 6/7 pass. **❌ A3-4: duplicate email shows a generic Auth0 error instead of
  stating the email is already taken.** A3-7 requires New Universal Login on the Auth0 tenant so that
  "Créer un compte" opens directly on the sign-up form.
- **US-A5 Manage profile** — 5/6 pass; A5-6 (change email to a valid unused address) **not tested**
  — missing test case. Note: default display name was pre-filled with the full name.
- **US-A6 Forgot password** — A6-2 ⚠ reset email received but landed in spam (iCloud SMTP issue,
  pending OVH migration); A6-1 and A6-4 (24-hour expiry) **not yet verified**.
- **US-A4** — the test plan states it is "scoped to V1 and excluded from this MVP test plan",
  contradicting the PRD label. See `INGEST-CONFLICTS.md`.

Open issues:
- `BUG-A3-4` — Auth0 sign-up shows a generic error when the email is already taken; should say
  "email already in use". Priority: **Medium**.
- `BUG-A6-2` — password reset email lands in spam, caused by iCloud SMTP, pending OVH migration.
  Priority: Low (known, fix in progress).

Coverage gap: no user-test documents exist for Epics B–I.
