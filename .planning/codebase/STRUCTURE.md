# Codebase Structure

**Analysis Date:** 2026-09-22

## Directory Layout

```
cortege/ (npm workspaces monorepo)
├── .claude/                    # Claude Code settings
│   └── skills/                 # Project-specific GSD skills
├── .github/
│   └── workflows/              # CI/CD (ci.yml: lint, test, build Docker)
├── .planning/
│   ├── codebase/               # Generated architecture docs
│   └── phases/                 # Planning outputs from GSD commands
├── .prettierrc.json            # Formatter config (double quotes, 2 spaces, 100 line width, no semicolons)
├── .eslintrc.json              # Linter config (no unused vars, no explicit any, ES modules only)
├── CLAUDE.md                   # Project instructions (tech stack, setup, conventions)
├── CONTRIBUTING.md             # Contributing guide
├── README.md                   # Project overview
├── docs/                       # Technical documentation
│   ├── technical/              # Architecture, data contracts, ADRs
│   ├── specs/                  # Product specs, user stories, epics
│   ├── design/                 # Brand and design system
│   └── user-tests/             # User testing reports
├── infra/                      # Infrastructure as code
│   ├── docker-compose.yml      # Local dev stack (PostgreSQL, MinIO, pgAdmin)
│   └── vps/                    # VPS deployment (systemd, Caddy, pull-based updates)
├── scripts/                    # Root-level utilities
├── mobile/                     # React Native / Expo package
│   ├── src/                    # TypeScript source
│   │   ├── App.tsx             # Root component (DB init, hook orchestration, navigation)
│   │   ├── storage.ts          # Re-exports storage module
│   │   ├── screens/            # Screen components (Home, SurveyForm, SurveyDetail, etc)
│   │   ├── hooks/              # Custom hooks (useSurveySync and sub-hooks)
│   │   │   └── survey-sync/    # Specialized sync hooks (network, profile, operations)
│   │   ├── components/         # UI components (ParcelOverlay, DraftCard, etc)
│   │   ├── ui/                 # Reusable UI elements (buttons, cards, chips, fields)
│   │   ├── api/                # HTTP client and endpoint definitions
│   │   ├── storage/            # SQLite schema, queries, types
│   │   ├── app/                # Domain logic (IBP scoring, formatters, constants, types)
│   │   └── __mocks__/          # Jest mocks for tests
│   ├── test/                   # Test fixtures and utilities
│   ├── assets/                 # Images, fonts (committed)
│   ├── plugins/                # Expo plugins for native configuration
│   ├── App.tsx                 # Stub (re-export from src/)
│   ├── index.js                # Entry point
│   ├── app.json                # Expo app config (icon, permissions, Auth0, etc)
│   ├── app.json                # Expo app config
│   ├── metro.config.js         # Metro bundler config
│   ├── jest.unit.config.js     # Jest config for unit tests
│   ├── tsconfig.json           # TypeScript config
│   ├── package.json            # Dependencies (Expo 54, React Native 0.81, Auth0, etc)
│   ├── README.md               # Mobile-specific setup
│   └── README-native.md        # Native customization guide
├── api/                        # NestJS package
│   ├── src/
│   │   ├── main.ts             # NestJS bootstrap (port, CORS, validation pipe)
│   │   ├── app.module.ts       # Root module (module imports and setup)
│   │   ├── app.controller.ts   # Health/info endpoints
│   │   ├── auth/               # Authentication (JWT, Auth0, guards)
│   │   │   ├── auth.guard.ts   # JWT validation against Auth0 JWKS
│   │   │   ├── auth.module.ts  # Auth module setup
│   │   │   ├── auth.types.ts   # AuthenticatedUser type
│   │   │   ├── auth0-management.service.ts # Auth0 API calls
│   │   │   ├── current-user.decorator.ts   # @CurrentUser() injection
│   │   │   └── admin.guard.ts  # Admin-only protection
│   │   ├── users/              # User profile management
│   │   │   ├── users.service.ts       # CRUD, provisioning
│   │   │   ├── users.controller.ts    # Endpoints
│   │   │   ├── users.module.ts        # Module setup
│   │   │   ├── email.service.ts       # Email notifications
│   │   │   └── dtos/                  # Request/response DTOs
│   │   ├── surveys/            # Survey CRUD and sync
│   │   │   ├── surveys.service.ts            # CRUD, validation, parcel linkage
│   │   │   ├── surveys.controller.ts        # GET/POST/PATCH endpoints
│   │   │   ├── surveys-sync.service.ts      # Batch sync processor
│   │   │   ├── surveys-attachments.service.ts # Upload/download, S3
│   │   │   ├── ibp-rules.service.ts         # Factor validation rules
│   │   │   ├── cadastre-provider.service.ts # Parcel data (IGN WFS or synthetic)
│   │   │   ├── sync.controller.ts           # POST /surveys/sync handler
│   │   │   ├── public.controller.ts         # Public map endpoints
│   │   │   ├── parcels.controller.ts        # Parcel metadata endpoints
│   │   │   ├── surveys.module.ts            # Module setup
│   │   │   ├── surveys.types.ts             # TypeScript types (SurveyRow, etc)
│   │   │   ├── surveys-normalize.utils.ts   # Input validation/normalization
│   │   │   ├── public-map.utils.ts          # Public map query logic
│   │   │   ├── sync-error.utils.ts          # Sync error code mapping
│   │   │   ├── dtos/                        # Request/response DTOs
│   │   │   └── __mocks__/                   # Jest mocks
│   │   ├── reports/            # Moderation/reporting
│   │   │   ├── reports.service.ts
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.module.ts
│   │   │   └── dtos/
│   │   ├── database/            # Database connection
│   │   │   ├── database.service.ts  # pg.Pool wrapper
│   │   │   └── database.module.ts   # NestJS module
│   │   ├── debug/              # Dev-only helpers
│   │   │   ├── debug.controller.ts  # Reset endpoints
│   │   │   ├── debug.service.ts
│   │   │   └── debug.module.ts
│   │   └── common/             # Shared utilities
│   │       └── file.utils.ts
│   ├── test/                   # E2E test specs
│   │   ├── *.e2e-spec.ts       # Jest E2E tests (require running DB)
│   │   └── __mocks__/          # Jest mocks
│   ├── migrations/             # SQL migration files (ordered)
│   │   ├── 001-initial-schema.sql
│   │   ├── 002-add-reports.sql
│   │   └── ...
│   ├── scripts/                # Build/migration scripts
│   │   └── migrate.js          # Run pending migrations
│   ├── jest.config.js          # Jest config (E2E)
│   ├── jest.unit.config.js     # Jest config (unit)
│   ├── tsconfig.json           # TypeScript config
│   ├── tsconfig.build.json     # TypeScript build config
│   ├── package.json            # Dependencies (NestJS, pg, class-validator, etc)
│   ├── .env.example            # Env template
│   └── README.md               # API-specific setup
└── package.json                # Root workspace config
```

## Directory Purposes

**`.claude/skills/`**
- Purpose: Project-specific GSD skills (not loaded by default; documented for reference)
- Contains: Subdirectories for skills (each has SKILL.md index)

**`.github/workflows/`**
- Purpose: CI/CD pipeline automation
- Contains: `ci.yml` (lint, format check, typecheck, test, Docker build on push to main)

**`.planning/codebase/`**
- Purpose: Generated architecture documentation (output of `/gsd-map-codebase`)
- Contains: ARCHITECTURE.md, STRUCTURE.md, TESTING.md, CONVENTIONS.md, STACK.md, INTEGRATIONS.md, CONCERNS.md

**`docs/`**
- Purpose: Project documentation (read before implementation)
- Key files:
  - `docs/technical/technical-architecture-v1.md` — System overview
  - `docs/technical/api-contract-v1.md` — REST API specification
  - `docs/technical/data-contract-v1.md` — PostgreSQL schema
  - `docs/technical/sync-conflict-resolution-v1.md` — Offline sync conflict strategy
  - `docs/technical/ibp-validation-matrix-v1.md` — Factor scoring rules
  - `docs/specs/user-stories.md` — Full backlog
  - `docs/specs/epic-*.md` — Feature specifications

**`infra/`**
- Purpose: Infrastructure and deployment
- Contains:
  - `docker-compose.yml` — Local dev stack (PostgreSQL 16, MinIO, pgAdmin)
  - `vps/` — VPS deployment (systemd timer for pull-based updates, Caddy reverse proxy)

**`mobile/src/screens/`**
- Purpose: Screen components (UI pages)
- Contains:
  - `HomeScreen.tsx` — Survey list, sync status
  - `SurveyFormScreen.tsx` — IBP factor data entry
  - `SurveyDetailScreen.tsx` — Survey review and visibility controls
  - `SurveyParcelSelectionScreen.tsx` — Parcel picker with map
  - `PublicMapScreen.tsx` — Public map explorer
  - `AuthGateScreen.tsx` — Login redirect
  - `ProfileSetupScreen.tsx` — First-time user setup
  - `AccountScreen.tsx` — User profile and account settings
  - `SettingsScreen.tsx` — App preferences and debug tools
  - `FactorDetailScreen.tsx` — Individual factor details

**`mobile/src/hooks/`**
- Purpose: Stateful logic (React hooks)
- Primary orchestrator: `useSurveySync.ts` (composes all sub-hooks)
- Composition:
  - `survey-sync/useSurveySyncNetwork.ts` — Sync queue draining, retry backoff
  - `survey-sync/useSurveySyncProfile.ts` — User profile sync
  - `survey-sync/useSurveySyncSurveyOperations.ts` — Survey CRUD
  - `useSurveyForm.ts` — Active form state
  - `useSurveyList.ts` — Cached survey list
  - `useEditingDraft.ts` — Draft editing workflow
  - `useSurveyDraftPatcher.ts` — Incremental patch accumulation
  - `useAuth0Session.ts` — Auth state and token lifecycle
  - `usePublicMapExplorer.ts` — Public map data fetching
  - `useGpsCapture.ts` — Device location capture
  - `useNearbyParcels.ts` — Nearby parcels query

**`mobile/src/storage/`**
- Purpose: Local SQLite persistence layer
- Contains:
  - `db.ts` — Schema (local_surveys, sync_queue, local_attachments, app_metadata)
  - `surveys.ts` — Survey CRUD helpers
  - `sync.ts` — Sync queue management and sync operation
  - `types.ts` — TypeScript types (LocalSurvey, SyncQueueEntry, etc.)
  - `utils.ts` — Utility functions (UUID generation, date handling)

**`mobile/src/api/`**
- Purpose: HTTP client and API endpoint definitions
- Contains:
  - `client.ts` — Fetch wrapper (Bearer token, timeout, typed errors)
  - `ibp-api.ts` — All endpoint definitions (auth, surveys, sync, public, attachments)

**`mobile/src/app/`**
- Purpose: Domain logic and shared utilities
- Contains:
  - `ibp-scoring.ts` — Factor validation and score calculation (client-side validation)
  - `formatters.ts` — Date/time/number formatting
  - `number-utils.ts` — Numeric helpers
  - `survey-logic.ts` — Survey status and state logic
  - `constants.ts` — App constants (factor keys, defaults, retry limits, timeouts)
  - `types.ts` — Shared TypeScript types (SurveyDetailTab, SurveyStats, SurveyEventItem)
  - `AuthenticatedAppNavigation.tsx` — Navigation tree setup (native-stack + bottom-tabs)
  - `styles.ts` — Global styles
  - `brand-tokens.ts` — Design tokens (colors, spacing, fonts)
  - `vegetation.ts` — Vegetation type mappings

**`mobile/src/ui/`**
- Purpose: Reusable UI components
- Contains: Buttons, cards, chips, fields, notices, badges (no business logic)

**`mobile/src/components/`**
- Purpose: Domain-specific components (maps, overlays, cards)
- Contains:
  - `ParcelOverlayPolygons.tsx` — IGN cadastre tile overlay on map
  - `IgnCadastreTileOverlay.tsx` — Tile layer management
  - `cards/` — Survey/parcel card components

**`api/src/auth/`**
- Purpose: Authentication and authorization
- Key files:
  - `auth.guard.ts` — JWT validation against Auth0 JWKS
  - `auth0-management.service.ts` — Auth0 API calls (delete account, get /userinfo)
  - `current-user.decorator.ts` — @CurrentUser() injection

**`api/src/surveys/`**
- Purpose: Survey CRUD and sync operations
- Key files:
  - `surveys.service.ts` — Core business logic (CRUD, validation, parcel linkage)
  - `surveys-sync.service.ts` — Batch sync processor (handles mobile sync requests)
  - `sync.controller.ts` — POST /v1/surveys/sync endpoint
  - `ibp-rules.service.ts` — Factor scoring validation (server-side)
  - `surveys.types.ts` — TypeScript types (SurveyRow, SyncBatchBody, etc.)
  - `dtos/` — Request/response DTOs (class-validator decorated)

**`api/src/users/`**
- Purpose: User profile management
- Key files:
  - `users.service.ts` — CRUD, auto-provisioning on first login
  - `users.controller.ts` — Profile endpoints

**`api/src/database/`**
- Purpose: PostgreSQL access layer
- Key files:
  - `database.service.ts` — pg.Pool wrapper (query() and connect() methods)

**`api/migrations/`**
- Purpose: SQL schema versioning
- Pattern: Ordered files (001-*.sql, 002-*.sql, etc.)
- Run by: `npm run migrate:api` (api/scripts/migrate.js)

**`api/test/`**
- Purpose: E2E tests (require running database)
- Files: `*.e2e-spec.ts` (Jest + Supertest)
- Run by: `npm run test:e2e`

## Key File Locations

### Entry Points

**Mobile:**
- `mobile/App.tsx` — Root component (DB init, hook orchestration, navigation)
- `mobile/index.js` — React Native entry point

**API:**
- `api/src/main.ts` — NestJS bootstrap (port, CORS, validation)
- `api/src/app.module.ts` — Root NestJS module

### Configuration

**Mobile:**
- `mobile/app.json` — Expo app config (icon, permissions, Auth0 client ID)
- `mobile/.env` — Runtime env (API_URL, Auth0 domain/client ID)
- `mobile/tsconfig.json` — TypeScript config (strict mode, path aliases)
- `mobile/jest.unit.config.js` — Jest config (unit tests)

**API:**
- `api/.env` — Runtime env (database, Auth0, S3, SMTP)
- `api/tsconfig.json` — TypeScript config (strict, decorators)
- `api/jest.config.js` — Jest config (E2E tests)
- `api/jest.unit.config.js` — Jest config (unit tests)

**Root:**
- `.eslintrc.json` — Linter config (both mobile and API)
- `.prettierrc.json` — Formatter config (double quotes, 2 spaces, no semicolons)

### Core Logic

**Mobile:**
- `mobile/src/hooks/useSurveySync.ts` — Central state orchestrator
- `mobile/src/storage/db.ts` — SQLite schema and initialization
- `mobile/src/api/client.ts` — HTTP client wrapper
- `mobile/src/app/ibp-scoring.ts` — IBP factor validation

**API:**
- `api/src/surveys/surveys.service.ts` — Survey CRUD and validation
- `api/src/surveys/surveys-sync.service.ts` — Batch sync processor
- `api/src/surveys/ibp-rules.service.ts` — Server-side IBP validation
- `api/src/auth/auth.guard.ts` — JWT validation
- `api/src/database/database.service.ts` — DB connection pool

### Testing

**Mobile:**
- `mobile/src/**/*.test.ts(x)` — Co-located unit tests
- `mobile/test/` — Test fixtures and utilities

**API:**
- `api/test/` — E2E test specs (`*.e2e-spec.ts`)
- `api/src/**/__mocks__/` — Jest mocks

## Naming Conventions

### Files

**React Components:**
- Pattern: `PascalCase.tsx` (e.g., `HomeScreen.tsx`, `AppButton.tsx`)
- Location: `mobile/src/screens/`, `mobile/src/ui/`, `mobile/src/components/`
- Export: Default export with same name as file

**Custom Hooks:**
- Pattern: `use[Name].ts` (e.g., `useSurveySync.ts`, `useEditingDraft.ts`)
- Location: `mobile/src/hooks/`
- Export: Named export function, no default

**Utilities / Services:**
- Pattern: `camelCase.ts` (e.g., `ibp-scoring.ts`, `formatters.ts`, `surveys.service.ts`)
- Location: `mobile/src/app/`, `api/src/*/`
- Export: Named exports

**Test Files:**
- Pattern: `*.test.ts(x)` (unit) or `*.e2e-spec.ts` (E2E)
- Location: Co-located with source or in `api/test/`
- Example: `mobile/src/app/ibp-scoring.test.ts`, `api/test/surveys.e2e-spec.ts`

**DTOs (API):**
- Pattern: `[Name].dto.ts` or `[Name]Body.ts`
- Location: `api/src/*/dtos/`
- Example: `survey-upsert.dto.ts`, `create-attachment.dto.ts`

**Configuration Files:**
- Pattern: `.eslintrc.json`, `.prettierrc.json`, `jest.config.js`, `tsconfig.json`
- Location: Root and package directories
- No variants per environment (env-specific logic in code via NODE_ENV)

### Directories

**Module Directories:**
- Pattern: `camelCase` (e.g., `surveys`, `users`, `auth`)
- Convention: One module per responsibility
- Contents: `*.service.ts`, `*.controller.ts`, `*.module.ts`, `dtos/`, `__mocks__/`

**Feature Directories:**
- Pattern: `camelCase` (e.g., `screens`, `hooks`, `components`, `storage`)
- Convention: Grouped by function (e.g., all screens together)

**Utility Directories:**
- Pattern: `camelCase` (e.g., `ui`, `app`, `api`, `common`)
- Convention: Shared code (no dependencies on other features)

## Where to Add New Code

### New Feature (Survey Fields)

- **Mobile UI:** Add screen component in `mobile/src/screens/` (e.g., `NewFeatureScreen.tsx`)
- **Mobile logic:** Add hook in `mobile/src/hooks/` (e.g., `useNewFeature.ts`)
- **Mobile storage:** Add schema and queries to `mobile/src/storage/surveys.ts`
- **Mobile domain:** Add validation to `mobile/src/app/` (e.g., new-feature-logic.ts)
- **API endpoint:** Add route to `api/src/surveys/surveys.controller.ts`
- **API service:** Extend `api/src/surveys/surveys.service.ts` with new CRUD/validation
- **API schema:** Add migration file `api/migrations/NNN-add-new-feature.sql`
- **Tests:** Add `mobile/src/screens/NewFeatureScreen.test.tsx` and `api/test/new-feature.e2e-spec.ts`

### New Component/Module

- **Reusable UI component:**
  - Mobile: `mobile/src/ui/NewComponent.tsx`
  - Tests: `mobile/src/ui/NewComponent.test.tsx`

- **Domain-specific component:**
  - Mobile: `mobile/src/components/NewComponent.tsx`
  - Tests: `mobile/src/components/NewComponent.test.tsx`

- **New API module (e.g., Analytics):**
  - Create `api/src/analytics/` directory
  - Add `analytics.module.ts`, `analytics.service.ts`, `analytics.controller.ts`
  - Add DTOs in `analytics/dtos/`
  - Add migration file for any schema changes
  - Import in `api/src/app.module.ts`

### Utilities

**Mobile:**
- Shared helpers: `mobile/src/app/` (e.g., `new-utils.ts`)
- Storage helpers: `mobile/src/storage/utils.ts`

**API:**
- Shared helpers: `api/src/common/` (e.g., `new.utils.ts`)
- Sync helpers: `api/src/surveys/` (e.g., `new-sync.utils.ts`)

## Special Directories

**`mobile/.expo/`**
- Purpose: Expo dev server cache and app state
- Generated: Yes (created by Expo CLI)
- Committed: No (in .gitignore)

**`mobile/ios/`, `mobile/android/`**
- Purpose: Native project directories (generated by `expo prebuild`)
- Generated: Yes (by Expo)
- Committed: No (in .gitignore as of recent change)
- How to customize: Use `mobile/app.json` and Expo plugins in `mobile/plugins/`

**`mobile/node_modules/`, `api/node_modules/`, `node_modules/`**
- Purpose: Dependencies
- Generated: Yes (by npm install)
- Committed: No (in .gitignore)

**`api/migrations/`**
- Purpose: Versioned SQL schema changes
- Generated: No (hand-written)
- Committed: Yes (part of source)
- Pattern: Ordered files (001-*.sql, 002-*.sql, etc.)

**`.planning/codebase/`**
- Purpose: Generated architecture documentation
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes (for reference)

**`.planning/phases/`**
- Purpose: Planning outputs and execution results
- Generated: Yes (by `/gsd-plan-phase` and `/gsd-execute-phase`)
- Committed: Depends on workflow (usually not, unless archiving)

---

*Structure analysis: 2026-09-22*
