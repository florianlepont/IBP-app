# Requirements (from PRDs)

Synthesized from PRD-type documents. Precedence = 2 (below ADR and SPEC).

**ID convention:** `REQ-{epic}-{slug}`. The original user-story ID is preserved in `us:` because
Epic D reuses `US-D1`/`US-D2`/`US-D3` for two different stories each (see `INGEST-CONFLICTS.md`).

**Release labels** are copied verbatim from the source. Where an epic header and a story label
disagree, both are recorded — see `INGEST-CONFLICTS.md`.

---

## Product frame (source: `docs/specs/user-stories.md`)

Vision: enable fast, reliable, standardized IBP surveys in low-connectivity environments on iOS and
Android; build a participatory experience where contributors follow IBP activity across French
forests and stay engaged through gamification. Public-interest project led by the association
Etats-Sauvages.

Goals: make IBP assessments easier for non-expert contributors; reduce average survey completion
time; decrease data-entry errors and missing fields; ensure traceability (who/when/where/what);
synchronize to a shared community database; nationwide visibility of completed surveys; increase
long-term contributor engagement; increase association visibility; drive donation conversion.

Personas: **Contributor** (submits surveys, follows personal/community impact); **Community
Moderator** (Etats-Sauvages member — reviews reports, basic moderation, updates app content/rules).

Suggested delivery priority: A → C → D → B → E → F → G → H.

### Cross-epic business rules (REQ-X-*)
- `REQ-X-single-site` — a survey is linked to a single site (or checkpoint). us: cross-epic
- `REQ-X-parcel-required` — a survey must be linked to **one** cadastral parcel (`parcel_id`) before submission. ⚠ contradicted by SPEC multi-parcel rule — see `INGEST-CONFLICTS.md`
- `REQ-X-gps-not-identifier` — GPS/manual address remains required for positioning but is not the primary business identifier
- `REQ-X-conditional-mandatory` — some fields are mandatory depending on survey type; a photo may be required to validate certain anomalies
- `REQ-X-submit-gate` — submission allowed only when all required fields are complete and cadastral linkage is valid (`parcel_id` resolved and confirmed)
- `REQ-X-longitudinal` — surveys on the same parcel are tracked longitudinally by observation year and version number; historical comparison available at parcel level (IBP total trend + factor-by-factor trend)
- `REQ-X-explore-parcel-first` — Explore is a parcel intelligence surface (status + scores), not a generic point-only map
- `REQ-X-visibility` — each submitted survey has `private`|`public`; only `public` is eligible for community surfaces; `public→private` and deletion remove it from community surfaces
- `REQ-X-pedagogy-on-demand` — pedagogical content accessible on demand during entry without interrupting form completion
- `REQ-X-draft-expiry` — a draft expires 7 days after creation ("caduc") and cannot be submitted
- `REQ-X-public-anonymized` — public map data is anonymized (no personal data exposed)
- `REQ-X-parcel-layer-highzoom` — at high zoom, create/update/detail/explore map surfaces display cadastral parcels and `studied`/`not_studied` status
- `REQ-X-points-valid-only` — points awarded only for valid submitted surveys, not drafts
- `REQ-X-anticheat` — anti-cheat rules needed (duplicate locations, spam submissions, fake entries)
- `REQ-X-donation-nonblocking` — donation prompts stay transparent and non-blocking for core app usage

### Non-functional requirements (REQ-NFR-*)
- `REQ-NFR-platforms` — iOS 17 minimum; Android 12 (API 31) minimum; store publishing targets must follow current store requirements (latest supported SDK/target API)
- `REQ-NFR-launch-time` — app launch time < 3 seconds on target devices
- `REQ-NFR-offline-reliability` — no draft data loss on forced app closure
- `REQ-NFR-security` — encrypted local storage for sensitive data; API communication over TLS
- `REQ-NFR-gdpr` — data minimization and a defined data retention policy
- `REQ-NFR-privacy-by-design` — public map and leaderboard data anonymized/pseudonymized

### V2 backlog (out of MVP, source `docs/specs/user-stories.md` §8)
Community moderation workflow with approval/rejection; push notifications; PDF/Excel export; KPI
dashboards; forest analytics in Explore; multi-language support; in-app learning hub; advanced
donation features (recurring, campaign-specific, impact dashboard); team challenges; seasonal
events; social sharing of milestones.

### Open questions carried from `user-stories.md` §10
Exact IBP survey field model; blocking vs non-blocking validations; exact roles/permissions;
sync conflict policy; whether GPS and photos are mandatory for all survey types; authoritative
cadastral source in production; rule for multiple submissions on same parcel+year; parcel
rendering precision/tiling for offline; exact scoring model (base/bonus/penalties); statistical
rules for regional analytics (min sample, outliers, confidence); ranking individual vs team; public
map geographic precision; moderation policy for disputed surveys.
> Several of these are already answered by SPECs (field model, validations, sync policy, idempotency).
> Genuinely open: scoring model, analytics statistics, ranking scope, cadastral production source,
> moderation policy, offline tiling strategy.

---

## Epic A — Access and Security
source: `docs/specs/epic-a-access-and-security.md` · epic release: **MVP**

### REQ-A-login — Login
- us: US-A1 · release: MVP · source: `docs/specs/epic-a-access-and-security.md`
- As a contributor, I want to log in with my credentials so I can access my surveys and profile.
- acceptance:
  - Given valid username/password, when I log in, then I am redirected to the home screen.
  - Given invalid credentials, a clear error message is displayed.
  - The session remains active between app launches (until logout or expiration).

### REQ-A-logout — Logout
- us: US-A2 · release: MVP · source: `docs/specs/epic-a-access-and-security.md`
- acceptance: I can log out from the profile menu; after logout I am redirected to the login screen.

### REQ-A-signup — Create account (Sign up)
- us: US-A3 · release: MVP · source: `docs/specs/epic-a-access-and-security.md`
- acceptance:
  - Sign-up flow startable from the login screen; supports email + password (aligned with US-A1).
  - Email format validated; password rules clearly displayed (minimum length, complexity if required).
  - Duplicate email rejected with a clear error and a suggestion to log in instead.
  - After successful sign-up the user is automatically signed in and redirected to the main screen.
  - A verification step is defined (email verification) with clear UX in both cases.
  - Basic account data persisted server-side; session active until logout/expiration.
  - Errors (network, server, validation) handled with actionable messages and retry.

### REQ-A-social-login — Extended login (third-party providers)
- us: US-A4 · release: **MVP** (per PRD; the user-test DOC claims V1 — auto-resolved to MVP, see conflicts report)
- source: `docs/specs/epic-a-access-and-security.md`
- acceptance:
  - Login screen offers provider buttons (at least Sign in with Apple and Sign in with Google) in addition to username/password.
  - Successful provider authentication redirects to the home screen.
  - Canceled/failed provider auth shows a clear error and keeps the user on the login screen.
  - First-time provider sign-in offers an account path (acceptance bullet is truncated in the source — incomplete).
  - If the provider returns an email already associated with an existing account, prompt to confirm linking (prevent accidental duplicates).
  - Session remains active between app launches; logout disconnects the local session and returns to login.

### REQ-A-profile — Manage profile
- us: US-A5 · release: MVP · source: `docs/specs/epic-a-access-and-security.md`
- acceptance:
  - View and edit at least first name, last name, display name, profile picture.
  - Changes saved and visible after app restart.
  - Profile picture upload supports camera and gallery.
  - Display name used in community surfaces (e.g. leaderboard) while keeping personal identity controls.

### REQ-A-forgot-password — Forgot password
- us: US-A6 · release: MVP · source: `docs/specs/epic-a-access-and-security.md`
- acceptance:
  - "Forgot password?" link visible on the login screen.
  - After entering an email, a secure reset link is emailed.
  - **Reset link expires after 24 hours and is single-use.**
  - Unrecognised email → informative message.
  - After a successful reset, redirect to the login screen.

### REQ-A-delete-account — Delete account
- us: US-A7 · release: MVP · source: `docs/specs/epic-a-access-and-security.md`
- acceptance:
  - "Delete my account" accessible from the profile menu / account settings.
  - Clear pre-deletion warning: immediate and irreversible; personal data (name, email, profile picture) permanently deleted; previously submitted surveys anonymised and retained for scientific purposes.
  - Explicit confirmation step required (dialog, typing "DELETE", or re-entering password).
  - On confirmation, account and all associated personal data immediately and permanently deleted.
  - All previously submitted surveys anonymised (user link removed), **not** deleted.
  - After deletion the user is logged out and redirected to login.
  - For third-party-provider users, the local session is terminated; revoking provider-side access is the user's responsibility.
  - Errors (network, server) handled with actionable messages; deletion not performed if the request fails.

---

## Epic B — Survey Preparation
source: `docs/specs/epic-b-survey-preparation.md` · epic release: **MVP**

### REQ-B-survey-list — List of my surveys
- us: US-B1 · release: MVP · source: `docs/specs/epic-b-survey-preparation.md`
- acceptance:
  - List displays at least: parcel ids, survey name, last update date, version number, status.
  - List displays a completion rate for in-progress surveys (e.g. percentage).
  - Filter by submit status (draft, submitted, expired) and last update date.
  - In offline mode, locally stored surveys remain visible.
- note: the story's narrative summary also promises filtering by **sync status, year and parcel ID**, which the acceptance criteria omit. Narrative is broader than acceptance.

### REQ-B-survey-detail — Survey detail and parcel history
- us: US-B2 · release: MVP · source: `docs/specs/epic-b-survey-preparation.md`
- acceptance:
  - Detail view displays survey information (site, parcel ids, last update date, version, basic history).
  - Displays submission deadline (creation date + 7 days) and remaining time.
  - Displays survey completion rate.
  - Displays previous submitted surveys on the same parcel with year/version.
  - Exposes score comparison with previous versions (IBP total + factor-level deltas).
  - An "Update" button opens the survey form **for editable surveys**.
- ⚠ the story's narrative summary says the Update button allows "editing of submitted surveys", which contradicts the SPEC read-only rule. Auto-resolved in favour of the SPEC — see `INGEST-CONFLICTS.md`.

### REQ-B-manage-published — Manage published survey
- us: US-B3 · release: MVP · source: `docs/specs/epic-b-survey-preparation.md`
- acceptance:
  - From survey detail, change visibility between `private` and `public`.
  - Switching `public → private` removes the survey from community surfaces.
  - Delete a survey with a confirmation step.
  - After deletion the survey is no longer visible in my list or community surfaces.

### REQ-B-parcel-status-map — Parcel status visualization
- us: US-B4 · release: MVP · source: `docs/specs/epic-b-survey-preparation.md`
- acceptance:
  - In create/update/detail/explore map views, cadastral parcel boundaries visible at high zoom.
  - Parcel status visible at high zoom (`studied` vs `not_studied`).
  - Tapping a studied parcel can open its latest survey detail/history entry.

### REQ-B-explore-analysis — Explore as parcel analysis surface
- us: US-B5 · release: MVP · source: `docs/specs/epic-b-survey-preparation.md`
- acceptance:
  - Explore highlights parcel-level information first (status + latest score), not only raw point markers.
  - Selecting a parcel exposes at least: parcel id, latest submitted score, latest survey year/version.
  - From Explore, open parcel history and the corresponding survey detail.

---

## Epic C — IBP Survey Data Entry
source: `docs/specs/epic-c-ibp-survey-data-entry.md` · epic release: **MVP**

### REQ-C-guided-entry — Guided data entry
- us: US-C1 · release: MVP · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - Required fields clearly identified.
  - Form captures mandatory parcel linkage metadata (`parcel_ids[]`, observation year, version).
  - Form includes all IBP factors (`A` to `J`), each completable from the survey form flow.
  - Field types are appropriate (text, number, list, date, boolean).
  - Validation errors displayed per field.

### REQ-C-save-draft — Save as draft
- us: US-C2 · release: MVP · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - Save at any time without submitting; draft changes saved automatically locally while editing.
  - Draft available offline on the device; last modified date visible.
  - If less than 24 hours remain before expiration, a warning is displayed.

### REQ-C-photos — Supporting photos
- us: US-C3 · release: MVP · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - Add up to **10 photos** per survey; preview photos before submission; remove a photo before submission.
  - Photos remain linked to the survey after synchronization.
- note: narrative also mentions removal confirmation and offline access to previously synced photos; not in acceptance criteria.

### REQ-C-parcel-linkage — Parcel linkage by map selection
- us: US-C4 · release: MVP · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - During create/edit, tap parcel polygons to select or deselect them.
  - **A survey can reference one or many parcels (`parcel_ids[]`).**
  - The app can center the map on current location to help nearby selection.
  - Offline mode does not block draft creation/edit; parcel linkage can be completed once the parcel layer is available online.
  - Submission blocked if parcel linkage is missing or invalid.

### REQ-C-submit — Submit survey
- us: US-C5 · release: MVP · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - Submission blocked until all IBP factors (`A` to `J`) are completed and scoreable.
  - Submission blocked if cadastral parcel linkage metadata is missing (`parcel_ids[]`, observation year, version).
  - When blocked, the app displays an explicit reason and identifies missing items.
  - Submission blocked if the survey is older than 7 days; survey transitions to `expired`.
  - After a successful submission request, status transitions to `submitted` and the survey becomes **read-only for data entry**.
  - Local confirmation message displayed after successful submission.
  - Synchronization is automatic after submission (no manual trigger); the survey enters the sync flow and reaches synced/error per Epic D rules.

### REQ-C-help — On-demand pedagogical help during entry
- us: US-C6 · release: MVP · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - Each complex field exposes a help entry point (e.g. "How to assess this factor?").
  - Help content displayed on demand without losing current form progress.
  - Help includes at least: plain-language explanation, what to observe in the field, scoring guidance.
  - Closing help returns the user to the same field/state in the form.

### REQ-C-privacy-choice — Survey privacy choice (private/public)
- us: US-C7 · release: MVP · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - Before submission, set visibility to `private` or `public`; default `private`.
  - Visibility changeable later from survey detail.
  - `public` surveys shareable to community surfaces; `private` visible only to the contributor and authorized moderators/admins.

### REQ-C-versioning — Survey versioning and historical context
- us: US-C8 · release: **V1** (epic header says MVP — see conflicts report) · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- acceptance:
  - A survey on a parcel has an explicit version number (`1`, `2`, `3`, ...) and observation year.
  - The app proposes a default next version when creating a new survey on an already studied parcel.
  - Before and during entry, the app can show previous scores for the same parcel (total and factors).
  - In survey detail, historical trend viewable without leaving the survey flow.

### REQ-C-species-recognition — Photo capture + tree species recognition for Factor A
- us: US-C9 · release: **MVP** (as written) · source: `docs/specs/epic-c-ibp-survey-data-entry.md`
- As a field surveyor, I want to take photos in the app and automatically detect/suggest tree species so completing Factor A is faster and more accurate.
- acceptance:
  - From the Factor A section, add one or more photos.
  - The app suggests one or more species with a confidence score.
  - Confirm, edit, or reject the suggested species.
  - Selected species saved with the survey and reviewable later.
  - Works offline once the model is available on-device, or clearly indicates when connectivity is required.
- ⚠ **no stack, architecture, data-contract or API coverage exists for on-device ML species recognition.** See `INGEST-CONFLICTS.md`.

---

## Epic D — Offline and Synchronization
source: `docs/specs/epic-d-offline-and-synchronization.md` · epic release: **MVP**
⚠ story IDs collide in this epic (US-D1, US-D2, US-D3 each used twice) — see `INGEST-CONFLICTS.md`.

### REQ-D-offline-map — Offline map mode for field navigation
- us: US-D1 (first occurrence) · release: MVP · source: `docs/specs/epic-d-offline-and-synchronization.md`
- acceptance:
  - A clear "Offline" indicator is visible.
  - The map shows a basemap (tiles) and any parcels already available locally.
  - GPS position is displayed and the map can follow the current location.
  - Core interactions (zoom, pan, select a parcel) work without connectivity.

### REQ-D-offline-work — Offline work
- us: US-D1 (second occurrence) · release: MVP · source: `docs/specs/epic-d-offline-and-synchronization.md`
- acceptance:
  - View already-loaded surveys and edit drafts offline.
  - Offline actions queued for synchronization.
  - Parcel linkage metadata (`parcel_id`, year, version) available offline for edited surveys.
  - Recently used cadastral map context (viewed parcel boundaries/status) reusable offline.

### REQ-D-auto-sync — Automatic synchronization
- us: US-D2 (first occurrence) · release: MVP · source: `docs/specs/epic-d-offline-and-synchronization.md`
- acceptance:
  - On reconnection, pending surveys are sent automatically; no manual sync action required.
  - Submitted surveys are also synchronized automatically after submission.
  - Status changes to "synced" on success; to "error" with an actionable message on failure.
  - Downsync includes parcel history updates used by score comparison views.

### REQ-D-area-download — Download an area for offline use
- us: US-D2 (second occurrence) · release: MVP · source: `docs/specs/epic-d-offline-and-synchronization.md`
- acceptance:
  - Select an area (e.g. around a parcel or a bounding box).
  - App shows estimated size and download progress.
  - Downloaded areas listed and deletable to free storage.
  - Area remains available after closing and restarting the app.

### REQ-D-conflict-resolution — Parcel and version conflict resolution
- us: US-D3 (first occurrence) · release: MVP · source: `docs/specs/epic-d-offline-and-synchronization.md`
- acceptance:
  - If the server rejects a survey due to parcel/version conflict, the app stores a clear blocking error.
  - Conflict payload explains expected parcel/version state and the local conflicting values.
  - User can retry after correction, or discard local conflicting changes.

### REQ-D-offline-parcel-warning — Warn when a parcel is not available offline
- us: US-D3 (second occurrence) · release: MVP · source: `docs/specs/epic-d-offline-and-synchronization.md`
- acceptance:
  - If an expected parcel is not cached, a clear message explains it.
  - A quick action starts the download when the network is available again.
  - Behaviour is consistent in offline mode (no infinite spinners).

### REQ-D-basemap-switch — Switch between satellite and map basemap layers
- us: US-D4 · release: MVP · source: `docs/specs/epic-d-offline-and-synchronization.md`
- acceptance:
  - A basemap selector is available in the Explore map UI.
  - Toggle between at least "Satellite" and "Map".
  - Selection persists while navigating within the session.
  - Default basemap is configurable (app setting or sensible default).

---

## Epic E — Data Quality and Trust
source: `docs/specs/epic-e-data-quality-and-trust.md` · epic release: **V1**

### REQ-E-audit-trail — Action history
- us: US-E1 · release: V1 · source: `docs/specs/epic-e-data-quality-and-trust.md`
- acceptance:
  - The audit trail is available in a **dedicated moderation interface (not the mobile app)**.
  - Each survey stores creator, creation/modification/submission dates, and status.
  - Main events are timestamped.

### REQ-E-search — Search a survey
- us: US-E2 · release: V1 · source: `docs/specs/epic-e-data-quality-and-trust.md`
- acceptance: text search by site; parcel id filter; year/version filters; date and status filters.

### REQ-E-report — Report suspicious content
- us: US-E3 · release: V1 · source: `docs/specs/epic-e-data-quality-and-trust.md`
- acceptance: report a survey from its detail page; a reason is required; a moderator can mark a report as reviewed.

---

## Epic F — Participatory Experience and Gamification
source: `docs/specs/epic-f-participatory-experience-and-gamification.md` · epic release: **V1**

### REQ-F-france-map — France-wide IBP map
- us: US-F1 · release: **MVP** (epic header says V1 — see conflicts report) · source: `docs/specs/epic-f-participatory-experience-and-gamification.md`
- acceptance:
  - Open a map showing completed `public` IBP surveys in French forests.
  - Filter by date range and region/department.
  - Sensitive data not exposed (no exact private personal information).

### REQ-F-points — Contributor profile and points
- us: US-F2 · release: V1 · source: `docs/specs/epic-f-participatory-experience-and-gamification.md`
- acceptance:
  - Profile displays total points, number of validated IBP surveys, activity history.
  - Points update automatically after a survey is validated/submitted according to rules.
  - Draft or rejected surveys do not grant points.

### REQ-F-leaderboard — Leaderboard
- us: US-F3 · release: V1 · source: `docs/specs/epic-f-participatory-experience-and-gamification.md`
- acceptance:
  - Leaderboard available at least by national and regional scope.
  - Ranking filterable by period (all-time, month, week).
  - Users can choose a display name; personal identity remains protected.

### REQ-F-badges — Badges and milestones
- us: US-F4 · release: V1 · source: `docs/specs/epic-f-participatory-experience-and-gamification.md`
- acceptance:
  - Badges awarded for clear milestones (first survey, 10 surveys, 50 surveys, etc.).
  - Newly earned badges clearly highlighted.
  - Badge rules transparent and visible in the app.

### REQ-F-rare-species-points — Points and badges for scanning rare tree species
- us: US-F5 · release: V1 · source: `docs/specs/epic-f-participatory-experience-and-gamification.md`
- acceptance:
  - A species can be marked "rare" (managed by the team via a reference list).
  - When a rare species is confirmed from a scan, points are awarded.
  - Badges exist per species (or per set of species), unlocked when the species is scanned.
  - Earned points and unlocked badges viewable in the profile.
  - Anti-abuse rules defined (e.g. one scoring scan per parcel per day for a given species).
- ⚠ depends on the species-scan capability from `REQ-C-species-recognition`, which has no stack/architecture coverage. Dependency also crosses release labels (MVP → V1). See `INGEST-CONFLICTS.md`.

---

## Epic G — IBP Information, Association Visibility and Donation
source: `docs/specs/epic-g-ibp-information-association-visibility-and-donation.md` · epic release: **V1**

### REQ-G-ibp-info — IBP information access
- us: US-G1 · release: V1 · source: `docs/specs/epic-g-ibp-information-association-visibility-and-donation.md`
- acceptance:
  - In-app section explains core IBP concepts in plain language (purpose, factors, high-level scoring logic).
  - Reachable from main navigation and key screens (survey flow, profile, map).
  - **Content updatable without app release (CMS/back-office or configurable content source).**

### REQ-G-association — Association visibility
- us: US-G2 · release: V1 · source: `docs/specs/epic-g-ibp-information-association-visibility-and-donation.md`
- acceptance:
  - In-app section presents Etats-Sauvages mission, actions, key impact indicators.
  - Reachable from main navigation and key screens (home/profile/map).
  - Content updatable without app release (CMS/back-office or configurable content source).

### REQ-G-donation — Donation conversion
- us: US-G3 · release: V1 · source: `docs/specs/epic-g-ibp-information-association-visibility-and-donation.md`
- acceptance:
  - Donation CTAs visible at relevant moments (profile, impact screens, post-survey completion).
  - Tapping a CTA opens a secure donation flow (external trusted provider page or in-app webview).
  - Donation never required to access survey and core contribution features.
  - Conversion events (CTA click, donation started, donation completed when trackable) logged for analytics.

---

## Epic H — Forest Insights and Analytics
source: `docs/specs/epic-h-forest-insights-and-analytics.md` · epic release: **V2**

### REQ-H-regional-overview — Regional score overview
- us: US-H1 · release: V2 · source: `docs/specs/epic-h-forest-insights-and-analytics.md`
- acceptance: Explore displays aggregated IBP score indicators by region; aggregates filterable by year range; each aggregate displays sample size.

### REQ-H-parcel-trends — Parcel trend analytics
- us: US-H2 · release: V2 · source: `docs/specs/epic-h-forest-insights-and-analytics.md`
- acceptance: for parcels with multiple submitted surveys, trends visualized by year/version; total and factor-level progression; missing years handled explicitly (no fake interpolation by default).

### REQ-H-factor-distribution — Factor distribution insights
- us: US-H3 · release: V2 · source: `docs/specs/epic-h-forest-insights-and-analytics.md`
- acceptance: distributions for factors A..J per selected region and period; views clearly separate `ibp_peuplement_gestion` (A..G) from `ibp_contexte` (H..J); outliers and low-sample situations flagged.

### REQ-H-analytics-trust — Analytics trust and transparency
- us: US-H4 · release: V2 · source: `docs/specs/epic-h-forest-insights-and-analytics.md`
- acceptance: aggregated views include provenance metadata (data period, refresh time, sample size); privacy constraints preserved (no personal data leakage); configurable minimum sample threshold can hide or blur low-confidence aggregates.

---

## Epic I — Workshops & Training "Ma Forêt Vivante"
source: `docs/specs/epic-i-workshops-training-ma-foret-vivante.md` · epic release: **V1**
⚠ Epic I is absent from the `user-stories.md` epic index (A–H only) and from its V1 scope list, and has
no data-contract or API-contract coverage. See `INGEST-CONFLICTS.md`.

### REQ-I-calendar — Browse events calendar
- us: US-I1 · release: V1 · source: `docs/specs/epic-i-workshops-training-ma-foret-vivante.md`
- acceptance: calendar displays both event types (half-day "Ma Forêt Vivante" workshops and 2.5-day training sessions); each event shows type, date, duration, location; past events hidden by default; list sorted by date ascending.

### REQ-I-event-detail — View event details
- us: US-I2 · release: V1 · source: `docs/specs/epic-i-workshops-training-ma-foret-vivante.md`
- acceptance: detail screen shows event type, title, date(s), duration, location (forest parcel), available spots, description; clear CTA to registration; if full, CTA replaced by a "Full" indicator.

### REQ-I-register — Register for an event
- us: US-I3 · release: V1 · source: `docs/specs/epic-i-workshops-training-ma-foret-vivante.md`
- acceptance:
  - If the **HelloAsso** API is available, registration completes entirely in-app.
  - If not available, the user is redirected to the HelloAsso event page in an in-app browser.
  - After successful registration, confirmation (in-app notification and/or email).
  - Available spot count updated in real time after registration.

### REQ-I-my-registrations — View my registrations
- us: US-I4 · release: V1 · source: `docs/specs/epic-i-workshops-training-ma-foret-vivante.md`
- acceptance: "My registrations" section accessible from the profile; each registration shows event name, date, duration, location; past registrations hidden by default.

### REQ-I-events-on-map — Display events on the exploration map
- us: US-I5 · release: V1 · source: `docs/specs/epic-i-workshops-training-ma-foret-vivante.md`
- acceptance: each upcoming event appears as a distinct pin positioned on its forest parcel; pin differentiates workshops from training sessions; tapping a pin opens the event detail screen; past events not shown on the map.

---

## Epic Z — Infrastructure
source: `docs/specs/z-infrastructure.md` · **empty placeholder — single H1, no body.**
No requirements extracted. Classifier confidence: `low` (type taken from manifest override).
See `INGEST-CONFLICTS.md` [INFO].

---

## Totals
- Epic A: 7 · Epic B: 5 · Epic C: 9 · Epic D: 7 · Epic E: 3 · Epic F: 5 · Epic G: 3 · Epic H: 4 · Epic I: 5 · Epic Z: 0
- Story-derived requirements: **48**
- Cross-epic business rules: 15 · Non-functional requirements: 6
- **Total requirement entries: 69**
