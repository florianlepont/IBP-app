# Codebase Concerns

**Analysis Date:** 2026-09-22

## Tech Debt

### Component Size and Complexity

**Large React Screens:**
- Issue: Multiple screens exceed 1000 lines, combining layout, logic, and state management
- Files: `mobile/src/screens/SurveyListScreen.tsx` (1714 lines), `mobile/src/screens/SurveyDetailScreen.tsx` (1269 lines), `mobile/src/screens/SurveyFormScreen.tsx` (1190 lines)
- Impact: Difficult to test, modify, and reason about component behavior. High risk of unintended side effects during refactoring
- Fix approach: Extract reusable sub-components, move business logic to custom hooks, split screens into feature-based modules

**Large Service Files:**
- Issue: `api/src/surveys/surveys.service.ts` (1570 lines) contains multiple responsibilities (CRUD, validation, sync, attachments)
- Files: `api/src/surveys/surveys.service.ts`
- Impact: Violates single responsibility principle; difficult to test individual concerns; cascading changes
- Fix approach: Split into focused services (SurveyQueries, SurveyMutations, SurveyValidation)

**Large Sync Module:**
- Issue: `mobile/src/storage/sync.ts` (1133 lines) handles queue management, retries, uploads, and sync state
- Files: `mobile/src/storage/sync.ts`
- Impact: Single point of failure for critical offline-sync functionality; hard to track edge cases
- Fix approach: Refactor into separate modules per operation type (survey sync, attachment sync, queue management)

### Type Safety Regressions

**Unsafe Type Casts:**
- Issue: Multiple `as unknown`, `as any`, and non-null assertions (`!`) in mobile code bypassing type safety
- Files: `mobile/src/app/AuthenticatedAppNavigation.tsx` (line 601: `as any`), `mobile/src/storage/sync.ts` (line 144: `as unknown as Blob`), `mobile/src/components/ParcelOverlayPolygons.tsx` (lines 56, 76, 81)
- Impact: Hides type errors at compile time; runtime crashes possible if data shape changes
- Fix approach: Use proper type guards, discriminated unions, or safe cast functions; avoid casts in hot paths

**Non-null Assertions:**
- Issue: `!` operator used without null checks in render paths
- Files: `mobile/src/screens/SurveyListScreen.tsx` (line 1064), test files
- Impact: Potential null pointer exceptions in production if data is unexpectedly absent
- Fix approach: Use optional chaining and fallback values; add assertion guards with error boundaries

## Known Bugs

### N+1 Query Pattern in Sync Changes

**Database Query Performance:**
- Symptoms: Sync API `/changes` endpoint may perform slowly when loading surveys with attachments
- Files: `api/src/surveys/surveys-sync.service.ts` (lines 351–388, 444–490)
- Issue: Subquery `SELECT array_agg(sp.parcel_id ORDER BY sp.parcel_id) FROM survey_parcels sp WHERE sp.survey_id = s.id` executed per survey result, not batched
- Trigger: Any sync pull with multiple surveys; impact scales linearly with survey count
- Workaround: Batch parcel lookups in a separate query; join via `survey_parcels` table directly
- Fix approach: Use LATERAL join or separate query with manual aggregation in application layer

### Subquery SQL in String Interpolation

**Query Construction Anti-pattern:**
- Symptoms: Account deletion may fail or behave unexpectedly if subquery logic changes
- Files: `api/src/users/users.service.ts` (lines 268–277, 286, 296, 303, 310, 315)
- Issue: Subquery strings (`const retainedSurveySubquery = ...`) are embedded via template literals into parameterized queries, mixing parameterization approaches
- Trigger: Edge cases in user deletion flow; hard to audit for security or correctness
- Fix approach: Use proper SQL generation library or move logic to application layer with explicit array handling

## Security Considerations

### Unvalidated Presigned URL Handling

**S3/MinIO Attachment URLs:**
- Risk: Presigned URLs embedded in sync responses could leak if client network is compromised
- Files: `api/src/surveys/surveys-attachments.service.ts`, `mobile/src/storage/sync.ts`
- Current mitigation: URLs have TTL; Bearer token required for direct API uploads
- Recommendations: Add validation that presigned URLs are only returned for user's own attachments; log all presigned URL requests for audit trail

### Auth Token Persistence

**Secure Store Implementation:**
- Risk: Auth0 tokens stored in Expo SecureStore; if device unlocked, tokens could be extracted
- Files: `mobile/src/hooks/useAuth0Session.ts`, secure storage configuration
- Current mitigation: Device OS-level keychain/keystore protection
- Recommendations: Add token rotation on app resume; implement app-level encryption layer; monitor for unusual token usage patterns

### CORS Configuration

**Permissive CORS in Development:**
- Risk: `app.enableCors({ origin: true })` allows any origin if `CORS_ORIGIN` not set; production leaks data if env var missing
- Files: `api/src/main.ts` (line 15)
- Current mitigation: Requires explicit `CORS_ORIGIN` env var; defaults to public
- Recommendations: Change default to `false` or empty list; log all CORS requests; use strict origin matching in production

## Performance Bottlenecks

### JSONB Query Complexity

**Survey Factor Storage:**
- Problem: `factors`, `factor_results`, `scores` stored as JSONB; queries must deserialize and filter in application layer
- Files: `api/src/surveys/surveys-sync.service.ts` (SELECT statements with JSONB columns)
- Cause: JSONB provides flexibility but queries cannot use indexes on nested properties efficiently
- Impact: Sync responses include large JSON payloads; CPU cost scales with survey complexity
- Improvement path: Profile query performance; consider partial indexes on frequently queried JSONB keys; evaluate decomposing critical fields into columns

### Sync Batch Serialization

**Batch Operation Processing:**
- Problem: All 100 sync operations processed sequentially in a for-loop, each hitting DB or external service
- Files: `api/src/surveys/surveys-sync.service.ts` (lines 47–191)
- Cause: No concurrency limits; operations await sequentially
- Impact: Sync takes 10+ seconds for 100 operations on high-latency networks
- Improvement path: Use `Promise.all()` with configurable concurrency limit; batch DB writes where possible

### Attachment Upload Retry Logic

**Exponential Backoff:**
- Problem: `MAX_RETRY_COUNT = 8` with exponential backoff may wait hours before giving up
- Files: `mobile/src/storage/db.ts`, `mobile/src/storage/sync.ts`
- Cause: Fixed retry count without jitter or max wait time cap
- Impact: Failed uploads block queue; user cannot clear them without app reset
- Improvement path: Implement configurable max wait time (e.g., 24 hours); add user-initiated retry reset

## Fragile Areas

### Mobile Sync State Management

**Complex Hook Dependencies:**
- Files: `mobile/src/hooks/useSurveySync.ts` (461 lines), composed from 9+ sub-hooks
- Why fragile: Circular dependencies possible between `useSurveySync`, `useSurveySyncNetwork`, `useSurveySyncSurveyOperations`; no clear data flow or event ordering
- Safe modification: Document hook dependency graph; add integration tests for multi-hook scenarios; extract state logic to a reducer pattern
- Test coverage: `mobile/src/hooks/useSurveySync.test.ts` exists but covers only happy paths

### Screen Test Coverage Gaps

**Untested Screens:**
- Files: 9 of 12 screens lack test coverage: `SurveyListScreen.tsx`, `SurveyDetailScreen.tsx`, `SurveyFormScreen.tsx`, `PublicMapScreen.tsx`, `HomeScreen.tsx`, `AccountScreen.tsx`, and others
- What's not tested: Navigation between screens, error state rendering, edge cases in offline mode
- Risk: UI regressions slip to production; complex screen logic (filters, sorting, sync status) not validated
- Priority: High — sync UI is user-facing; failures block survey workflow

### Database Transaction Atomicity

**User Deletion Transaction:**
- Files: `api/src/users/users.service.ts` (lines 263–328)
- Why fragile: Manual transaction management (BEGIN/ROLLBACK); if async cleanup throws, partially deleted records remain; not wrapped in a connection pool transaction handler
- Safe modification: Use NestJS database transaction decorator or explicit QueryRunner pattern; ensure cleanup operations are idempotent
- Test coverage: `api/test/users.service.spec.ts` exists but doesn't fully cover transaction failure scenarios

### Parcel Geometry Parsing

**GeoJSON Coordinate Handling:**
- Files: `mobile/src/components/ParcelOverlayPolygons.tsx` (lines 56–82)
- Why fragile: Assumes coordinates structure without validation; multiple `as unknown[]` casts; no bounds checking
- Safe modification: Add schema validation (zod/io-ts) for GeoJSON; add error boundary for failed rendering
- Test coverage: No dedicated tests for coordinate parsing edge cases (empty rings, invalid nesting, etc.)

## Scaling Limits

### SQLite Database Size on Mobile

**Local Storage Limits:**
- Current capacity: Expo SQLite on iOS/Android typically supports files up to device storage limit (varies, but ~4GB practical for app cache)
- Limit: App-specific storage sandbox limits app to ~5-10 GB on modern devices; older devices may have less
- Trigger: User with 1000+ surveys and high-volume attachments will hit storage limits
- Scaling path: Implement local database cleanup (archive old surveys); lazy-load attachments; compress attachment metadata

### Attachment Storage on VPS

**Local Filesystem Scaling:**
- Current capacity: `/tmp/ibp-uploads` or configured directory accumulates all attachments; no cleanup policy
- Limit: VPS disk fills up after ~10K-100K large images (100MB–1GB depending on disk size)
- Scaling path: Implement S3 mandatory mode in production; add cron job to clean orphaned files; monitor disk usage and alert

### PostgreSQL Index Coverage

**Missing Indexes on Frequently Filtered Tables:**
- Files: `api/migrations/001_init.sql` and others
- Problem: Indexes exist for `surveys(user_id, updated_at)` and `survey_events(survey_id, created_at)`, but no indexes on `survey_parcels`, `attachments` for common queries
- Impact: Queries on parcel boundaries or attachment metadata will full-table scan
- Scaling path: Add indexes on `attachments(survey_id, created_at)`, `survey_parcels(survey_id)`, `users(auth0_sub)`

## Dependencies at Risk

### Expo SDK Major Version Lock

**Risk:** Locked to Expo SDK 57; react-native 0.86.3 is at rapid iteration pace
- Impact: Security patches, native OS compatibility (iOS 18, Android 15+) may not be available; missing fixes for gesture handler, navigation bugs
- Migration plan: Establish quarterly upgrade schedule; test against latest SDK before major releases; maintain branch tracking upstream changes

### Auth0 Native SDK Version

**Risk:** `react-native-auth0` ^5.4.0; major version constraints could lock in bugs
- Impact: Auth0 platform changes (OIDC deprecations, tenant security policies) may break login
- Migration plan: Monitor Auth0 breaking changes; add integration tests for Auth0 flow; plan SDK upgrade path for v6

### PostgreSQL Raw SQL (No ORM)

**Risk:** No abstraction layer; SQL injection possible if parameterization not followed
- Impact: Data loss or compromise if developer bypasses `$1, $2` param syntax
- Migration plan: Add linting rule to catch string interpolation in SQL; use query builder if dynamic queries grow; add database schema validation layer

## Missing Critical Features

### Rate Limiting on Sync Endpoint

**Problem:** No rate limit on `/sync` batch endpoint; malicious client can hammer server with large batches
- Blocks: Protection against DoS; fair resource allocation for multiple users
- Current mitigation: None (relies on Auth0 token validity)
- Fix approach: Add `@Throttle` decorator from `@nestjs/throttler`; configure per-user rate limits

### Offline Sync Monitoring

**Problem:** App cannot distinguish between "waiting to sync" and "sync broken"; no telemetry for sync failures
- Blocks: Support debugging; product visibility into sync reliability
- Current state: Errors logged to device only; backend unaware of sync problems
- Fix approach: Add sync error event logging to backend; implement client-side telemetry service

### Attachment Orphan Cleanup

**Problem:** If attachment upload fails or sync crashes mid-way, local files remain on disk with no cleanup
- Blocks: Storage management; user experience (large cache grows indefinitely)
- Current mitigation: Manual DB cleanup only; filesystem not checked
- Fix approach: Implement periodic cleanup job comparing local files to DB; add user-initiated "clear cache" button

## Test Coverage Gaps

### Integration Tests for Sync Scenarios

**Untested area:** Multi-step sync with network interruption, partial failures, conflict resolution
- Files: `api/test/surveys-idempotency.e2e-spec.ts` covers idempotency but not recovery
- What's not tested: Sync state after timeout, retry after network restore, duplicate receipt handling
- Risk: Hidden bugs in production when network unstable; sync gets stuck
- Priority: High — sync is core feature; offline reliability is value prop

### Mobile Offline-Mode Unit Tests

**Untested area:** SQLite queries under concurrent updates, queue ordering, attachment upload state transitions
- Files: `mobile/src/storage.test.ts` covers basic CRUD but not concurrency or edge cases
- What's not tested: Rapid create/update/delete on same survey, attachment upload while survey is being edited, queue persistence across app restarts
- Risk: Data corruption or lost sync operations under real-world usage
- Priority: Medium-High — affects data integrity

### Error Handling Edge Cases

**Untested area:** Malformed API responses, partial JSONB data, missing required fields in sync payload
- Files: Test files do not mock network failures or schema violations
- What's not tested: Graceful degradation when attachment metadata is missing, survey sync with incomplete factor data, auth token expiry mid-sync
- Risk: Unhandled exceptions crash app or leave database in inconsistent state
- Priority: Medium — error resilience impacts user trust

### Cross-Platform Screen Tests

**Untested area:** iOS-specific gesture handling, Android keyboard interactions, screen rotation mid-sync
- Files: Only 3 of 12 screens have tests; no platform-specific tests
- What's not tested: Platform-specific permission flows, SafeArea insets, native modal behavior
- Risk: iOS app crashes on home indicator gesture; Android app data loss on config change
- Priority: Medium — platform-specific bugs hard to reproduce in dev

---

*Concerns audit: 2026-09-22*
