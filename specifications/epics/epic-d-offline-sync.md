# Epic D - Offline and Synchronization

## Scope
Allow contributions in low connectivity and ensure reliable sync.

## User Stories

### US-D1 - Offline Work
As a contributor, I want to use the app without network access so I can continue my survey.

Acceptance criteria:
- I can view already-loaded surveys and edit drafts offline.
- Offline actions are queued for synchronization.

### US-D2 - Automatic Synchronization
As a contributor, I want my surveys to sync automatically when the network is back.

Acceptance criteria:
- Upon reconnection, pending surveys are sent automatically.
- No manual synchronization action is required from the contributor.
- Submitted surveys are also synchronized automatically after submission.
- Status changes to "synced" when successful.
- On failure, status changes to "error" with an actionable message.
