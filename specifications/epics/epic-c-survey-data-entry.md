# Epic C - IBP Survey Data Entry

## Scope
Create, edit, and submit IBP surveys with validation and expiration rules.
Provide on-demand pedagogical guidance during survey completion.

## User Stories

### US-C1 - Guided Data Entry
As a contributor, I want to complete a guided form so I do not miss any required information.

Acceptance criteria:
- Required fields are clearly identified.
- Field types are appropriate (text, number, list, date, boolean).
- Validation errors are displayed per field.

### US-C2 - Save as Draft
As a contributor, I want to save a draft so I can continue later.

Acceptance criteria:
- I can save at any time without submitting.
- The draft is available offline on the device.
- The last modified date is visible.
- If less than 24 hours remain before expiration, a warning is displayed.

### US-C3 - Supporting Photos
As a contributor, I want to capture and attach photos to the survey to document the situation.

Acceptance criteria:
- I can take a photo with the camera or choose one from the gallery.
- I can remove a photo before submission.
- Photos remain linked to the survey after synchronization.

### US-C4 - Geolocation
As a contributor, I want to record the survey GPS location to ensure traceability.

Acceptance criteria:
- During creation/submission, location is captured if permission is granted.
- If geolocation is unavailable, the app shows a message without blocking submission (rule to confirm).

### US-C5 - Submit Survey
As a contributor, I want to submit a completed survey to share my observation.

Acceptance criteria:
- Submission is blocked if required fields are missing.
- Submission is blocked if the survey is older than 7 days, and status changes to "expired".
- After submission, status changes to "submitted".
- A local confirmation message is displayed.

### US-C6 - On-Demand Pedagogical Help During Entry
As a contributor, I want contextual educational help while filling specific fields so I can complete IBP correctly even as a non-expert.

Acceptance criteria:
- During survey entry, each complex field can expose a help entry point (for example: "Help" or "How to assess this factor?").
- Help content is displayed on demand without losing current form progress.
- Help content includes at least: plain-language explanation, what to observe in the field, and scoring guidance for the field.
- Closing help returns the user to the same field/state in the form.
