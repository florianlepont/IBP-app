# Epic E - Data Quality and Trust

**Release:** V1

Provide minimum controls to maintain community data quality.

---

## User Stories

### US-E1 - Action History

**Release:** V1

A minimal audit trail is needed for community moderators to monitor data reliability, requiring each survey to store the creator, creation/modification/submission dates, and status, with main events timestamped.

As a community moderator, I want a minimal audit trail to monitor data reliability via a dedicated moderation interface (not the mobile app).

Acceptance criteria

- The audit trail is available in a dedicated moderation interface (not the mobile app).

- Each survey stores: creator, creation/modification/submission dates, and status.

- Main events are timestamped.

### US-E2 - Search a Survey

**Release:** V1

Users can search a survey using filters for site, parcel ID, year/version, date, and status to quickly find information.

As a user, I want to search a survey by site/parcel/date/status so I can find information quickly.

Search lives in the « Mes Relevés » tab. There is no separate search tab: the app has four tabs (Accueil, Mes Relevés, Explorer, Compte).

Acceptance criteria

- On iPhone, search is the native search bar in the header of « Mes Relevés », visible under the title.

- On Android (and in Expo Go), « Mes Relevés » shows an inline search field at the top of the list.

- While a search is active, « Mes Relevés » shows only the matching surveys. Clearing or cancelling the search restores the full list.

- A text search by site is available.

- Parcel id filter is available.

- Year/version filters are available.

- Date and status filters are available.

### US-E3 - Report Suspicious Content

**Release:** V1

Users can report suspicious or incorrect surveys from the detail page, providing a required reason for the report, which moderators can then mark as reviewed.

As a user, I want to report suspicious or incorrect surveys so community data stays trustworthy.

Acceptance criteria

- I can report a survey from its detail page.

- A reason is required when submitting a report.

- A moderator can mark a report as reviewed.
