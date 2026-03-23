# Epic B - Survey Preparation

**Release:** MVP

Access and manage personal surveys before data entry, and explore parcel study status/scores.

---

## User Stories

### US-B1 - List of My Surveys

**Release:** MVP

The list of surveys should display site, cadastral parcel ID, observation year, version number, and status, along with a completion rate for in-progress surveys. Users can filter by submit status, sync status, year, and parcel ID, and surveys should remain visible in offline mode.

As a contributor, I want to see my own surveys so I can track what I started and completed.

Acceptance criteria

- The list displays at least: parcel ids, survey name, last update date, version number, and status.

- The list displays a completion rate for in-progress surveys (for example as a percentage).

- I can filter by submit status (draft, submitted, expired), last update date.

- In offline mode, locally stored surveys remain visible.

### US-B2 - Survey Detail and Parcel History

**Release:** MVP

The survey detail view will show site and parcel information, submission deadlines, completion rates, previous surveys, and score comparisons with earlier versions. An "Update" button will allow editing of submitted surveys.

As a contributor, I want to open a survey to review parcel context and previous observations before entering data.

Acceptance criteria

-  The detail view displays survey information (site, parcel ids, last update date, version, and basic history).

- The detail view displays the submission deadline (creation date + 7 days) and remaining time.

- The detail view displays the survey completion rate.

- The detail view displays previous submitted surveys on the same parcel with year/version.

- The detail view exposes score comparison with previous versions (IBP total + factor-level deltas).

- An "Update" button opens the survey form for editable surveys.

### US-B3 - Manage Published Survey

**Release:** MVP

Contributors can manage submitted surveys by changing visibility between private and public, with public surveys removed from community surfaces when switched to private. Surveys can also be deleted with a confirmation step, after which they will no longer appear in the user's list or community surfaces.

As a contributor, I want to manage a submitted survey (delete it or change its visibility) so I stay in control of my data.

Acceptance criteria

- From survey detail, I can change visibility between `private` and `public`.

- If I switch a survey from `public` to `private`, it is removed from community surfaces.

- I can delete a survey with a confirmation step.

- After deletion, the survey is no longer visible in my list or in community surfaces.

### US-B4 - Parcel Status Visualization

**Release:** MVP

Parcel study status should be visualized on map views, showing cadastral boundaries and status (studied vs not studied) at high zoom. Tapping a studied parcel will provide access to its latest survey details and history.

As a contributor, I want to see parcel study status on map views so I can identify already studied parcels quickly.

Acceptance criteria

- In create/update/detail/explore map views, cadastral parcel boundaries are visible at high zoom.

- Parcel status is visible at high zoom (`studied` vs `not_studied`).

- Tapping a studied parcel can open its latest survey detail/history entry.

### US-B5 - Explore as Parcel Analysis Surface

**Release:** MVP

Explore should prioritize parcel-level information, displaying status and latest scores, while allowing users to access parcel history and survey details through selection. Acceptance criteria include highlighting relevant data such as parcel ID, latest submitted score, and survey year/version.

As a contributor, I want Explore to help me analyze parcel scores so I can prioritize field work.

Acceptance criteria

- Explore highlights parcel-level information first (status + latest score), not only raw point markers.

- Selecting a parcel exposes at least: parcel id, latest submitted score, and latest survey year/version.

- From Explore, I can open parcel history and the corresponding survey detail.
