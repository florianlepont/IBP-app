# Coding Conventions

**Analysis Date:** 2026-09-22

## Naming Patterns

**Files:**
- React components: `PascalCase.tsx` (e.g., `AppStatusChip.tsx`, `AuthGateScreen.tsx`)
- NestJS classes (services, controllers, guards): `camelCase.ts` or `PascalCase.service.ts` (e.g., `surveys.service.ts`, `auth.guard.ts`, `PatchMeDto.ts`)
- Utility/helper files: `camelCase.ts` with action suffixes like `.utils.ts`, `.helpers.ts` (e.g., `surveys-normalize.utils.ts`, `public-map.utils.ts`)
- Test files: co-located with source as `*.test.ts`, `*.test.tsx`, or in `test/` as `*.spec.ts` and `*.e2e-spec.ts`
- Mock files: placed in `test/__mocks__/` or `src/__mocks__/` directories

**Functions:**
- camelCase for all function declarations and exports (e.g., `computeIbpTotalsFromRetainedScores`, `normalizeSurveyStatusFilter`)
- Action verbs as prefixes: `get*`, `set*`, `compute*`, `normalize*`, `validate*`, `handle*`, `on*` (for event handlers)

**Variables:**
- camelCase for all local and module-level variables
- `_PrefixedName` for intentionally unused parameters or variables (suppresses ESLint `no-unused-vars` error)
- Constants: SCREAMING_SNAKE_CASE (e.g., `PROFILE_PICTURE_MAX_BYTES`, `MAX_RETRY_COUNT`)

**Types:**
- Type names: PascalCase, explicit `export type` for public exports (e.g., `export type AppStatusChipTone`, `export type LocalSurvey`)
- Type file locations: types defined inline (`*.types.ts`) or in dedicated type files within modules (e.g., `api/src/surveys/surveys.types.ts`, `mobile/src/app/types.ts`)
- DTO and Body types: Suffix with `Dto` (class) or `Body` (type) (e.g., `PatchMeDto`, `SurveyUpsertBody`, `SyncBatchBody`)
- Row types for database results: Suffix with `Row` (e.g., `UserMeRow`, `SurveyRow`, `AttachmentRow`)

**React Hooks:**
- camelCase with `use` prefix (e.g., `useSurveySync`, `useAuth0Session`, `useSurveySyncNetwork`)
- Exported from dedicated hook files in `mobile/src/hooks/`

**Components:**
- PascalCase for component names in both file and export
- Props type suffix with `Props` (e.g., `AppStatusChipProps`, `SurveyListProps`)
- Tone/variant types describe UI variations (e.g., `AppStatusChipTone = "neutral" | "success" | "warning"`)

## Code Style

**Formatting:**
- **Tool:** Prettier 3.8 (config: `.prettierrc.json`)
- **Line width:** 100 characters
- **Indent:** 2 spaces
- **Quotes:** Double quotes (`"`)
- **Semicolons:** None
- **Trailing commas:** Everywhere (arrays, objects, function parameters)
- **Spacing:** Run `npm run format` before committing

**Linting:**
- **Tool:** ESLint 8 + `@typescript-eslint` plugin (config: `.eslintrc.json` with workspace overrides in `mobile/.eslintrc.json`, `api/.eslintrc.json`)
- **Unused variables:** Error — prefix with `_` to suppress (e.g., `async (_event) => { ... }`)
- **Explicit `any`:** Warning — avoid; use proper types or `unknown`
- **Require imports:** Error — use ES module `import` syntax only
- **React rules:** `react/react-in-jsx-scope` off (Expo/RN doesn't require React import), `react/prop-types` off (TypeScript types used)
- **React Hooks:** ESLint plugin validates hook dependency arrays
- **Run:** `npm run lint` for check, `npm run lint:fix` for auto-fix

**Type Safety:**
- Strict mode enabled in all `tsconfig.json` files
- No implicit `any`, no unchecked indexing
- Explicit return types on public API functions (services, controllers)
- API DTOs use `class-validator` decorators for request validation

## Import Organization

**Order:**
1. External packages: NestJS, AWS SDK, React, React Native, third-party libraries (alphabetized)
2. Built-in Node modules: `fs/promises`, `path`, `crypto`, etc.
3. Relative imports from parent modules: `../auth/`, `../common/`
4. Relative imports from current module: `./surveys.types`, `./ibp-rules.service`

**Path Aliases:**
- No path aliases configured — relative imports only

**Example from `api/src/surveys/surveys.service.ts`:**
```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomUUID } from "crypto"
import { rm } from "fs/promises"
import { join } from "path"
import { AuthenticatedUser } from "../auth/auth.types"
import { DatabaseService } from "../database/database.service"
import { CadastreProviderService } from "./cadastre-provider.service"
import { IbpRulesService } from "./ibp-rules.service"
import { SurveyRow, SurveyUpsertBody } from "./surveys.types"
```

## Error Handling

**NestJS API (api/src/):**
- Throw specific NestJS HTTP exceptions from services and controllers:
  - `BadRequestException` — invalid input, validation failures
  - `NotFoundException` — resource not found
  - `ConflictException` — idempotency conflict, version mismatch
  - `UnprocessableEntityException` — business logic validation failure (e.g., incomplete IBP factors)
- Example from `surveys.service.ts`:
  ```typescript
  if (!isAllowedMimeType(mimeType)) {
    throw new BadRequestException(`Unsupported file type: ${mimeType}`)
  }
  ```

**Utilities and Non-HTTP Code:**
- Throw `Error` for utility functions or internal logic errors:
  ```typescript
  export function extensionFromMime(mimeType: string): string {
    if (!ext) throw new Error(`Unsupported file type: ${mimeType}`)
    return ext
  }
  ```

**Promise-Based Error Handling:**
- Use `.catch()` for non-critical failures (logging, cleanup):
  ```typescript
  const buffer = await readFile(storagePath).catch(() => null)
  await rm(oldPath, { force: true }).catch(() => {})
  ```

**Mobile (React Native):**
- Catch and report errors via `reportStatus()` callback in hooks
- Use `Alert.alert()` to inform user of errors
- Retry logic for sync operations with exponential backoff

## Comments

**When to Comment:**
- Prefer self-documenting code with clear names
- Comment complex algorithms or non-obvious business logic
- Document configuration constants and why they exist

**No JSDoc Requirement:**
- JSDoc/TSDoc is optional — TypeScript types provide most documentation
- Use comments for business logic intent, not type signatures

**Example Pattern:**
```typescript
const PROFILE_PICTURE_MAX_BYTES = 10 * 1024 * 1024  // 10 MB limit per platform policy

// Deduplicate parcel IDs: normalize to uppercase and remove duplicates
export function resolveDraftParcelIds(payload: unknown): string[] {
  // ... implementation
}
```

## Function Design

**Size:**
- Keep functions focused on a single responsibility
- Extract helper functions for complex logic

**Parameters:**
- Prefer named parameters via destructuring for objects with 3+ fields
- Use optional parameters with sensible defaults
- Example:
  ```typescript
  async function listForUser(
    user: AuthenticatedUser,
    input?: { status?: string; from?: string; to?: string }
  ): Promise<SurveyRow[]> {
    // ...
  }
  ```

**Return Values:**
- Use explicit return types (no implicit `any`)
- Return `Promise<T>` for async functions
- Use discriminated unions for success/error returns in validation:
  ```typescript
  type ValidationResult = 
    | { ok: true; scores: Record<string, number> }
    | { ok: false; errors: string[] }
  ```

## Module Design

**Exports:**
- Export named exports; default exports discouraged (except single-class files)
- Group related utilities in a single file with named exports
- Example from `surveys-normalize.utils.ts`:
  ```typescript
  export function normalizeSurveyStatusFilter(input?: string): string | null { }
  export function normalizeParcelId(input?: string): string { }
  ```

**NestJS Modules:**
- Services inherit `@Injectable()` and are injected via constructor
- Controllers route HTTP requests and delegate to services
- Guards (`AuthGuard`) validate requests before reaching controllers

**Barrel Files:**
- Avoid circular dependencies by limiting barrel exports to `index.ts` at module boundaries

## Database

**Raw SQL:**
- All database access goes through `DatabaseService` in `api/src/database/database.service.ts`
- Use parameterized queries: `$1`, `$2` etc. (via `pg` library)
- Example:
  ```typescript
  const result = await this.db.query<SurveyRow>(
    `SELECT * FROM surveys WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  )
  ```

---

*Convention analysis: 2026-09-22*
