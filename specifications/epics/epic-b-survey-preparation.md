# Epic B - Survey Preparation

## Scope
Access and manage personal surveys before data entry, and explore parcel study status/scores.

## User Stories

### US-B1 - List of My Surveys
As a contributor, I want to see my own surveys so I can track what I started and completed.

Acceptance criteria:
- The list displays at least: site, cadastral parcel id, observation year, version number, and status.
- The list displays a completion rate for in-progress surveys (for example as a percentage).
- I can filter by submit status (draft, submitted, expired), sync status, year, and parcel id.
- In offline mode, locally stored surveys remain visible.

### US-B2 - Survey Detail and Parcel History
As a contributor, I want to open a survey to review parcel context and previous observations before entering data.

Acceptance criteria:
- The detail view displays survey information (site, parcel id, year, version, and basic history).
- The detail view displays the submission deadline (creation date + 7 days) and remaining time.
- The detail view displays the survey completion rate.
- The detail view displays previous submitted surveys on the same parcel with year/version.
- The detail view exposes score comparison with previous versions (IBP total + factor-level deltas).
- An "Update" button opens the survey form for editable surveys.

### US-B3 - Manage Published Survey
As a contributor, I want to manage a submitted survey (delete it or change its visibility) so I stay in control of my data.

Acceptance criteria:
- From survey detail, I can change visibility between `private` and `public`.
- If I switch a survey from `public` to `private`, it is removed from community surfaces.
- I can delete a survey with a confirmation step.
- After deletion, the survey is no longer visible in my list or in community surfaces.

### US-B4 - Parcel Status Visualization
As a contributor, I want to see parcel study status on map views so I can identify already studied parcels quickly.

Acceptance criteria:
- In create/update/detail/explore map views, cadastral parcel boundaries are visible at high zoom.
- Parcel status is visible at high zoom (`studied` vs `not_studied`).
- Tapping a studied parcel can open its latest survey detail/history entry.

### US-B5 - Explore as Parcel Analysis Surface
As a contributor, I want Explore to help me analyze parcel scores so I can prioritize field work.

Acceptance criteria:
- Explore highlights parcel-level information first (status + latest score), not only raw point markers.
- Selecting a parcel exposes at least: parcel id, latest submitted score, and latest survey year/version.
- From Explore, I can open parcel history and the corresponding survey detail.
