# Epic C - IBP Survey Data Entry

**Release:** MVP

Create, edit, and submit IBP surveys with validation and expiration rules.
Provide on-demand pedagogical guidance during survey completion.

---

## User Stories

### US-C1 - Guided Data Entry

**Release:** MVP

A guided form will be created to ensure all required information is captured, including clearly identified mandatory fields, parcel linkage metadata, all IBP factors, appropriate field types, and validation errors displayed per field.

As a contributor, I want to complete a guided form so I do not miss any required information.

Acceptance criteria

- Required fields are clearly identified.

- The form captures mandatory parcel linkage metadata (`parcel_ids[]`, observation year, version).

- The form includes all IBP factors (`A` to `J`) and each factor can be completed from the survey form flow.

- Field types are appropriate (text, number, list, date, boolean).

- Validation errors are displayed per field.

### US-C2 - Save as Draft

**Release:** MVP

As a contributor, the ability to save a draft at any time without submission is essential. Draft changes should be saved automatically and be accessible offline, with a visible last modified date. A warning will appear if less than 24 hours remain before expiration.

As a contributor, I want to save a draft so I can continue later.

Acceptance criteria

- I can save at any time without submitting.

- Draft changes are saved automatically locally while editing.

- The draft is available offline on the device.

- The last modified date is visible.

- If less than 24 hours remain before expiration, a warning is displayed.

### US-C3 - Supporting Photos

**Release:** MVP

Users can attach up to 10 photos to a survey, either by taking new photos or selecting existing ones. They can preview and navigate between photos, remove any before submission with confirmation, and all photos remain linked to the survey after synchronization, allowing offline access if previously synced.

As a contributor, I want to capture and attach photos to the survey to document the situation.

Acceptance criteria

- I can add up to 10 photos per survey.

- I can preview photos before submission.

- I can remove a photo before submission.

- Photos remain linked to the survey after synchronization.

### US-C4 - Parcel Linkage By Map Selection

**Release:** MVP

Users can select cadastral parcels on the map for traceability, with criteria including the ability to tap parcel polygons, reference multiple parcels, center the map on the current location, and create drafts offline. Submission is blocked if parcel linkage is missing or invalid.

As a contributor, I want to select one or many cadastral parcels directly on the map to ensure traceability and longitudinal follow-up.

Acceptance criteria

- During create/edit, user can tap parcel polygons to select or deselect them.

- A survey can reference one or many parcels (`parcel_ids[]`).

- The app can center the map on current location to help nearby selection.

- Offline mode does not block draft creation/edit; parcel linkage can be completed once parcel layer is available online.

- Submission is blocked if parcel linkage is missing or invalid.

### US-C5 - Submit Survey

**Release:** MVP

Submission of a completed survey requires all IBP factors to be filled and scoreable, with specific metadata present. If blocked, the app shows reasons for the blockage. Surveys older than 7 days are marked as expired. Successful submissions change the survey status to read-only and trigger automatic synchronization.

As a contributor, I want to submit a completed survey to share my observation.

Acceptance criteria

- Submission is blocked until all IBP factors (`A` to `J`) are completed and scoreable.

- Submission is blocked if cadastral parcel linkage metadata is missing (`parcel_ids[]`, observation year, version).

- When submission is blocked, the app displays an explicit reason and identifies missing items (missing factors and/or required fields).

- Submission is blocked if the survey is older than 7 days; the survey transitions to status `expired`.

- After a successful submission request, survey status transitions to `submitted` and the survey becomes read-only for data entry.

- A local confirmation message is displayed after successful submission.

- Synchronization is automatic after submission (no manual trigger required): the submitted survey enters sync flow and eventually reaches synced/error state according to Epic D rules.

### US-C6 On-Demand Pedagogical Help During Entry

**Release:** MVP

Contextual educational help will be provided during survey entry for complex fields, allowing users to access plain-language explanations, observations, and scoring guidance without losing their progress. Closing the help will return users to their previous state in the form.

As a contributor, I want contextual educational help while filling specific fields so I can complete IBP correctly even as a non-expert.

Acceptance criteria

- During survey entry, each complex field can expose a help entry point (for example: "Help" or "How to assess this factor?").

- Help content is displayed on demand without losing current form progress.

- Help content includes at least: plain-language explanation, what to observe in the field, and scoring guidance for the field.

- Closing help returns the user to the same field/state in the form.

### US-C7 - Survey Privacy Choice (Private/Public)

**Release:** MVP

Users can choose the visibility of their survey as either private or public before submission, with the default set to private. Visibility can be changed later, and public surveys can be shared with the community, while private surveys are only visible to the contributor and authorized moderators/admins.

As a contributor, I want to choose whether my survey is private or public so I control what is shared with the community.

Acceptance criteria

- Before submission, I can set survey visibility to `private` or `public`.

- Default visibility is `private`.

- I can change visibility later from survey detail.

- `Public` surveys are shareable to community surfaces; `private` surveys remain visible only to the contributor and authorized moderators/admins.

### US-C8 - Survey Versioning and Historical Context

**Release:** V1

Each new survey on a parcel should have a version number and observation year, with the app suggesting the next version. It must display previous scores and allow viewing historical trends within the survey flow.

As a contributor, I want each new survey on the same parcel to be versioned and compared to previous years.

Acceptance criteria

- A survey on a parcel has an explicit version number (`1`, `2`, `3`, ...) and observation year.

- The app proposes a default next version when creating a new survey on an already studied parcel.

- Before and during entry, the app can show previous scores for the same parcel (total and factors).

- In survey detail, historical trend can be viewed without leaving the survey flow.

### US-C9 - Capture photos and recognize tree species to help complete Factor A

**Release:** MVP

As a field surveyor, I want to take photos in the app and automatically detect / suggest tree species from the photos so that completing Factor A is faster and more accurate.

Acceptance criteria:

- From the Factor A section, I can add one or more photos.

- The app suggests one or more species with a confidence score.

- I can confirm, edit, or reject the suggested species.

- The selected species are saved with the survey and can be reviewed later.

- The feature works offline once the model is available on-device, or clearly indicates when connectivity is required.
