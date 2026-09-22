<!-- refreshed: 2026-09-22 -->
# Architecture

**Analysis Date:** 2026-09-22

## System Overview

Cortege is a distributed, offline-first system with two primary components: a React Native mobile client for field survey data entry, and a NestJS API for data persistence and public data sharing.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Client Layer                       │
│   Screens (HomeScreen, SurveyFormScreen, etc)                │
│   `mobile/src/screens/`                                      │
├──────────────────┬──────────────────┬───────────────────────┤
│  UI Components   │    Navigation    │   Custom Hooks         │
│  `mobile/src/ui/`│ (React Nav 6)    │ `mobile/src/hooks/`   │
│  `mobile/src/    │ `AuthenticatedAppNavigation` │            │
│  components/`    │ `mobile/src/app/` │            │          │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              State & Sync Orchestration Layer                │
│   useSurveySync (central hook orchestrator)                  │
│   `mobile/src/hooks/useSurveySync.ts`                        │
│                                                              │
│   Composed sub-hooks:                                        │
│   - useSurveySyncNetwork (offline/online sync queue draining)│
│   - useSurveySyncProfile (user profile sync)                 │
│   - useSurveySyncSurveyOperations (survey CRUD)              │
│   - useSurveyForm, useSurveyList (UI state)                  │
│   - useAuth0Session (auth token lifecycle)                   │
└─────────────────────────────────────────┬─────────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌──────────────────┬──────────────────┬──────────────────────┐
│  HTTP Client     │  Local Storage   │   IBP Logic          │
│  `mobile/src/    │  (SQLite)        │   (Scoring Rules)    │
│   api/client.ts` │  `mobile/src/    │  `mobile/src/app/    │
│                  │   storage/`      │   ibp-scoring.ts`    │
└────────┬─────────┴────────┬─────────┴──────────┬───────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Local SQLite DB                           │
│  - local_surveys: draft/submitted survey data                │
│  - sync_queue: pending operations with retry state           │
│  - local_attachments: photo metadata and sync state          │
│  - app_metadata: session and preference data                 │
│  `mobile/src/storage/db.ts`                                  │
└─────────────────────────────────────────────────────────────┘
         │
         │ (offline-capable)
         │ POST /v1/surveys/sync
         │ with pending operations
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                      NestJS API                              │
│           (Modular, request-scoped handlers)                 │
├──────────────────┬──────────────────┬───────────────────────┤
│ Controllers      │    Services      │   Authorization       │
│ - SurveysCtrl    │ - SurveysService │ - AuthGuard (JWT)     │
│ - SyncCtrl       │ - UsersService   │ - CurrentUser         │
│ - PublicCtrl     │ - ReportsService │   decorator           │
│ - ParcelsCtrl    │ - IbpRulesService│ - AdminGuard          │
│ - UsersCtrl      │   `api/src/      │   `api/src/auth/`     │
│ `api/src/        │    */*.service   │                       │
│  */               │    .ts`          │                       │
│  *.controller.ts` │                  │                       │
└────────┬─────────┴────────┬─────────┴──────────┬───────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌──────────────────┬──────────────────┬──────────────────────┐
│ Request/Response │  Business Logic  │  Auth0 Integration   │
│ Validation       │  Orchestration   │  - JWKS caching      │
│ (class-validator)│  (service        │  - Token validation  │
│ DTOs             │   composition)    │  - User provisioning │
│ `api/src/*/dtos` │  Raw SQL queries  │  `api/src/auth/      │
│                  │  via pg library   │   auth0-management   │
│                  │  `api/src/        │   .service.ts`       │
│                  │   database/       │                      │
│                  │   database        │                      │
│                  │   .service.ts`    │                      │
└────────┬─────────┴────────┬─────────┴──────────┬───────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│   - Raw SQL migrations: `api/migrations/`                    │
│   - Connection pooling via pg.Pool                           │
│   - Core tables: surveys, users, attachments, reports, etc   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│               Object Storage (S3-compatible)                 │
│  - Local: MinIO (dev)                                        │
│  - Production: AWS S3 or configurable S3                     │
│  - Presigned URLs for attachment download/upload             │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Mobile: App** | Root component initialization, Db setup, hook orchestration | `mobile/App.tsx` |
| **Mobile: Screens** | UI render for each workflow (home, survey form, details, etc) | `mobile/src/screens/*.tsx` |
| **Mobile: useSurveySync** | Central state orchestrator; triggers auth, profile sync, survey sync, attachment upload | `mobile/src/hooks/useSurveySync.ts` |
| **Mobile: useSurveySyncNetwork** | Drain sync queue when online, pull remote changes, retry backoff | `mobile/src/hooks/survey-sync/useSurveySyncNetwork.ts` |
| **Mobile: useAuth0Session** | Auth0 login flow, token refresh, session state | `mobile/src/hooks/useAuth0Session.ts` |
| **Mobile: SQLite storage** | Local schema (surveys, queue, attachments), queries | `mobile/src/storage/db.ts`, `mobile/src/storage/surveys.ts`, `mobile/src/storage/sync.ts` |
| **Mobile: HTTP client** | Fetch wrapper with Bearer token injection, typed errors | `mobile/src/api/client.ts` |
| **Mobile: IBP scoring** | Factor validation, score calculation client-side | `mobile/src/app/ibp-scoring.ts` |
| **API: AppModule** | NestJS root module; bootstraps all child modules | `api/src/app.module.ts` |
| **API: SurveysController** | HTTP handlers: POST/GET/PATCH surveys, attachments | `api/src/surveys/surveys.controller.ts` |
| **API: SyncController** | POST /surveys/sync endpoint handler | `api/src/surveys/sync.controller.ts` |
| **API: SurveysService** | Survey CRUD, parcel linkage, visibility, validation | `api/src/surveys/surveys.service.ts` |
| **API: SurveysSyncService** | Batch sync operation processor (upsert/delete) | `api/src/surveys/surveys-sync.service.ts` |
| **API: IbpRulesService** | Server-side IBP factor validation, score rules | `api/src/surveys/ibp-rules.service.ts` |
| **API: AuthGuard** | JWT validation against Auth0 JWKS, caching | `api/src/auth/auth.guard.ts` |
| **API: UsersService** | User profile CRUD, auto-provisioning on first login | `api/src/users/users.service.ts` |
| **API: DatabaseService** | pg Pool wrapper for raw SQL queries | `api/src/database/database.service.ts` |

## Pattern Overview

**Overall:** Offline-first mobile + sync-enabled API, using **custom React hooks for state** (no Redux) on mobile and **NestJS modular services** on API.

**Key Characteristics:**
- **Offline capability:** Mobile persists all data locally in SQLite before attempting sync
- **Event-driven sync:** Sync queue drains automatically when online; manual trigger available
- **Auth0 integration:** RS256 JWT tokens, JWKS caching, auto-provisioning of users
- **Raw SQL:** No ORM; PostgreSQL queries hand-written and versioned in `api/migrations/`
- **Composable hooks:** Mobile state is built from smaller specialized hooks (auth, sync, form, list)
- **Server-side validation:** IBP factor rules enforced on API before persistence

## Layers

### Mobile Presentation Layer

**Purpose:** User-facing screens and UI components

**Location:** `mobile/src/screens/`, `mobile/src/ui/`, `mobile/src/components/`

**Contains:** 
- Screen components (HomeScreen, SurveyFormScreen, SurveyDetailScreen, AuthGateScreen, etc.)
- Reusable UI components (buttons, cards, chips, fields, notices)
- Styled card components for draft/nearby parcel display

**Depends on:** 
- Hooks (useSurveySync, useSurveyForm, useSurveyList, usePublicMapExplorer)
- Navigation (React Navigation native-stack + bottom-tabs)
- Design tokens (mobile/src/app/brand-tokens.ts)

**Used by:** App.tsx (root navigation tree)

### Mobile State & Orchestration Layer

**Purpose:** Centralize survey state, auth, sync, and profile management

**Location:** `mobile/src/hooks/`

**Contains:**
- `useSurveySync.ts` — Main orchestrator; composes smaller hooks
- `survey-sync/useSurveySyncNetwork.ts` — Sync queue draining, online detection, pull changes
- `survey-sync/useSurveySyncProfile.ts` — User profile sync
- `survey-sync/useSurveySyncSurveyOperations.ts` — Survey CRUD operations
- `useSurveyForm.ts` — Active form state during create/edit
- `useSurveyList.ts` — Cached survey list
- `useEditingDraft.ts` — Draft editing workflow
- `useSurveyDraftPatcher.ts` — Incremental patch accumulation
- `useAuth0Session.ts` — Auth state and token lifecycle
- `usePublicMapExplorer.ts` — Public map data fetching
- `useGpsCapture.ts` — Device location capture
- `useNearbyParcels.ts` — Nearby parcels query

**Depends on:**
- HTTP client (mobile/src/api/client.ts)
- Local storage queries (mobile/src/storage/)
- Auth0 native SDK

**Used by:** App.tsx, screens

### Mobile Data Access & Storage Layer

**Purpose:** Persist survey data, queue sync operations, manage local state

**Location:** `mobile/src/storage/`

**Contains:**
- `db.ts` — SQLite schema initialization (local_surveys, sync_queue, local_attachments, app_metadata)
- `surveys.ts` — Survey CRUD helpers
- `sync.ts` — Sync queue management
- `types.ts` — TypeScript types for storage
- `utils.ts` — Utility functions

**Schema:**
- `local_surveys` — Survey drafts with sync state (pending/synced/failed/blocked)
- `sync_queue` — Ordered queue of pending operations (upsert/delete) with retry count
- `local_attachments` — Photo metadata and upload/sync state
- `app_metadata` — Key-value for session and app-level state

**Depends on:** expo-sqlite

**Used by:** Hooks (useSurveySync and sub-hooks)

### Mobile HTTP & Integration Layer

**Purpose:** Typed HTTP client and API endpoint definitions

**Location:** `mobile/src/api/`

**Contains:**
- `client.ts` — Fetch wrapper with Bearer token injection, timeout (15s default), typed ApiError
- `ibp-api.ts` — All endpoint definitions (auth, sync, user, surveys, public map, attachments)

**Depends on:** expo-secure-store (for tokens)

**Used by:** Hooks

### Mobile Domain Logic & Utilities

**Purpose:** IBP scoring, formatting, number handling, navigation helpers

**Location:** `mobile/src/app/`

**Contains:**
- `ibp-scoring.ts` — Factor validation and score calculation
- `formatters.ts` — Date/time/number formatting
- `number-utils.ts` — Numeric helpers
- `survey-logic.ts` — Survey state/status logic
- `constants.ts` — App constants (factor keys, defaults, retry limits)
- `types.ts` — Shared TypeScript types (SurveyDetailTab, SurveyStats, SurveyEventItem)
- `AuthenticatedAppNavigation.tsx` — Navigation tree (native-stack + bottom-tabs)
- `styles.ts` — Global styles
- `brand-tokens.ts` — Design tokens (colors, spacing, fonts)
- `vegetation.ts` — Vegetation type mappings

**Depends on:** Nothing else (utilities only)

**Used by:** Screens, hooks, components

### API Controller Layer

**Purpose:** HTTP request/response handling and routing

**Location:** `api/src/*/`

**Contains:**
- `surveys/surveys.controller.ts` — Survey CRUD endpoints
- `surveys/sync.controller.ts` — POST /surveys/sync (batch sync handler)
- `surveys/public.controller.ts` — Public map endpoints
- `surveys/parcels.controller.ts` — Parcel metadata endpoints
- `users/users.controller.ts` — User profile endpoints
- `reports/reports.controller.ts` — Moderation/report endpoints
- `debug/debug.controller.ts` — Dev-only helpers

**Depends on:** Services, AuthGuard, CurrentUser decorator

**Used by:** HTTP routing (NestJS)

### API Service & Business Logic Layer

**Purpose:** Core business logic, database queries, validation

**Location:** `api/src/*/`

**Contains:**
- `surveys/surveys.service.ts` — Survey CRUD, validation, parcel linkage
- `surveys/surveys-sync.service.ts` — Batch sync operation processor
- `surveys/surveys-attachments.service.ts` — Attachment upload/download, S3 integration
- `surveys/ibp-rules.service.ts` — Factor scoring validation (server-side)
- `surveys/cadastre-provider.service.ts` — Parcel data from IGN WFS or synthetic
- `surveys/public-map.utils.ts` — Public map query/transform logic
- `users/users.service.ts` — User provisioning and profile updates
- `users/email.service.ts` — Email notifications
- `reports/reports.service.ts` — Report/moderation logic
- `auth/auth0-management.service.ts` — Auth0 API calls (delete account, etc.)

**Depends on:** DatabaseService, IbpRulesService, HTTP clients (Auth0, IGN)

**Used by:** Controllers, sync pipeline

### API Authentication & Authorization Layer

**Purpose:** JWT validation, user provisioning, access control

**Location:** `api/src/auth/`

**Contains:**
- `auth.guard.ts` — JWT validation against Auth0 JWKS; auto-provisions user on first login
- `auth0-management.service.ts` — Auth0 management API calls
- `current-user.decorator.ts` — @CurrentUser() decorator to inject authenticated user
- `admin.guard.ts` — Admin-only endpoint protection
- `auth.types.ts` — AuthenticatedUser type definition

**Request flow:**
1. AuthGuard extracts Bearer token from Authorization header
2. Validates signature against Auth0 JWKS (cached 10 min)
3. On first login, fetches user profile from Auth0 /userinfo
4. Provisions user record in PostgreSQL
5. Injects AuthenticatedUser into request.user
6. Controllers access via @CurrentUser() decorator

**Depends on:** Auth0 JWKS endpoint, DatabaseService, jwks-rsa, jsonwebtoken

**Used by:** All protected controllers

### API Database Layer

**Purpose:** PostgreSQL connection pooling and raw SQL query execution

**Location:** `api/src/database/`

**Contains:**
- `database.service.ts` — pg.Pool wrapper with query() and connect() methods
- `database.module.ts` — NestJS module providing DatabaseService

**Configuration:** Environment variables
- POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

**Depends on:** pg library

**Used by:** All services

### API Migration & Schema Management

**Purpose:** Version control for PostgreSQL schema changes

**Location:** `api/migrations/`

**Contains:** Ordered SQL migration files (e.g., `001-initial-schema.sql`, `002-add-reports.sql`)

**Run by:** `npm run migrate:api` (api/scripts/migrate.js)

**Depends on:** Nothing (standalone SQL)

## Data Flow

### Primary Request Path: Survey Submission (Offline First)

1. **User creates/edits survey** (`mobile/src/screens/SurveyFormScreen.tsx`)
2. **Form data accumulates in useSurveyForm** (`mobile/src/hooks/useSurveyForm.ts`)
3. **Submit triggers upsertSurvey** (in `useSurveySyncSurveyOperations.ts`)
4. **Data written to local_surveys + operation queued in sync_queue** (`mobile/src/storage/surveys.ts`, `sync.ts`)
5. **useSurveySyncNetwork detects pending work** (`mobile/src/hooks/survey-sync/useSurveySyncNetwork.ts`)
6. **If online, POST to /v1/surveys/sync** (batch operations)
7. **SyncController receives batch, delegates to SurveysSyncService** (`api/src/surveys/sync.controller.ts`)
8. **For each operation:**
   - SurveysSyncService calls SurveysService.upsertForUser
   - IbpRulesService validates factors
   - Raw SQL INSERT/UPDATE executed via DatabaseService
   - Attachment presigned URLs generated
   - Response includes remote survey ID, attachment upload URLs
9. **Mobile receives results, updates local_surveys sync_state to "synced"** (`mobile/src/storage/sync.ts`)
10. **useSurveySyncNetwork pulls remote changes** (changes endpoint)
11. **useSurveyList refreshes local survey cache** (displayed on HomeScreen)

### Secondary Flow: User Authentication

1. **AuthGateScreen detects no session** (`mobile/src/screens/AuthGateScreen.tsx`)
2. **Launches Auth0 native SDK login flow** (via `useAuth0Session.ts`)
3. **Auth0 returns ID token + access token**
4. **useSurveySync.useAuth0Session stores tokens in Expo SecureStore**
5. **useSurveySyncProfile fetches user /userinfo from API** (`mobile/src/hooks/survey-sync/useSurveySyncProfile.ts`)
6. **API AuthGuard validates token against Auth0 JWKS** (`api/src/auth/auth.guard.ts`)
7. **On first login, UsersService auto-provisions user row** (`api/src/users/users.service.ts`)
8. **Profile cached locally; useSurveySync propagates isAuthenticated state to screens**

### Tertiary Flow: Sync Conflict / Retry

1. **Sync operation fails (network, validation, etc.)**
2. **useSurveySyncNetwork catches error, updates sync_queue retry_count**
3. **next_retry_at set to now + exponential backoff (up to 8 retries)**
4. **Operation status marked "failed"** (displayed on SurveyListScreen)
5. **If retry_count >= MAX_RETRY_COUNT (8), sync_blocked = 1**
6. **User sees "Sync blocked" status; manual intervention required**
7. **Pull from server remains active; UI shows latest server state for read-only fields**

## Key Abstractions

### LocalSurvey (Client)

**Purpose:** In-memory representation of a survey with sync metadata

**Location:** `mobile/src/storage/types.ts`

**Properties:**
- `id` — UUID
- `site_name` — User-visible name
- `status` — "draft" | "submitted"
- `visibility` — "private" | "public"
- `sync_state` — "pending" | "synced" | "failed"
- `sync_blocked` — Boolean flag for retry exhaustion
- `payload_json` — Serialized survey data (factors, parcel, etc.)
- `created_at`, `updated_at` — Timestamps

**Used by:** useSurveyList, useSurveySync, screens

### SyncQueueEntry (Client)

**Purpose:** Ordered operation to sync on next online moment

**Location:** `mobile/src/storage/types.ts`

**Properties:**
- `id` — Auto-increment
- `survey_id` — Linked survey
- `payload` — Operation data (upsert body or survey ID for delete)
- `status` — "pending" | "synced" | "failed"
- `retry_count` — Incremented on each retry
- `next_retry_at` — ISO timestamp for backoff
- `created_at`, `updated_at` — Timestamps

**Pattern:** Retry backoff follows exponential schedule; max 8 attempts

**Used by:** useSurveySyncNetwork

### SyncBatchBody (API)

**Purpose:** Batch of operations from mobile for server processing

**Location:** `api/src/surveys/surveys.types.ts`

**Structure:**
```typescript
{
  operations: [
    {
      client_ref?: string,      // mobile-generated ID for tracking
      entity: "survey",
      action: "upsert" | "delete",
      survey_id?: string,       // for delete
      payload?: SurveyUpsertBody // for upsert
    }
  ]
}
```

**Response:** Array of SyncOperationResult (status: "synced" | "failed", error details, server-assigned IDs)

**Used by:** SyncController, SurveysSyncService

### OperationStatus (Client)

**Purpose:** Track state of multiple concurrent operations (auth, sync, profile, etc.)

**Location:** `mobile/src/hooks/operation-status.ts`

**Properties:**
- `scope` — "session" | "auth" | "profile" | "sync" | "survey" | "attachment" | "debug"
- `state` — "idle" | "running" | "success" | "error"
- `message` — User-visible status text
- `timestamp` — Last update time

**Used by:** useSurveySync to report status bar text (e.g., "Sync in progress...")

**Pattern:** Single source of truth in operationStatus state; reported to all screens via navigation state

## Entry Points

### Mobile: App.tsx

**Location:** `mobile/App.tsx`

**Triggers:** App launch (OS startup or Expo dev reload)

**Responsibilities:**
1. Initialize local SQLite database (`initLocalDb()`)
2. Load stored API URL from local preference
3. Mount central useSurveySync hook (orchestrator)
4. Compose hook results (auth, surveys, form, etc.)
5. Route between AuthGateScreen → ProfileSetupScreen → AuthenticatedAppNavigation
6. Inject AppContext with status and callbacks to navigation tree

**Flow:**
- useEffect: Check if session is restoring (loading screen)
- useEffect: Load stored API URL
- Render AuthGateScreen if not authenticated
- Render ProfileSetupScreen if profile not yet set up
- Render AuthenticatedAppNavigation (native-stack + bottom-tabs)

### API: main.ts

**Location:** `api/src/main.ts`

**Triggers:** `npm run dev:api` or Node.js process startup

**Responsibilities:**
1. Import reflection metadata (NestJS requirement)
2. Load .env file
3. Create NestJS AppModule
4. Register helmet middleware (security headers)
5. Set global API prefix (`/v1`)
6. Enable CORS with configurable origins
7. Register global validation pipe (whitelist, forbid unknown, auto-transform)
8. Listen on PORT (default 3000) on 0.0.0.0
9. Log startup to console

**Flow:**
- bootstrap() async function
- NestFactory.create(AppModule)
- app.listen(port)
- Catch and exit on error

### API: app.controller.ts

**Location:** `api/src/app.controller.ts`

**Triggers:** GET /v1/health, GET /v1/

**Responsibilities:**
- Health check endpoint (used by deploy healthcheck)
- Root version/info endpoint

## Architectural Constraints

- **Threading:** Mobile is single-threaded event loop (React Native); API is multi-threaded (Node.js with async/await)
- **Global state:** Mobile: operationStatus in useSurveySync, survey cache in useSurveyList; API: DatabaseService pool singleton per module
- **Circular imports:** None detected; modules follow NestJS pattern with explicit imports
- **Offline capability:** Mobile can queue ops for days; must validate on reconnect
- **Retry limits:** Mobile: max 8 retries with exponential backoff; beyond that, marked sync_blocked
- **Auth token lifetime:** Access tokens short-lived (per Auth0 config); refresh tokens used for renewal; session can be cleared by user or token expiry

## Anti-Patterns

### Anti-Pattern: Storing sensitive data in AsyncStorage

**What happens:** API URLs, tokens, or parcel IDs accidentally stored in unencrypted AsyncStorage instead of SecureStore

**Why it's wrong:** AsyncStorage is plaintext; SecureStore uses platform keychain (iOS Keychain, Android Keystore)

**Do this instead:** Use Expo SecureStore for tokens (`useAuth0Session.ts` stores refresh token); use AsyncStorage only for non-sensitive preferences (API URL, theme, etc.)

### Anti-Pattern: Skipping server-side IBP validation

**What happens:** Assuming mobile IBP rules are sufficient; syncing invalid factor data to API

**Why it's wrong:** Client-side validation can be bypassed; server must validate all incoming data

**Do this instead:** IbpRulesService on API (`api/src/surveys/ibp-rules.service.ts`) re-validates every factor before persistence

### Anti-Pattern: Sync queue blocking forever on first failure

**What happens:** Operation fails once, marked sync_blocked, user sees "Sync blocked" permanently

**Why it's wrong:** Temporary network or validation errors should retry; only permanent failures should block

**Do this instead:** Retry backoff with MAX_RETRY_COUNT=8 (`mobile/src/storage/db.ts`); only after exhaustion set sync_blocked=1

### Anti-Pattern: Assuming network always online on API requests

**What happens:** Mobile makes API calls without fallback; timeout or network loss crashes the hook

**Why it's wrong:** Network transitions are common in field surveys; must handle gracefully

**Do this instead:** useSurveySyncNetwork detects online/offline state via expo-network and only syncs when online; timeout is 15s (configurable); errors caught and retried

## Error Handling

**Strategy:** Graceful degradation; sync failures don't crash the app, they queue for retry.

**Patterns:**

Mobile layer:
- useSurveySyncNetwork catches sync errors, updates sync_queue retry_count, sets sync_blocked if max retries exceeded
- API errors (network, timeout, validation) are caught in useSurveySync's reportStatus and displayed in status bar
- Auth errors trigger session clear and redirect to AuthGateScreen
- Survey delete in progress shows optimistic UI (removed from list) but reverted on sync failure

API layer:
- Controllers catch validation errors (BadRequestException, ValidationPipe)
- Services throw domain-specific exceptions (NotFoundException, ConflictException, UnprocessableEntityException)
- Database errors (constraint violations) mapped to user-friendly error codes sent to mobile
- Sync errors wrapped in sync-error.utils.ts, sent back to client in SyncOperationResult

## Cross-Cutting Concerns

**Logging:**
- Mobile: console.log + optional sentry integration (via operationStatus.message, displayable to support)
- API: NestJS Logger + optional structured logging (not currently in codebase, consider adding for production)

**Validation:**
- Mobile: IBP scoring rules checked before submit (`ibp-scoring.ts`); catch obvious errors early
- API: class-validator decorators on DTOs; IbpRulesService for domain rules; database constraints for data integrity

**Authentication:**
- Mobile: Auth0 native SDK, tokens stored in SecureStore, refresh flow in useAuth0Session
- API: AuthGuard validates JWT against Auth0 JWKS, caches signing keys, auto-provisions user on first login

**Error codes:**
- Mobile: API returns error codes in sync response; useSurveySyncNetwork logs them for debugging
- API: Sync error codes (e.g., "parcel_not_found", "invalid_factor") sent to client; clients should reference `sync-error.utils.ts` for interpretation

---

*Architecture analysis: 2026-09-22*
