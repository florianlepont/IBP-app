# Testing Patterns

**Analysis Date:** 2026-09-22

## Test Framework

**Runner:**
- Framework: Jest 29 with ts-jest preset
- TypeScript support: ts-jest with `tsconfig.jest.json` (mobile only)
- Test environment: node (both API and mobile)

**Configuration Files:**
- `mobile/jest.unit.config.js` — unit tests only, co-located as `*.test.ts(x)`
- `api/jest.unit.config.js` — API unit tests, `*.spec.ts` excluding `*.e2e-spec.ts`
- `api/jest.config.js` — E2E tests only, `*.e2e-spec.ts`

**Test HTTP Client (API):**
- Supertest for E2E HTTP assertions

**Run Commands:**
```bash
npm run test:unit              # Run all unit tests (mobile + API)
npm run test:e2e               # API E2E tests only (requires running PostgreSQL)
npm run test                   # Unit + E2E
npm run test:coverage:api      # Coverage for API (unit + e2e)
npm run test:coverage:mobile   # Coverage for mobile unit tests
npm run lint && npm run typecheck && npm run test:unit  # Pre-commit checks
```

## Test File Organization

**Mobile Unit Tests:**
- Location: co-located with source as `src/**/*.test.ts` or `src/**/*.test.tsx`
- Examples: `mobile/src/app/ibp-scoring.test.ts`, `mobile/src/storage.test.ts`, `mobile/src/screens/AuthGateScreen.test.ts`
- Naming: `*.test.ts` or `*.test.tsx`

**API Unit Tests:**
- Location: `api/test/**/*.spec.ts`
- Examples: `api/test/ibp-rules.spec.ts`, `api/test/auth.guard.spec.ts`, `api/test/users.service.spec.ts`
- Naming: `*.spec.ts`

**API E2E Tests:**
- Location: `api/test/**/*.e2e-spec.ts`
- Examples: `api/test/auth-profile.e2e-spec.ts`, `api/test/surveys-idempotency.e2e-spec.ts`
- Naming: `*.e2e-spec.ts`
- Require: running PostgreSQL (via Docker Compose)
- Timeout: 15 seconds per test (configurable via `jest.config.js`)

**Test Mocks:**
- Locations: `mobile/test/__mocks__/` and `api/test/__mocks__/`
- Examples: `expo-sqlite.mock.ts`, `react-native-svg.mock.ts`, `vector-icons.mock.ts`, `jwks-rsa.js`
- Registered in `jest.config.js` via `moduleNameMapper`

## Test Structure

**Suite Organization (Describe Block):**
```typescript
describe("ibp-scoring", () => {
  test("computes retained scores from raw factors", () => {
    // arrange
    const input = { A: { native_genus_count: 5 }, ... }
    
    // act
    const result = computeRetainedScoresFromRawFactors(input, "ACA", "collineen")
    
    // assert
    expect(result.A?.score).toBe(5)
  })
})
```

**API Unit Tests:**
```typescript
describe("IbpRulesService (unit)", () => {
  const service = new IbpRulesService()

  it("validates factor scoring rules", () => {
    const result = service.validateDraft(
      { A: { native_genus_count: 2 } },
      "ACA",
      "collineen",
    )
    expect(result.ok).toBe(true)
    expect(result.factor_scores?.A).toBe(1)
  })
})
```

**API E2E Tests (NestJS Integration):**
```typescript
describe("Auth + profile (e2e)", () => {
  let app: INestApplication
  let db: DatabaseService

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],  // Full NestJS module tree
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix("v1")
    await app.init()
    db = app.get(DatabaseService)
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it("returns profile fields via GET /me", async () => {
    const email = `e2e-test-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)
    
    const accessToken = login.body.access_token
    const me = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    
    expect(me.body.email).toBe(email)
  })
})
```

**Patterns:**
- `describe()` groups related tests by feature/module
- `test()` or `it()` for individual test cases (synonymous in Jest)
- `beforeAll()` / `afterAll()` for setup/teardown shared across all tests in a suite
- `beforeEach()` / `afterEach()` for setup/teardown per test (rarely used, prefer `beforeAll`)
- Arrange-Act-Assert pattern: set up test data, invoke code, assert results

## Mocking

**Framework:** Jest built-in mocking (`jest.fn()`, `jest.spyOn()`)

**Module Mocks:**
- Registered in `jest.config.js` `moduleNameMapper` for Node/native modules:
  ```javascript
  moduleNameMapper: {
    '^@expo/vector-icons$': '<rootDir>/test/vector-icons.mock.ts',
    '^expo-sqlite$': '<rootDir>/test/expo-sqlite.mock.ts',
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/test/image.mock.ts',
  }
  ```

**Mock Pattern (Async Library):**
```typescript
// mobile/test/expo-sqlite.mock.ts
const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  closeAsync: jest.fn().mockResolvedValue(undefined),
}

export const openDatabaseAsync = jest.fn().mockResolvedValue(mockDb)
export type SQLiteDatabase = typeof mockDb
```

**Mock Pattern (NestJS E2E):**
```javascript
// api/test/__mocks__/jwks-rsa.js
module.exports = {
  JwksClient: jest.fn(() => ({
    getSigningKey: jest.fn().mockResolvedValue({ getPublicKey: () => "..." }),
  })),
}
```

**What to Mock:**
- External services (Auth0, S3, MinIO) — use test tokens or mock SDK
- Database interactions (use real test database, not mocks)
- File system operations for unit tests (mock `fs/promises`)
- Third-party libraries registered in `moduleNameMapper`

**What NOT to Mock:**
- Database queries in E2E tests (use real PostgreSQL test instance)
- Business logic core functions (test actual behavior)
- Core NestJS modules in E2E tests (let full module tree run)
- Validation logic (test actual validators)

## Fixtures and Factories

**Test Data in Tests:**
- Inline fixture objects within test cases
- No separate fixture files; keep test data close to test logic

**Example from `ibp-rules.spec.ts`:**
```typescript
const byFactorCases: Array<{
  name: string
  factor: "A" | "B" | ... | "J"
  raw: unknown
  expectedScore: 0 | 1 | 2 | 5
  region?: "ACA" | "M"
}> = [
  {
    name: "A (collineen): native_genus_count=2 -> 1",
    factor: "A",
    raw: { native_genus_count: 2 },
    expectedScore: 1,
  },
  // ... more cases
]

it.each(byFactorCases)("$name", ({ factor, raw, expectedScore }) => {
  const result = service.validateDraft({ [factor]: raw }, "ACA", "collineen")
  expect(result.factor_scores?.[factor]).toBe(expectedScore)
})
```

**Timestamps in E2E Tests:**
```typescript
const email = `e2e-profile-${Date.now()}@ibp.local`
const surveyId = `e2e-survey-${Date.now()}`
```

## Coverage

**Requirements:** No enforced minimum — coverage reports generated for CI visibility

**API:**
- Unit coverage: `api/coverage/unit/`
- E2E coverage: `api/coverage/e2e/`
- Combined coverage: `npm run test:coverage:api` merges both

**Mobile:**
- Coverage: `mobile/coverage/unit/`
- Command: `npm run test:coverage:mobile`

**Reports:**
- Formats: text, text-summary, json-summary (machine-readable), lcov (IDE integration)
- View in browser: `open coverage/unit/lcov-report/index.html` (API)

**Exclusions:**
```javascript
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',           // Type definitions
  '!src/**/*.test.ts',        // Test files themselves
  '!src/**/*.test.tsx',
]
```

## Test Types

**Unit Tests:**
- Scope: Single function or class method in isolation
- Setup: Direct instantiation (e.g., `new IbpRulesService()`)
- Examples: `ibp-scoring.test.ts`, `formatters.test.ts`, `auth0-config.test.ts`
- Mocking: Mock external dependencies, use real business logic

**Integration Tests:**
- Scope: Multiple units working together (services, repositories)
- Setup: Instantiate dependents, inject real dependencies
- Examples: API sync tests, service composition
- Mocking: Minimal — test real integration

**E2E Tests:**
- Scope: Full HTTP request → response cycle via Supertest
- Setup: Full NestJS module tree via `Test.createTestingModule(AppModule)`
- Examples: `auth-profile.e2e-spec.ts`, `surveys-idempotency.e2e-spec.ts`
- Mocking: None — test real API, real database, real Auth0 interaction (or test tokens)
- Database: Real PostgreSQL test instance (via Docker Compose setup)

## Common Patterns

**Async Testing:**
```typescript
// With async/await
it("awaits async operations", async () => {
  const result = await computeAsync(input)
  expect(result).toBe(expected)
})

// With .then()
it("handles promises", () => {
  return computeAsync(input).then((result) => {
    expect(result).toBe(expected)
  })
})
```

**Error Testing:**
```typescript
it("throws on invalid input", () => {
  expect(() => {
    extensionFromMime("invalid/type")
  }).toThrow("Unsupported file type")
})

// For async functions
it("rejects invalid validation", async () => {
  const result = service.validateDraft({ I: 1 }, "ACA", "collineen")
  expect(result.ok).toBe(false)
  expect(result.errors.join(" | ")).toContain("factor I must resolve to one of [0,2,5]")
})
```

**HTTP Assertion (Supertest E2E):**
```typescript
it("rejects requests without auth token", async () => {
  await request(app.getHttpServer())
    .get("/v1/surveys")
    .expect(401)
})

it("returns 404 for missing resource", async () => {
  const response = await request(app.getHttpServer())
    .get("/v1/surveys/nonexistent-id")
    .set("Authorization", `Bearer ${token}`)
    .expect(404)
  
  expect(response.body.message).toContain("not found")
})
```

**Database Query in Tests:**
```typescript
it("creates user record", async () => {
  const email = `test-${Date.now()}@ibp.local`
  
  // Make API call
  await request(app.getHttpServer())
    .post("/v1/debug/test-token")
    .send({ email })
    .expect(201)
  
  // Verify database state
  const user = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  )
  expect(user.rows[0]).toBeDefined()
})
```

**Parametrized Tests with `it.each()`:**
```typescript
it.each([
  ["A", { native_genus_count: 2 }, 1],
  ["A", { native_genus_count: 5 }, 5],
  ["B", { strata_count: 5, covered_autochthonous_percent: 40 }, 2],
])("validates %s factor", (factor, raw, expectedScore) => {
  const result = service.validateDraft({ [factor]: raw }, "ACA", "collineen")
  expect(result.factor_scores?.[factor]).toBe(expectedScore)
})
```

## Before Committing

Run pre-commit checks locally:
```bash
npm run lint              # ESLint across mobile + api
npm run typecheck         # TypeScript build check
npm run test:unit         # All unit tests
npm run format:check      # Prettier validation
```

These run in CI (`ci.yml`) and must pass before merge.

---

*Testing analysis: 2026-09-22*
