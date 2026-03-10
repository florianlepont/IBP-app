# Epic D - Offline and Synchronization

## Scope
Allow contributions in low connectivity and ensure reliable sync.

## User Stories

### US-D1 - Offline Work
As a contributor, I want to use the app without network access so I can continue my survey.

Acceptance criteria:
- I can view already-loaded surveys and edit drafts offline.
- Offline actions are queued for synchronization.
- Parcel linkage metadata (`parcel_id`, year, version) remains available offline for edited surveys.
- Recently used cadastral map context (at least viewed parcel boundaries/status) can be reused offline for continuity.

### US-D2 - Automatic Synchronization
As a contributor, I want my surveys to sync automatically when the network is back.

Acceptance criteria:
- Upon reconnection, pending surveys are sent automatically.
- No manual synchronization action is required from the contributor.
- Submitted surveys are also synchronized automatically after submission.
- Status changes to "synced" when successful.
- On failure, status changes to "error" with an actionable message.
- Downsync includes parcel history updates used by score comparison views.

### US-D3 - Parcel and Version Conflict Resolution
As a contributor, I want sync conflicts on parcel linkage/versioning to be handled clearly so data stays consistent.

Acceptance criteria:
- If server rejects a survey because of parcel/version conflict, the app stores a clear blocking error.
- Conflict payload explains expected parcel/version state and the local conflicting values.
- User can retry after correction, or discard local conflicting changes.
