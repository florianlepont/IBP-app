# Epic B - Survey Preparation

## Scope
Access and manage personal surveys before data entry.

## User Stories

### US-B1 - List of My Surveys
As a contributor, I want to see my own surveys so I can track what I started and completed.

Acceptance criteria:
- The list displays at least: site, survey type, creation date, and status.
- The list displays a completion rate for in-progress surveys (for example as a percentage).
- I can filter by status (draft, expired, submitted, synced, error).
- In offline mode, locally stored surveys remain visible.

### US-B2 - Survey Detail
As a contributor, I want to open a survey to review context before entering data.

Acceptance criteria:
- The detail view displays survey information (site, instructions, and basic history).
- The detail view displays the submission deadline (creation date + 7 days) and remaining time.
- The detail view displays the survey completion rate.
- A "Start/Continue" button opens the survey form.

### US-B3 - Manage Published Survey
As a contributor, I want to manage a submitted survey (delete it or change its visibility) so I stay in control of my data.

Acceptance criteria:
- From survey detail, I can change visibility between `private` and `public`.
- If I switch a survey from `public` to `private`, it is removed from community surfaces.
- I can delete a survey with a confirmation step.
- After deletion, the survey is no longer visible in my list or in community surfaces.
