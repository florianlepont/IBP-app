# Product Specifications - IBP Mobile

## 1) Vision
Enable users to complete IBP surveys quickly, reliably, and in a standardized way, even in low-connectivity environments, on iOS and Android.
Build a participatory experience where contributors can follow IBP activity across French forests and stay engaged through gamification.
The app is a public-interest project led by the association Etats-Sauvages and its members.

## 2) Goals
- Make IBP assessments easier to perform for non-expert contributors, despite methodological complexity.
- Reduce the average time needed to complete a full survey.
- Decrease data entry errors and missing fields.
- Ensure traceability (who, when, where, what).
- Synchronize surveys to a shared community database.
- Enable nationwide visibility of completed IBP surveys (France).
- Increase long-term contributor engagement through points and progression.
- Increase visibility and awareness for the association Etats-Sauvages.
- Drive users toward donation flows that support the association mission.

## 3) Personas
- Contributor: voluntarily submits IBP surveys and follows personal/community impact.
- Community Moderator (Etats-Sauvages member): reviews reported issues, manages basic moderation, and updates app content/rules.

## 4) Scope (V1)
- User authentication.
- Basic user profile management (first name, last name, display name, profile picture).
- List of personal surveys (draft, submitted, synced).
- Survey-to-parcel linkage using French cadastral parcel identifiers.
- Longitudinal parcel tracking (multi-year history and comparison of IBP total + factor scores).
- Survey versioning per parcel context (`1`, `2`, `3`, ...).
- Guided IBP survey entry (required/optional fields).
- On-demand pedagogical help during survey entry for complex IBP fields.
- Photo attachments and geolocation.
- Offline mode + synchronization.
- Survey statuses (draft, expired, submitted, synced, error).
- Personal point counter based on completed IBP surveys.
- Explore map focused on parcel analysis in France (parcel status, latest IBP score, and access to parcel history).
- User-controlled survey visibility: private (default) or public (shared with community).
- Post-publication survey management (delete survey, switch private/public).
- Association visibility surfaces in-app (mission, impact, actions).
- Donation call-to-action in key user journey moments.

## 8) V2 Backlog (Out of MVP Scope)
- Community moderation workflow with approval/rejection for flagged surveys.
- Push notifications (new badges, ranking updates, moderation feedback).
- PDF/Excel export.
- KPI dashboards (average time, error rate, sync success rate).
- Forest analytics and insights in Explore (regional score summaries, trends, factor distributions).
- Multi-language support.
- In-app documentation section (learning hub) to explore IBP methodology outside survey flow.
- Advanced donation features (recurring donation, campaign-specific donation, donation impact dashboard).
- Team challenges (city/association/organization competitions).
- Seasonal events and limited-time missions.
- Social sharing of milestones (optional).

## 5) Cross-Epic Business Rules
- A survey is linked to a single site (or checkpoint).
- A survey must be linked to one cadastral parcel (`parcel_id`) before submission.
- GPS/manual address remains required for positioning, but is not the primary business identifier of a survey.
- Some fields are mandatory depending on survey type.
- A photo may be required to validate certain anomalies.
- A survey can only be submitted when all required fields are completed.
- A survey can only be submitted when cadastral linkage is valid (`parcel_id` resolved and confirmed).
- Surveys on the same parcel are tracked longitudinally by observation year and version number.
- Historical comparison must be available at parcel level (IBP total trend + factor-by-factor trend).
- Explore is a parcel intelligence surface (parcel status + parcel scores), not a generic point-only map.
- Each submitted survey has a visibility setting: `private` or `public`.
- Only `public` surveys are eligible for community surfaces (public map, community feeds, public stats).
- Changing a survey from `public` to `private` must remove it from community surfaces.
- Deleting a survey must remove it from community surfaces.
- Pedagogical content must be accessible on demand during survey entry without interrupting form completion.
- A draft survey expires 7 days after creation; after that, it becomes expired ("caduc") and cannot be submitted.
- Public map data is anonymized (no personal data exposed).
- At high zoom level, map surfaces (create/update/detail/explore) must display cadastral parcels and their study status (`studied` vs `not_studied`).
- Points are awarded only for valid submitted surveys (not drafts).
- Anti-cheat rules are needed (duplicate locations, spam submissions, fake entries).
- Donation prompts must stay transparent and non-blocking for core app usage.

## 6) Epic Documents
- Epic A - Access and Security: `docs/specs/epic-a-access-and-security.md`
- Epic B - Survey Preparation: `docs/specs/epic-b-survey-preparation.md`
- Epic C - IBP Survey Data Entry: `docs/specs/epic-c-ibp-survey-data-entry.md`
- Epic D - Offline and Synchronization: `docs/specs/epic-d-offline-and-synchronization.md`
- Epic E - Data Quality and Trust: `docs/specs/epic-e-data-quality-and-trust.md`
- Epic F - Participatory Experience and Gamification: `docs/specs/epic-f-participatory-experience-and-gamification.md`
- Epic G - IBP Information, Association Visibility and Donation: `docs/specs/epic-g-ibp-information-association-visibility-and-donation.md`
- Epic H - Forest Insights and Analytics (V2): `docs/specs/epic-h-forest-insights-and-analytics.md`

## 7) Suggested Delivery Priority
1. Epic A - Access and Security
2. Epic C - IBP Survey Data Entry
3. Epic D - Offline and Synchronization
4. Epic B - Survey Preparation
5. Epic E - Data Quality and Trust
6. Epic F - Participatory Experience and Gamification
7. Epic G - IBP Information, Association Visibility and Donation
8. Epic H - Forest Insights and Analytics (V2 backlog)

## 9) Non-Functional Requirements
- Platforms:
  - iOS minimum supported version: iOS 17.
  - Android minimum supported version: Android 12 (API 31).
  - App Store / Play publishing targets must follow current store requirements (latest supported SDK/target API).
- Performance: app launch time < 3 seconds on target devices.
- Offline reliability: no draft data loss in case of forced app closure.
- Security: encrypted local storage for sensitive data, API communication over TLS.
- GDPR: data minimization and a defined data retention policy.
- Privacy by design: public map and leaderboard data must be anonymized/pseudonymized.

## 10) Open Questions
- What exact fields make up an IBP survey (detailed data model)?
- Which business validations are blocking vs non-blocking?
- What are the exact roles and associated permissions (contributor, moderator)?
- What is the conflict resolution policy during synchronization?
- Are GPS and photos mandatory for all survey types?
- Which cadastral source should be authoritative in production (Cadastre API, vector tiles mirror, or hybrid)?
- What is the exact rule for multiple submissions on the same parcel and year (single submitted version vs multiple versions)?
- What precision/tiling strategy should be used for parcel rendering in offline mode?
- What exact scoring model should be used (base points, bonus, penalties)?
- Which statistical rules should be applied for regional analytics (minimum sample size, outlier handling, confidence display)?
- Is ranking individual-only, or also by teams/organizations?
- What level of geographic precision is acceptable for public map display?
- What moderation policy should Etats-Sauvages apply for disputed surveys?

## 11) Detailed Functional Specification Reference
- IBP factor-level form definition: [ibp-form-spec.md](ibp-form-spec.md)
