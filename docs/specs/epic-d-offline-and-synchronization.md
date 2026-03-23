#  Epic D - Offline and Synchronization

**Release:** MVP

Allow contributions in low connectivity and ensure reliable sync.

---

## User Stories

### US-D1 - Offline map mode to navigate during field survey

**Release:** MVP

Field surveyors need an offline map mode to navigate without network coverage, featuring a clear "Offline" indicator, a basemap with locally available parcels, GPS positioning, and core interactions like zooming and selecting parcels functioning without connectivity.

As a field surveyor, I want to open the Explore screen in an offline map mode (tiles + previously downloaded parcels) so that I can navigate and orient myself even without network coverage.

Acceptance criteria

- A clear “Offline” indicator is visible (no network / offline mode).

- The map shows a basemap (tiles) and any parcels already available locally.

- GPS position is displayed and the map can follow the current location.

- Core interactions (zoom, pan, select a parcel) work without connectivity.

### US-D1 - Offline Work

**Release:** MVP

Users can access the app offline to continue surveys, with the ability to view and edit previously loaded surveys. Offline actions will be queued for synchronization, and essential metadata and recently used cadastral map context will remain accessible for continuity.

As a contributor, I want to use the app without network access so I can continue my survey.

Acceptance criteria

- I can view already-loaded surveys and edit drafts offline.

- Offline actions are queued for synchronization.

- Parcel linkage metadata (`parcel_id`, year, version) remains available offline for edited surveys.

- Recently used cadastral map context (at least viewed parcel boundaries/status) can be reused offline for continuity.

### US-D2 - Automatic Synchronization

**Release:** MVP

Surveys will sync automatically upon network reconnection, requiring no manual action from contributors. Pending surveys will be sent, and submitted surveys will also sync automatically. The status will indicate "synced" on success and "error" with a message on failure. Additionally, downsync will include updates to parcel history for score comparison views.

As a contributor, I want my surveys to sync automatically when the network is back.

Acceptance criteria

- Upon reconnection, pending surveys are sent automatically.

- No manual synchronization action is required from the contributor.

- Submitted surveys are also synchronized automatically after submission.

- Status changes to "synced" when successful.

- On failure, status changes to "error" with an actionable message.

- Downsync includes parcel history updates used by score comparison views.

### US-D2 - Download an area for offline use

**Release:** MVP

As someone preparing a survey, I want to download in advance an area around the target parcels (basemap + required geometries) from the Explore screen so that offline navigation in the field is guaranteed.

Acceptance criteria 

- I can select an area (for example around a parcel or a bounding box).

- The app shows estimated size and download progress.

- Downloaded areas are listed and can be deleted to free storage.

- The area remains available after closing and restarting the app.

### US-D3 - Parcel and Version Conflict Resolution

**Release:** MVP

Sync conflicts on parcel linkage/versioning should be handled clearly, with the app storing a blocking error if a survey is rejected due to conflict. The conflict payload must explain the expected state and local values, allowing users to retry after correction or discard conflicting changes.

As a contributor, I want sync conflicts on parcel linkage/versioning to be handled clearly so data stays consistent.

Acceptance criteria

- If server rejects a survey because of parcel/version conflict, the app stores a clear blocking error

- Conflict payload explains expected parcel/version state and the local conflicting values.

- User can retry after correction, or discard local conflicting changes.

### US-D3 - Warn when a parcel is not available offline

**Release:** MVP

As a field surveyor, I want to be warned when a parcel or a map area is not available offline so that I understand why it is not displayed and how to make it available.

Acceptance criteria

- If an expected parcel is not cached, a clear message explains it.

- A quick action lets me start the download when the network is available again

- The behavior is consistent in offline mode (no infinite spinners).

### US-D4 - Switch between satellite and map basemap layers

**Release:** MVP

As a field surveyor, I want to switch the basemap layer between Satellite and Map in the Explore map view so that I can choose the most useful context depending on conditions.

Acceptance criteria 

- A basemap selector is available in the Explore map UI.

- I can toggle between at least two options: “Satellite” and “Map”.

- The selection persists while navigating within the session.

- The default basemap is configurable (app setting or sensible default).
