# Epic C - IBP Survey Data Entry

## Scope
Create, edit, and submit IBP surveys with validation and expiration rules.
Provide on-demand pedagogical guidance during survey completion.

## User Stories

### US-C1 - Guided Data Entry
As a contributor, I want to complete a guided form so I do not miss any required information.

Acceptance criteria:
- Required fields are clearly identified.
- The form captures mandatory parcel linkage metadata (`parcel_ids[]`, observation year, version).
- The form includes all IBP factors (`A` to `J`) and each factor can be completed from the survey form flow.
- Field types are appropriate (text, number, list, date, boolean).
- Validation errors are displayed per field.

### US-C2 - Save as Draft
As a contributor, I want to save a draft so I can continue later.

Acceptance criteria:
- I can save at any time without submitting.
- Draft changes are saved automatically locally while editing.
- The draft is available offline on the device.
- The last modified date is visible.
- If less than 24 hours remain before expiration, a warning is displayed.

### US-C3 - Supporting Photos
As a contributor, I want to capture and attach photos to the survey to document the situation.

Acceptance criteria:
- I can take a photo with the camera or choose one from the gallery.
- I can remove a photo before submission.
- Photos remain linked to the survey after synchronization.

### US-C4 - Parcel Linkage By Map Selection
As a contributor, I want to select one or many cadastral parcels directly on the map to ensure traceability and longitudinal follow-up.

Acceptance criteria:
- During create/edit, user can tap parcel polygons to select or deselect them.
- A survey can reference one or many parcels (`parcel_ids[]`).
- The app can center the map on current location to help nearby selection.
- Offline mode does not block draft creation/edit; parcel linkage can be completed once parcel layer is available online.
- Submission is blocked if parcel linkage is missing or invalid.

### US-C5 - Submit Survey
As a contributor, I want to submit a completed survey to share my observation.

Acceptance criteria:
- Submission is blocked until all IBP factors (`A` to `J`) are completed and scoreable.
- Submission is blocked if cadastral parcel linkage metadata is missing (`parcel_ids[]`, observation year, version).
- When submission is blocked, the app displays an explicit reason and identifies missing items (missing factors and/or required fields).
- Submission is blocked if the survey is older than 7 days; the survey transitions to status `expired`.
- After a successful submission request, survey status transitions to `submitted` and the survey becomes read-only for data entry.
- A local confirmation message is displayed after successful submission.
- Synchronization is automatic after submission (no manual trigger required): the submitted survey enters sync flow and eventually reaches synced/error state according to Epic D rules.

### US-C6 - On-Demand Pedagogical Help During Entry
As a contributor, I want contextual educational help while filling specific fields so I can complete IBP correctly even as a non-expert.

Acceptance criteria:
- During survey entry, each complex field can expose a help entry point (for example: "Help" or "How to assess this factor?").
- Help content is displayed on demand without losing current form progress.
- Help content includes at least: plain-language explanation, what to observe in the field, and scoring guidance for the field.
- Closing help returns the user to the same field/state in the form.

### US-C7 - Survey Privacy Choice (Private/Public)
As a contributor, I want to choose whether my survey is private or public so I control what is shared with the community.

Acceptance criteria:
- Before submission, I can set survey visibility to `private` or `public`.
- Default visibility is `private`.
- I can change visibility later from survey detail.
- `Public` surveys are shareable to community surfaces; `private` surveys remain visible only to the contributor and authorized moderators/admins.

### US-C8 - Survey Versioning and Historical Context
As a contributor, I want each new survey on the same parcel to be versioned and compared to previous years.

Acceptance criteria:
- A survey on a parcel has an explicit version number (`1`, `2`, `3`, ...) and observation year.
- The app proposes a default next version when creating a new survey on an already studied parcel.
- Before and during entry, the app can show previous scores for the same parcel (total and factors).
- In survey detail, historical trend can be viewed without leaving the survey flow.
