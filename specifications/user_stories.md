# Product Specifications - IBP Mobile

## 1) Vision
Enable users to complete IBP surveys quickly, reliably, and in a standardized way, even in low-connectivity environments, on iOS and Android.
Build a participatory experience where contributors can follow IBP activity across French forests and stay engaged through gamification.
The app is a public-interest project led by the association Etats-Sauvages and its members.

## 2) Goals
- Reduce the average time needed to complete a full survey.
- Decrease data entry errors and missing fields.
- Ensure traceability (who, when, where, what).
- Synchronize surveys to a shared community database.
- Enable nationwide visibility of completed IBP surveys (France).
- Increase long-term contributor engagement through points and progression.

## 3) Personas
- Contributor: voluntarily submits IBP surveys and follows personal/community impact.
- Community Moderator (Etats-Sauvages member): reviews reported issues, manages basic moderation, and updates app content/rules.

## 4) Scope (V1)
- User authentication.
- List of personal surveys (draft, submitted, synced).
- Guided IBP survey entry (required/optional fields).
- Photo attachments and geolocation.
- Offline mode + synchronization.
- Survey statuses (draft, expired, submitted, synced, error).
- Personal point counter based on completed IBP surveys.
- Basic public map of completed IBP surveys in France (with privacy constraints).

## 5) Cross-Epic Business Rules
- A survey is linked to a single site (or checkpoint).
- Some fields are mandatory depending on survey type.
- A photo may be required to validate certain anomalies.
- A survey can only be submitted when all required fields are completed.
- A draft survey expires 7 days after creation; after that, it becomes expired ("caduc") and cannot be submitted.
- Public map data is anonymized (no personal data exposed).
- Points are awarded only for valid submitted surveys (not drafts).
- Anti-cheat rules are needed (duplicate locations, spam submissions, fake entries).

## 6) Epic Documents
- Epic A - Access and Security: `specifications/epics/epic-a-access-security.md`
- Epic B - Survey Preparation: `specifications/epics/epic-b-survey-preparation.md`
- Epic C - IBP Survey Data Entry: `specifications/epics/epic-c-survey-data-entry.md`
- Epic D - Offline and Synchronization: `specifications/epics/epic-d-offline-sync.md`
- Epic E - Data Quality and Trust: `specifications/epics/epic-e-data-quality-trust.md`
- Epic F - Participatory Experience and Gamification: `specifications/epics/epic-f-participatory-gamification.md`

## 7) Suggested Delivery Priority
1. Epic A - Access and Security
2. Epic C - IBP Survey Data Entry
3. Epic D - Offline and Synchronization
4. Epic B - Survey Preparation
5. Epic F - Participatory Experience and Gamification
6. Epic E - Data Quality and Trust

## 8) V2 Backlog (Out of MVP Scope)
- Electronic signature.
- Community moderation workflow with approval/rejection for flagged surveys.
- Push notifications (new badges, ranking updates, moderation feedback).
- PDF/Excel export.
- KPI dashboards (average time, error rate, sync success rate).
- Multi-language support.
- Team challenges (city/association/organization competitions).
- Seasonal events and limited-time missions.
- Social sharing of milestones (optional).

## 9) Non-Functional Requirements
- Platforms: iOS (version to define) and Android (version to define).
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
- What exact scoring model should be used (base points, bonus, penalties)?
- Is ranking individual-only, or also by teams/organizations?
- What level of geographic precision is acceptable for public map display?
- What moderation policy should Etats-Sauvages apply for disputed surveys?

## 11) Detailed Functional Specification Reference
- IBP factor-level form definition: [ibp_form_spec.md](/Users/florianlepont/Documents/Projets/IBP%20app/specifications/ibp_form_spec.md)
