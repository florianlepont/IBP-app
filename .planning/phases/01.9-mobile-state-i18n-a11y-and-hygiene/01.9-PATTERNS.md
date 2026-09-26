# Phase 01.9: Mobile state architecture, i18n, accessibility and hygiene - Pattern Map

**Mapped:** 2026-09-26
**Files analyzed:** 74 new or modified files, counting tests, CI, infra, docs and deletions: 27 new, 38 modified, 9 deleted.
**Analogs found:** 66 / 74. Eight files have no in-repo analog: `React.memo` rows, `FlatList`, React contexts in production code, supercluster, the i18n catalogue shape, the AST scanners, the native CI jobs and the ESLint JSX rules. See "No Analog Found".

> Read "Conflicts and gaps" first. C-1 and C-2 settle RESEARCH assumption A6 and widen the SMTP removal by one variable. C-3 shows that D-08's "hide the bar on parcel selection in both trees" has no native implementation yet. C-4 lists the ten spy-based hook tests.

---

## Conflicts and gaps (planner must resolve)

### C-1: A6 is resolved. Leftover `SMTP_*` keys on the VPS are harmless.
- `validateEnv` calls `plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true })`, then `validateSync(env, { skipMissingProperties: false })` (`api/src/config/env.schema.ts:87-88`).
- It passes no `whitelist` and no `forbidNonWhitelisted`, so unknown keys are ignored.
- Deleting the `SMTP_*` fields therefore cannot stop a production start.
- `check-env.sh` already has the mechanism D-09 asks for:
  - The `DEAD_VARIABLES` array (`infra/vps/check-env.sh:28-36`) is printed as `INFO : X : ligne inutile, peut être supprimée.` (`:185-189`).
  - Append the SMTP names to that array under a `# Variables supprimées en phase 01.9 (D-09)` comment.
  - Do not add a new message format.

### C-2: `EMAIL_CHANGE_CONFIRM_URL_TEMPLATE` goes too
- It sits inside the `smtp` block: `config.types.ts:68-77` and `app-config.ts:120-130`.
- Its only reader is `EmailService` (`api/src/users/email.service.ts:27`).
- When `EmailService` goes, the variable becomes dead. Remove it in the same places as `SMTP_*`:
  - `env.schema.ts:73`;
  - `api/.env.example:50`, `api/.env.production.example:53`, `infra/.env.example:40`, `infra/vps/env.example:46`;
  - `README.md:90`;
  - the `DEAD_VARIABLES` list.
- Drop the whole `smtp:` key from `AppConfig`.

### C-3: the native tab tree has no "hide the tab bar" today (D-08)
- The JS tree hides the bar on parcel selection with a per-screen option (`AuthenticatedAppNavigation.tsx:889-899`):
  ```tsx
  options={({ route }) => ({
    ...
    tabBarStyle:
      getFocusedRouteNameFromRoute(route) === "surveyParcels"
        ? { display: "none" }
        : undefined,
  })}
  ```
- The native tree's `surveys` screen has no options at all (`:824-826`).
- `@bottom-tabs/react-navigation` 1.4.0 has **no per-screen** hide option. `tabBarItemHidden` only hides a tab *item* (`types.d.ts:48`).
- The navigator does accept `tabBarHidden`: `NativeBottomTabNavigationConfig` = `Partial<Omit<ComponentProps<typeof TabView>, ...>>` does not omit it (`types.d.ts:97`; `react-native-bottom-tabs/lib/typescript/src/TabView.d.ts:209`).
- Two ways to get identical behaviour:
  - **(a)** Drive `<NativeTab.Navigator tabBarHidden={focusedLeaf === "surveyParcels"}>` from one shared helper, `shouldHideTabBar(routeName)`. The JS tree uses the same helper in `tabBarStyle`. Track `focusedLeaf` with `NavigationContainer onStateChange`.
  - **(b)** Present `surveyParcels` as `presentation: "fullScreenModal"` in the surveys stack in both trees. The modal covers either bar.
- Either way, put the rule in one exported function and unit-test it. D-08 requires identical behaviour.

### C-4: ten hook tests spy on React and break once hooks gain `useMemo` or `useContext` (Pitfall 1)
- `jest.spyOn(React, …)` appears in `hooks/useSurveySync.test.ts` (`:183-190`, `:272`), `useEditingDraft.test.ts`, `useNearbyParcels.test.ts`, `useParcelStatuses.test.ts`, `usePublicMapExplorer.test.ts`, `useSurveyForm.test.ts` and `useSurveyList.test.ts`.
- It also appears in `survey-sync/useSurveySyncNetwork.test.ts`, `useSurveySyncProfile.test.ts` and `useSurveySyncSurveyOperations.test.ts`.
- D-01 says to rewrite `useSurveySync.test.ts` first. Rewrite each of the other nine in the same plan that changes its hook.
- `usePublicMapExplorer.test.ts` changes with MAP. The three `survey-sync/*` tests change with the I18N status codes. `useSurveyList.test.ts` changes with LIST.

### C-5: `DraftCard` has three unit bugs, not two
`mobile/src/components/cards/DraftCard.tsx`:
- `:19`: `if (survey.completion_rate >= 1) return brandColors.moss` is always true once any field is filled.
- `:35`: `Math.round(survey.completion_rate * 10)`.
- `:36`: `` `${Math.round(survey.completion_rate * 100)}%` ``.

All three assume 0–1. The fixes:
- `>= 100`;
- `Math.round(completion_rate / 10)`;
- `` `${completion_rate}%` ``.

### C-6: removing the `search` tab touches four records typed by `keyof RootTabParamList`
Remove the key from:
- `RootTabParamList` (`:67-73`, `search:` at `:70`);
- `IOS_TAB_ICONS` (`:170-191`, `search` at `:179-182`);
- `ANDROID_TAB_ICONS` (`:193-199`);
- `TAB_TITLES` (`:201-207`);
- `JS_TAB_ICONS` (`:209-215`).

Then:
- Delete the `NativeTab.Screen name="search"` block (`:827-835`).
- `SurveysTabNavigator` collapses:
  - `searchEntry`, `hasDedicatedSearchTab` and `nativeSearchEnabled` (`:319-320`) become `useNativeNav && Platform.OS === "ios"`;
  - `visibleSurveys` no longer branches (`:386-389`);
  - `showInlineSearch` stays true on Android and on the JS fallback (`:412-413`);
  - `placement` becomes `"integratedButton"` or `"automatic"` for the Mes Relevés header (`:368`).
- Keep the `searchBarRef` sync effect (`:323-331`).

### C-7: where the Release fallback is decided (D-08)
- The decision is `isNativeBottomTabViewAvailable()` (`:126-135`). It returns false when any of these holds:
  - `EXPO_PUBLIC_ENABLE_NATIVE_TABS === "false"`;
  - `Constants.executionEnvironment === ExecutionEnvironment.StoreClient`;
  - `Constants.appOwnership === "expo"`.
- The only log is a `console.warn` inside `AppTabs` (`:939-945`), and it does not say which condition fired.
- Make the function return `{ native: boolean; reason: "platform" | "env-opt-out" | "expo-go" | "ok" }` and log the reason once.
- Unit-test every branch by mocking `expo-constants` and `Platform`. `dev-tools.ts:8` is the pattern for an injectable `isDev` parameter.
- Do not rely on `__DEV__` here. The check is about Release.

### C-8: new top-level folders fall into the 100% `global` coverage bucket (Pitfall 2)
- `mobile/jest.unit.config.js:36-45` lists per-directory thresholds, and anything else is `global: { statements: 100, lines: 100 }`.
- `src/state/`, `src/i18n/`, `src/navigation/` and `src/__checks__/` each need their own row at the measured floor. The same goes for any `src/screens/*/` sub-folder, although `./src/screens/` already covers sub-directories.
- Regenerate the numbers with `node scripts/coverage-by-directory.js mobile`, as the comment at `:33-35` says.

### C-9: the supercluster mapper path depends on where npm hoists it
- The mobile workspace keeps some packages in `mobile/node_modules`. `@bottom-tabs`, `react-native-maps` and `expo-location` live there, not at the root.
- After `npm install --workspace mobile supercluster@9.1.0`, run `ls node_modules/supercluster mobile/node_modules/supercluster`.
- Use `<rootDir>/node_modules/...` or `<rootDir>/../node_modules/...` to match. Do not copy RESEARCH's path blind.

### C-10: the list row is not the only `Pressable` whose label leaks through a template
- `SurveyListScreen.tsx:1042` builds `` `Supprimer le relevé ${survey.site_name}` ``, and `:1065` builds `` `${survey.site_name}, ${uiStatusLabel}, mis à jour …` ``. Both are French already.
- Move them to `fr.a11y.*` functions. Do not delete them: they are the model for the D-07 labels.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `mobile/src/state/AppStateProvider.tsx` (new: calls the assembler once, nests 5 providers) | provider | event-driven | `mobile/App.tsx:48-127` (today's single assembly site) | exact (extraction) |
| `mobile/src/state/{session,status,sync,surveys,survey-form}-context.ts` (new) | provider/hook | event-driven | `hooks/render-hook-wrapper.test.tsx:22-30` (createContext + useContext + Provider); `app/useAppBottomTabBarHeight.ts:1-25` (production `createContext`/`useContext`) | role-match |
| `mobile/src/state/useLatestCallback.ts` (new) | hook/utility | — | `useSurveySync.ts:58-63` (ref-held object); `usePublicMapExplorer.ts:23` + `PublicMapScreen.tsx:135-137` (`onLoadParcelsRef.current = onLoadParcels`) | role-match |
| `mobile/src/hooks/useSurveySync.ts` (assembler; stable debug resets; status codes) | hook | event-driven | self `:74-91` (`reportStatus`/`setStatus` in `useCallback`), `:296-331` (`runDebugReset`) | exact |
| `mobile/App.tsx` (mount provider, drop the prop funnel) | component/root | — | self | exact |
| `mobile/src/hooks/useSurveySync.test.ts` + 9 spy-based hook tests (renderHook rewrite) | test | — | `hooks/useSurveySync.logout-purge.test.ts:1-140`; `render-hook-smoke.test.ts:1-40` | exact |
| `mobile/src/state/render-counts.test.tsx` (new, D-02) | test (harness) | event-driven | `screens/AuthGateScreen.test.ts:1-80` (react-test-renderer + mocked `react-native`) + `useSurveySync.logout-purge.test.ts:79-101` (`useAuth0Session` mock) | role-match |
| `mobile/src/storage/db.ts` (migration 2, `SCHEMA_VERSION = 2`) | model/migration | CRUD | self `:66-135` (`migration1`, `ensureColumn`, `MIGRATIONS`) | exact |
| `mobile/src/storage/surveys.ts` (write `payload_completion` at 2 sites; `listLocalSurveys` without `payload_json`) | service/storage | CRUD | self `:43-62`, `:386-407`, `:428-447` | exact |
| `mobile/src/storage/sync.ts` (write `payload_completion` at 2 sites) | service/storage | CRUD | self `:293-306`, `:315-330` | exact |
| `mobile/src/storage/utils.ts` (`computePayloadCompletion` split from `computeCompletionRate`) | utility | transform | self `:66-97` | exact |
| `mobile/src/storage/db.migration.sqlite.test.ts` (v1→v2 case) + new `surveys.completion.sqlite.test.ts` | test | CRUD | self `:1-70` (node:sqlite own-handle recipe) | exact |
| `mobile/src/components/cards/DraftCard.tsx` (+ new `DraftCard.test.tsx`) | component | — | self `:17-36` | exact |
| `mobile/src/screens/survey-list/SurveyRow.tsx` (new, `memo`) + `SurveyListView.tsx` (`Animated.FlatList`) | component | — | `SurveyListScreen.tsx:1019-1161` (row body to move) | partial (no memo/FlatList in repo) |
| `mobile/src/screens/{survey-list,survey-detail,survey-form,public-map,auth-gate,account,home}/*` (splits < 400 lines, `styles.ts` each) | component | — | `screens/SurveyDetailScreen.styles.ts:1-12` (per-screen `StyleSheet.create` file), `SurveyFormScreen.components.tsx` (sub-component file) | exact |
| `mobile/src/app/styles.ts` (1 536 lines, 267 keys, 6 used: **delete**, move the 6 keys) | config/style | — | importers: `AuthenticatedAppNavigation.tsx:24`, `App.tsx:8` | exact |
| `mobile/src/__checks__/structure.test.ts` (new: ≤ 400 lines, 0 unused style keys, literal scanner) + optional `scripts/unused-style-keys.mjs` | test/utility | batch | `scripts/coverage-by-directory.js:1-40` (fs walker, pure fn); `api/test/check-env-parity.spec.ts:2,16` (spec reading repo files) | role-match |
| `mobile/src/navigation/{types.ts,tabs.tsx,stacks/*.tsx}` (split of `AuthenticatedAppNavigation.tsx`, 961 lines) | route/navigation | — | self `:48-73` (param lists), `:252-288` (listeners), `:793-934` (two trees) | exact |
| Global `ReactNavigation.RootParamList` declaration | type | — | `AuthenticatedAppNavigation.tsx:67-73` (`RootTabParamList`) + `:606-607` (the one cast to remove) | exact |
| Tab changes: search merged into Mes Relevés, tab-bar hiding, fallback detection | route/navigation | — | self `:126-135`, `:319-331`, `:355-383`, `:889-899`, `:936-953` | exact |
| `api/src/surveys/dtos/public-map-items-query.dto.ts` (`bbox`) | DTO | request-response | `dtos/public-parcel-statuses-query.dto.ts:1-8` | exact |
| `api/src/surveys/public-map.service.ts` (`getPublicMapItems` + bbox) | service | request-response | self `:89-99` (`parseBbox` use in `getPublicParcelStatuses`) | exact |
| `api/src/surveys/public-map.queries.ts` (`buildPublicMapItemsQuery` + bbox filter) | query builder | CRUD (read) | self `:45-97` + `PUBLIC_PARCEL_STATUSES_BBOX_SQL` `:136-139` | exact |
| `api/test/public-map-bbox.e2e-spec.ts` (new) | test (E2E + EXPLAIN) | request-response | `api/test/public-routes-explain.e2e-spec.ts:130-264`; `list-pagination.e2e-spec.ts:1-15`; idempotency `:643-656` (map-items assertions) | exact |
| `mobile/src/api/ibp-api.ts` (`fetchPublicMapItems` + bbox) | client | request-response | self `:174-190` + `fetchPublicParcelStatuses` `:192-199` | exact |
| `mobile/src/hooks/usePublicMapExplorer.ts` (bbox, stale guard, key dedupe) | hook | request-response | self `:43-76` (`requestRef` stale guard) | exact |
| `mobile/src/screens/public-map/*` (debounce, no auto-refit, clusters, memo markers) + `useDebouncedValue.ts` + `useMapClusters.ts` | component/hook | event-driven | `PublicMapScreen.tsx:130-155` (400 ms timer + key dedupe), `:199-237` (MapView/Marker) | role-match |
| `mobile/jest.unit.config.js` (`^supercluster$` mapper, thresholds) | config | — | self `:19-29` | exact |
| `mobile/src/i18n/{fr.ts,index.ts,status.ts}` (new) | config/utility | transform | `app/brand-tokens.ts:1-23` (`as const` object); `app/formatters.ts:33-53` (French message table); `hooks/operation-status.ts:1-9` (typed unions) | role-match |
| All screens/components/hooks with literals (552 in 36 files) | component | — | `AuthenticatedAppNavigation.tsx:201-207` (`TAB_TITLES`, already French) | role-match |
| `mobile/app.json` (French permission strings) | config | — | self `:13-25` | exact |
| `mobile/.eslintrc.json` (`react/jsx-no-literals`, `no-restricted-syntax` overrides) | config | — | self `:21-29` (`overrides`); `api/.eslintrc.json:9-16` (`no-restricted-properties` with message) | exact |
| Root `App.tsx`, root `tsconfig.json`, root `dependencies` (delete) | config | — | `.dockerignore:13` (`App.tsx` line to drop); `package.json` `dependencies`/`overrides` | exact |
| `api/package.json` (drop `bcryptjs`, `@nestjs/schedule`, `nodemailer`, `@types/nodemailer`); `mobile/package.json` (`@expo/ngrok` → devDeps) | config | — | `api/package.json:27,48,50,58`; `mobile/package.json:23` | exact |
| `api/src/users/email.service.ts` (delete) | service | — | — | n/a |
| `api/src/config/{env.schema.ts,config.types.ts,app-config.ts}` (drop SMTP) | config | — | self `env.schema.ts:65-73`, `config.types.ts:68-77`, `app-config.ts:120-130` | exact |
| `api/test/env.schema.spec.ts` (drop SMTP cases) | test | — | self `:74-75`, `:134`, `:141-146` | exact |
| `infra/vps/check-env.sh` + `api/test/check-env-parity.spec.ts` (SMTP obsolete INFO) | script/test | batch | `check-env.sh:28-36,185-189`; parity spec `:226-233` | exact |
| Env examples (`api/.env.example`, `api/.env.production.example`, `infra/.env.example`, `infra/vps/env.example`) | config | — | self (SMTP blocks listed in C-2) | exact |
| `api/Dockerfile` (stale comment `:5-6`, `:22-23`) | config | — | self | exact |
| `.github/workflows/ci.yml` (`native-android`, `native-ios`, `native` filter, `ci-ok`; drop `SMTP_ENABLED` at `:212,:300,:497`) | config/CI | batch | `ci.yml:17-52` (`changes`), `:359-404` (`mobile-build`), `:568-614` (`ci-ok`) | role-match |
| `scripts/owner-check-simulation.mjs` (bbox probe) | script | request-response | self `:934-939` | exact |

---

## Pattern Assignments

### `mobile/src/state/*` (new): contexts filled by one assembler

**Analog, the assembly site today:** `mobile/App.tsx:48-127`. Every hook is called once, and `setStatus` is threaded into four sub-hooks:
```tsx
const surveyForm = useSurveyForm()
const surveyList = useSurveyList()
...
const surveySync = useSurveySync({
  apiUrl,
  surveys: surveyList.surveys,
  selectedSurveyId: surveyList.selectedSurveyId,
  ...
  onCloseSurveyDetail: closeSurveyDetailSelection,
  onStopEditing: () => {            // inline closure: new identity every render
    setEditingSurveyId(null)
    setFormMode("create")
  },
})
const setStatus = surveySync.setStatus
...
const publicMapExplorer = usePublicMapExplorer({ apiUrl, onStatusChange: setStatus })
const editing = useEditingDraft({ ..., surveyForm, surveyList, onStatusChange: setStatus, ... })
const draftPatcher = useSurveyDraftPatcher({ surveyList, onStatusChange: setStatus })
const gpsCapture = useGpsCapture({ surveyForm, onStatusChange: setStatus, onAlert: (title, message) => Alert.alert(title, message) })
```
Move this block, together with `surveyStats` (`:89-100`), `ownSurveyIds` (`:53-56`), `handleOpenSurvey` (`:143-147`) and the bootstrap effect (`:129-141`), into `AppStateProvider`. The following stay in `App.tsx`, reading `useSession()`:
- the gesture and safe-area shell;
- the three overlays (`:196-238`);
- `overlayStyles` (`:245-250`).

**Analog, context + provider + consumer hook:** `mobile/src/hooks/render-hook-wrapper.test.tsx:22-30`:
```tsx
const LabelContext = React.createContext<string>("default")
function useLabel(): string {
  return useContext(LabelContext)
}
function wrapper({ children }: { children: React.ReactNode }) {
  return <LabelContext.Provider value="field">{children}</LabelContext.Provider>
}
```
The production-code analog for `createContext`/`useContext` is `mobile/src/app/useAppBottomTabBarHeight.ts:1-4,19-24`. Each `use*` hook should throw when it is called outside the provider (`createContext<T | null>(null)`), so a missing provider is not a silent default.

**Analog, stable identity through a ref:** `useSurveySync.ts:58-63` (a ref-held singleton) and `PublicMapScreen.tsx:135-137` (a latest-callback ref):
```ts
const syncActivityRef = useRef<SyncActivity | null>(null)
if (!syncActivityRef.current) {
  syncActivityRef.current = createSyncActivity()
}
```
```ts
useEffect(() => {
  onLoadParcelsRef.current = onLoadParcels
}, [onLoadParcels])
```
`useLatestCallback` = that ref + `useCallback(..., [])`. Use `useEffect`, not `useLayoutEffect`. The `react-native` mocks in tests (`render-hook-smoke.test.ts:28-31`) only provide what they list, and React's own hooks come from `react`. Either works, but `useEffect` keeps it in line with the existing ref pattern.

**Invariants to keep (01.5):**
- one `createSyncActivity()` per app (`useSurveySync.ts:58-63`);
- `purgeWhileSyncSuspended` in `resetLocalSurveyState` (`:93-108`);
- `sync-owner-gate.test.ts` and `useSurveySync.logout-purge.test.ts` must stay green **unchanged**.

### `mobile/src/hooks/useSurveySync.ts` (assembler, stable handlers, status codes)

**Status entry point** (`:74-91`). This becomes `reportStatus({ code, params?, detail? })` (RESEARCH Pattern 8):
```ts
const reportStatus = useCallback(
  (
    scope: "session" | "auth" | "profile" | "sync" | "survey" | "attachment" | "debug",
    state: "idle" | "running" | "success" | "error",
    message: string,
  ): void => {
    setStatusText(message)
    setOperationStatus((current) => updateOperationStatus(current, scope, state, message))
  },
  [],
)

const setStatus = useCallback(
  (message: string): void => {
    reportStatus("session", "idle", message)
  },
  [reportStatus],
)
```
`operationStatus` (`:52`, returned at `:529`) has no consumer outside the hook. Drop it or keep it private (RESEARCH Pattern 1).

**Non-stable handlers to fix** (`:334-361`). Both are plain `async` functions: no `useCallback`, and English text:
```ts
const handleDebugResetIbpData = async (): Promise<void> => {
  runDebugReset({
    title: "Debug reset IBP data",
    message:
      "This will delete all IBP surveys/events/attachments on server and clear local IBP data.",
    ...
```
Wrap them in `useCallback([runDebugReset, withAuthRetry, apiUrl, resetLocalSurveyState, clearSession])`, or in `useLatestCallback`. `runDebugReset` (`:296-331`) is already a `useCallback` and is the model. Its `Alert.alert(title, message, [{ text: "Cancel" }, { text: "Reset" }])` strings go to `fr.debug.*`.

**Return object** (`:521-570`): 50 keys in one literal. It gets split into five `useMemo` slices (RESEARCH Pattern 1 code). Keep `accessToken` out of the widely read session slice: it has a narrow `useAccessToken()` for `AccountScreen`'s avatar.

### `mobile/src/hooks/useSurveySync.test.ts` and the spy-based hook tests (renderHook rewrite)

**Analog:** `mobile/src/hooks/useSurveySync.logout-purge.test.ts`. It already renders the real `useSurveySync`. Copy these parts:
- the `jest.mock("react-native", () => ({ Alert: { alert: … } }))` factory **before** the RNTL import (`:11-14`);
- storage, API, auth0 and network mocks (`:16-61`);
- the sub-hooks stubbed as plain objects (`:63-76`);
- a **stable** `mockSession` object, because inline objects re-run effects (`:78-101`);
- this import and cleanup (`:103-108`):
  ```ts
  import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"
  import { useSurveySync } from "./useSurveySync"

  afterEach(async () => {
    await cleanup()
  })
  ```
- frozen `PARAMS` with `noopAsync` and `noop` (`:110-122`).

The rules are in the header of `render-hook-smoke.test.ts:1-26`:
- `renderHook` and `act` are **async**;
- use the `/pure` entry;
- call `cleanup()` by hand.

Replace the spies at `useSurveySync.test.ts:183-190` and `:272`.

### `mobile/src/state/render-counts.test.tsx` (new, D-02)

**Analog, full-tree renderer with a mocked `react-native`:** `mobile/src/screens/AuthGateScreen.test.ts:1-80`.
- Suppress the known `react-test-renderer` and act warnings (`:4-22`):
  ```ts
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("react-test-renderer is deprecated")) return
      if (message.includes("The current testing environment is not configured to support act")) return
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
  })
  ```
- Use host components built with `mockComponent(name)` (`:24-29`) and an `Animated` stub (`:31-60`). Add:
  - `FlatList` rendering `data.slice(0, initialNumToRender ?? 10).map(renderItem)`;
  - `Animated.FlatList` as the same;
  - `StyleSheet.create: (s) => s`;
  - `Platform`;
  - `Alert`.
- Mock `@react-navigation/*` and `@bottom-tabs/react-navigation` with navigators that render **every** `Screen`. They must handle both the children-function and `component=` forms (RESEARCH Pattern 2).
- Mock `useAuth0Session` with the stable-object pattern from `useSurveySync.logout-purge.test.ts:78-101`.
- The status trigger is the captured `reportStatus`/`setStatus`. Today that is `surveySync.setStatus` (`App.tsx:85`).
- The file is `.tsx`. `.test.tsx` is collected (`jest.unit.config.js:5`, proven by `render-hook-wrapper.test.tsx:1-7`).

### `mobile/src/storage/db.ts` (migration 2)

**Analog:** self, `migration1` + `ensureColumn` + `MIGRATIONS` (`:17-20`, `:47-64`, `:101-111`, `:133-135`). Copy this pattern:
```ts
export const SCHEMA_VERSION = 1          // -> 2
...
// Every queue row gets an explicit op_type, backfilled from its existing payload guards
await ensureColumn(tx, "sync_queue", "op_type", "op_type TEXT")
const queueRows = await tx.getAllAsync<{ id: number; payload: string }>(
  `SELECT id, payload FROM sync_queue`,
)
for (const row of queueRows) {
  const opType = deriveQueueOpType(safeParseJson(row.payload))
  await tx.runAsync(`UPDATE sync_queue SET op_type = ? WHERE id = ?`, [opType, row.id])
}
...
// Migration N lives at index N-1; MIGRATIONS[currentVersion] is the next one
const MIGRATIONS: Array<(tx: TxHandle) => Promise<void>> = [migration1]   // -> [migration1, migration2]
```
- Also add `payload_completion INTEGER NOT NULL DEFAULT 0` to the fresh-install `CREATE TABLE` (`:149-163`)? **No.** Fresh installs deliberately get the *pre-phase baseline* and migrate like every other install (`:146-147` comment). Leave the `CREATE TABLE` text alone.
- The runner (`:204-221`) already bumps `user_version` atomically. Nothing to change there.
- The doc comment on `migration2` must say "additive only", like `:66-71`.

**Test analog:** `mobile/src/storage/db.migration.sqlite.test.ts:1-70`:
- `createNodeSqliteDb()`;
- `jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn(async () => mockDb) }))`;
- seed with a `PRE_PHASE_SCHEMA` string, then `initLocalDb()`.

Add a v1 fixture (schema after `migration1`, `PRAGMA user_version = 1`) with drafts and a submitted row. Assert:
- `payload_completion` is backfilled;
- `user_version = 2`;
- a re-run is idempotent.

### `mobile/src/storage/surveys.ts` and `sync.ts`: the four write sites and the list read

The four sites are those that write `payload_json`. Add the column and one bound value to each:
1. `createLocalDraft` INSERT, `surveys.ts:44-62`:
   ```ts
   `INSERT INTO local_surveys (id, site_name, status, visibility, sync_version, sync_state, last_sync_error, last_sync_error_code, last_sync_error_at, sync_blocked, payload_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   ```
2. `updateLocalDraft` UPDATE, `surveys.ts:386-407`: `payload_json = ?,` then `payload_completion = ?,`.
3. `applyRemoteChanges` INSERT, `sync.ts:293-306`.
4. `applyRemoteChanges` UPDATE, `sync.ts:315-330`.

Status-only UPDATEs need no change (RESEARCH Pattern 4 lists them). The returned objects already compute `completion_rate: computeCompletionRate("draft", nextPayload)` (`surveys.ts:422`). Keep that call.

**`listLocalSurveys` today** (`surveys.ts:428-447`) parses every payload:
```ts
`SELECT id, site_name, status, ..., created_at, updated_at, payload_json
 FROM local_surveys
 ORDER BY updated_at DESC`,
...
return rows.map((row) => {
  const payload = row.payload_json ? toSurveyQueuePayload(safeParseJson(row.payload_json)) : null
```
It becomes one SELECT without `payload_json`, using `CASE WHEN status = 'submitted' THEN 100 ELSE payload_completion END AS completion_rate`.

**`utils.ts:66-97`:** split out `computePayloadCompletion(payload)` (the body after `:70-71`). `computeCompletionRate` then stays `status === "submitted" ? 100 : computePayloadCompletion(payload)`.

### `mobile/src/screens/survey-list/SurveyRow.tsx` (new, `memo`) and `SurveyListView.tsx` (`Animated.FlatList`)

**Row body to move:** `SurveyListScreen.tsx:1019-1161`. Per-row derivations happen inline today, and there is a `let swipeableRef` closure:
```tsx
{mainListSurveys.map((survey) => {
  const attachments = attachmentsBySurvey[survey.id] ?? []
  const firstPhotoAttachment = attachments.find(isPhotoAttachment)
  ...
  const isSelected = selectedSurveyId === survey.id
  let swipeableRef: Swipeable | null = null
  return (
    <Swipeable key={survey.id} ref={(instance) => { swipeableRef = instance }}
      renderLeftActions={() => (
        <Pressable accessibilityRole="button"
          accessibilityLabel={`Supprimer le relevé ${survey.site_name}`}
          onPress={() => { swipeableRef?.close(); onDeleteSurvey(survey.id) }} ...>
      ...
      <Pressable accessibilityRole="button" accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${survey.site_name}, ${uiStatusLabel}, mis à jour ${formatShortDateTime(survey.updated_at)}`}
        onPress={() => { triggerHaptic(); onOpenSurvey(survey.id) }}>
```
- The row takes `survey`, `preview`, `selected`, `onOpen(id)` and `onDelete(id)`.
- The ref becomes a `useRef<Swipeable>(null)` inside the row.
- Keep `import Swipeable from "react-native-gesture-handler/Swipeable"` (`:18`). Reanimated is not installed.
- The scroll container is `Animated.ScrollView` (`:678`…`:1199`). Keep `Animated`, because the hero reads `scrollY`. Pass a memoised `ListHeaderComponent` (Pitfall 5).

### Screen splits and per-screen styles

**Styles analog:** `mobile/src/screens/SurveyDetailScreen.styles.ts:1-12`, imported as `import { styles } from "./SurveyDetailScreen.styles"` (`SurveyDetailScreen.tsx:75`):
```ts
import { StyleSheet } from "react-native"
import {
  brandColors,
  brandRadius,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"

export const styles = StyleSheet.create({
```
- In a sub-folder, the import becomes `../../app/brand-tokens`.
- `PublicMapScreen.tsx` uses an inline `screenStyles` const in the same file (`:199-201`). Move it to `public-map/styles.ts`.
- `mobile/src/app/styles.ts` has 6 live keys. Two consumers import it: `AuthenticatedAppNavigation.tsx:24` (`styles.tabScreenContainer` etc.) and `App.tsx:8` (`styles.container`, `styles.appLayout`). Move those keys next to their users and delete the file.

**Sub-component analog:** `mobile/src/screens/SurveyFormScreen.components.tsx`, 167 lines, holding presentational pieces imported by the screen.

**Target sizes** (400-line limit, including `.styles.ts`):

| File | Lines |
|---|---|
| `SurveyListScreen` | 1 772 |
| `SurveyDetailScreen` | 1 344 |
| `SurveyFormScreen` | 1 190 |
| `SurveyDetailScreen.styles` | 836 |
| `PublicMapScreen` | 754 |
| `AuthGateScreen` | 752 |
| `SurveyFormScreen.styles` | 644 |
| `AccountScreen` | 596 |
| `HomeScreen` | 409 |
| `AuthenticatedAppNavigation` | 961 (the `navigation/` rule) |

### `mobile/src/__checks__/structure.test.ts` + unused-style-key script (D-04)

**Analogs:**
- `scripts/coverage-by-directory.js:1-40`: a CommonJS `fs`/`path` walker with the logic in a pure function and a doc comment of its rules.
- `api/test/check-env-parity.spec.ts:2,16`: a spec that reads repo files through `readFileSync(join(REPO_ROOT, …))`.

The scanner uses the `typescript` compiler API (installed, 5.9.3), as RESEARCH's scratch scripts did:
- Find `StyleSheet.create({...})` object keys.
- Count `styles.<key>` property accesses per file, plus any file importing that styles module.
- Exclude dynamic `styles[variant]` in `src/ui/*`.

D-04 requires "a committed script". Put the logic in `mobile/scripts/unused-style-keys.mjs`, or in a `.ts` module under `src/__checks__/`, and have the Jest test assert `unused.length === 0`. Start the checks as allowlist ratchets (RESEARCH Wave 0 Gaps).

### `mobile/src/navigation/*` (split) and typed navigation

**Param lists to move to `navigation/types.ts`:** `AuthenticatedAppNavigation.tsx:48-73`. Also add `declare global { namespace ReactNavigation { interface RootParamList extends RootTabParamList {} } }` there (RESEARCH Pattern 6).

**The one cast to remove** (`:606-607`, `:628`):
```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabNav = useNavigation() as any
...
onNavigateToExplorer={() => tabNav.navigate("publicMap")}
```

**Screen render callbacks.** Every one is `{() => <X .../>}` or `{({ navigation }) => …}`, for example `:384-425`, `:612-633` and `:810-860`. They become `component={XContainer}`, where each container reads its contexts. The `listeners` factories (`:252-288`) read context-free values. Pass them stable actions from `useSyncActions()` inside a small wrapper component, or build them with `useMemo` in the tab tree.

**Tab tree skeleton to keep** (`:936-961`): one `NavigationContainer`, and `AppTabs` choosing `NativeRootTabs` or `JsRootTabs`. `getNativeTabNavigator()` (`:137-145`) keeps the lazy `require` so unsupported runtimes can still boot. Do not turn it into a static import.

### Tabs: search merged, identical hiding, Release fallback

- **Merge:** see C-6. The native header search config to keep for Mes Relevés is at `:355-382` (`headerSearchBarOptions` with `ref: searchBarRef`, `onChangeText` → `surveyList.setSurveyQuery`, `onCancelButtonPress`). Its strings (`"Rechercher des relevés"`, `"Mes Relevés"`, `"Detail"` at `:432`) go to `fr.navigation.*`.
- **Hiding:** see C-3.
- **Fallback:** see C-7. The height hook `app/useAppBottomTabBarHeight.ts:19-24` already reads both libraries' contexts. It needs no change, beyond moving to `navigation/` if desired.

### API `bbox` on `/v1/public/map-items`

**DTO analog:** `api/src/surveys/dtos/public-parcel-statuses-query.dto.ts:1-8`. Copy the field verbatim into `PublicMapItemsQueryDto`:
```ts
import { IsOptional, IsString, MaxLength } from "class-validator"

export class PublicParcelStatusesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  bbox?: string
```
The controller (`public.controller.ts:10-13`) passes the DTO through unchanged.

**Service analog:** `public-map.service.ts:89-99`. The same `parseBbox` import is at `:21`:
```ts
const bbox = parseBbox(input?.bbox)
```
Extend `getPublicMapItems(input?: { from?; to?; region?; bbox? })` (`:68-86`) and pass `bbox` into `buildPublicMapItemsQuery`. `parseBbox` (`surveys-normalize.utils.ts:342-365`) throws fixed-message `BadRequestException`s on malformed input: 4 parts, finite numbers, min < max.

**Query analog:** `public-map.queries.ts:45-97`. Its conditions and values push pattern keeps parameter order stable:
```ts
const conditions: string[] = [PUBLIC_SURVEY_PREDICATE, `s.submitted_at IS NOT NULL`]
const values: unknown[] = []
if (filters.from) {
  values.push(filters.from)
  conditions.push(`s.submitted_at::date >= $${values.length}::date`)
}
```
- Add `bbox?: { minLng; minLat; maxLng; maxLat } | null` to `PublicMapItemsFilters` (`:19-26`).
- Append it **last**, so `from`/`to`/`region` parameter numbers do not move. Use an `EXISTS (SELECT 1 FROM survey_parcels sp JOIN parcels p ON p.parcel_id = sp.parcel_id WHERE sp.survey_id = s.id AND p.centroid_lat BETWEEN … AND p.centroid_lng BETWEEN …)` inside the inner limit-first subquery.
- Copy the casts from `PUBLIC_PARCEL_STATUSES_BBOX_SQL` (`:138-139`):
  ```sql
  WHERE p.centroid_lng BETWEEN $2::double precision AND $3::double precision
    AND p.centroid_lat BETWEEN $4::double precision AND $5::double precision
  ```
- Extend the doc comment at `:28-44`, which cites D-13 and its measurements, with the 01.9 D-05 note.

### `api/test/public-map-bbox.e2e-spec.ts` (new)

**Setup analog:** `api/test/list-pagination.e2e-spec.ts:1-15`, for the imports and the header comment citing decision IDs:
```ts
import "dotenv/config"
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test, TestingModule } from "@nestjs/testing"
import { randomUUID } from "crypto"
import request = require("supertest")
import { AppModule } from "../src/app.module"
import { configureApp } from "../src/app.setup"
import { DatabaseService } from "../src/database/database.service"
```

**EXPLAIN analog:** `api/test/public-routes-explain.e2e-spec.ts`:
- `explainJson` (`:150-156`), `seqScansOn` (`:158-170`) and `indexesUsed` (`:180-188`);
- `beforeAll` with `configureApp(app)` and a `BEGIN … ROLLBACK` client (`:199-214`);
- the per-filter loop (`:251-264`):
  ```ts
  for (const filters of [{}, { region: "ACA" }, { from: "2020-01-01", to: "2100-12-31" }]) {
    const query = publicMapQueries.buildPublicMapItemsQuery(filters)
    const plan = await explainJson(query.text, query.values)
    expect(seqScansOn(plan)).toEqual([])
  ```
  Add a `{ bbox: … }` case.

**HTTP assertion analog:** `surveys-idempotency.e2e-spec.ts:642-656` (`.get("/v1/public/map-items").query({ region: "ACA" }).expect(200)`, then item membership).

The spec must cover four cases:
1. The response with no `bbox` is identical to before.
2. A `bbox` keeps inside items and drops outside ones.
3. A malformed `bbox` gets 400 with the fixed message and no echo.
4. `bbox` longer than 128 characters gets 400 from the ValidationPipe.

Keep it out of `surveys-idempotency.e2e-spec.ts` (D-05).

### Mobile map: API client, explorer hook, screen

**Client analog:** `mobile/src/api/ibp-api.ts:174-190`. Add `if (input?.bbox?.trim()) queryParts.push(`bbox=${encodeURIComponent(input.bbox)}`)`, copying `fetchPublicParcelStatuses` (`:196-199`).

**Hook analog, stale guard:** `usePublicMapExplorer.ts:43-76`:
```ts
const requestId = requestRef.current + 1
requestRef.current = requestId
setParcelsLoading(true)
try {
  const payload = await fetchPublicParcelStatuses(apiUrl, { bbox: input.bbox, ... })
  if (requestRef.current !== requestId) {
    return
  }
```
Give `loadPublicMap` (`:25-41`) the same guard, a `bbox` argument and its own `itemsRequestRef`. Its two status strings (`:35`, `:37`) become status codes.

**Screen analog, debounce and dedupe:** `PublicMapScreen.tsx:139-155`:
```ts
const timer = setTimeout(() => {
  const bbox = computeRegionBbox(mapRegion)
  const key = `${mapZoom.toFixed(2)}:${bbox}`
  if (lastParcelsRequestKeyRef.current === key) {
    return
  }
  lastParcelsRequestKeyRef.current = key
  void onLoadParcelsRef.current({ bbox, zoom: mapZoom })
}, 400)
return () => clearTimeout(timer)
```
Extract this into `useDebouncedValue` (RESEARCH Code Examples) and reuse it for items.

- `computeRegionBbox` and `computeRegionZoom` already exist (`app/map-viewport.ts:14,32`).
- **Remove** the auto-refit `useEffect(() => { setMapRegion(targetRegion); mapRef.current?.animateToRegion(targetRegion, 520) }, [targetRegion])` (`:130-133`), or gate it to the first load and filter changes (Pitfall 6).
- The markers at `:218-237` have inline `onPress` closures. Replace them with `memo(SurveyMarker)` taking `onSelect(id)`, plus `memo(ClusterMarker)` with `tracksViewChanges={false}`.
- The `onRegionChangeComplete={setMapRegion}` at `:203` stays, followed by the debounce.

### `mobile/jest.unit.config.js`

**Analog:** self `:19-29`. Add one line in the same style (single quotes: this file is not Prettier-checked, since `format:check` globs only `.ts`/`.tsx`/`.json`):
```js
moduleNameMapper: {
  '^@expo/vector-icons$': '<rootDir>/test/vector-icons.mock.ts',
  ...
  '^supercluster$': '<rootDir>/<see C-9>/supercluster/dist/supercluster.js',
```
Add threshold rows as described in C-8. Only the last plan that touches a directory ratchets its row.

### `mobile/src/i18n/*` (new) and the string migration

**Catalogue shape analog:** `mobile/src/app/brand-tokens.ts:1-23`, `export const brandColors = { … } as const`. Nested `as const` objects are already the project idiom.

**French message table analog:** `mobile/src/app/formatters.ts:33-53` (`SYNC_ERROR_PATTERNS` + `formatSyncErrorForUser`). It moves into the catalogue, keyed by `last_sync_error_code` rather than regexes over free text (RESEARCH Pattern 8).

**Typed status union analog:** `mobile/src/hooks/operation-status.ts:1-9`:
```ts
export type OperationScope =
  | "session" | "auth" | "profile" | "sync" | "survey" | "attachment" | "debug"
export type OperationState = "idle" | "running" | "success" | "error"
```
`StatusCode` = `keyof typeof fr.status`, in the same `export type` style.

**Existing French literals to lift first:**
- `TAB_TITLES` (`AuthenticatedAppNavigation.tsx:201-207`);
- `DraftCard.tsx:24-30,43,47` (`"À l'instant"`, `"Relevé sans titre"`, `"AVANCEMENT"`);
- `SettingsScreen` shows `status` at `:153-155`, the only place status is displayed.

**Debug tab** (D-06):
- The chips are at `SurveyDetailScreen.tsx:932-948`, where `label="Debug"` is `:944`.
- The `event.event_type` title is at `:1236` and `formatEventPayload` at `:1238-1239`. The `"Debug snapshot"` section is at `:1251`.
- Gate them with `shouldShowDevTools()` (`app/dev-tools.ts:8-10`), which this file already imports at `:18` and uses at `:1297`.

**`mobile/app.json:13-25`:** translate `photosPermission`, `cameraPermission` and `locationWhenInUsePermission` in place. They are plugin options, so no native code changes.

**Tests that assert English messages** (Pitfall 10): `survey-sync/useSurveySyncProfile.test.ts:218-225` (`"SMTP error"`, which is test data, not a product string), `useSurveySyncSurveyOperations.test.ts`, and others. Switch them to asserting codes.

### `mobile/.eslintrc.json` (lint gates, D-06 and D-07)

**Analog, overrides block:** self `:21-29`:
```json
"overrides": [
  {
    "files": ["src/**/*.test.ts", "src/**/*.test.tsx"],
    "rules": { ... }
  }
]
```
**Analog, a restriction rule with a project message:** `api/.eslintrc.json:9-16`:
```json
"no-restricted-properties": [
  "error",
  { "object": "process", "property": "env",
    "message": "Read configuration through ConfigService or src/config (phase 01.7 D-01)" }
],
```
- Add one override for `src/screens/**`, `src/components/**`, `src/ui/**` and `src/navigation/**`:
  - `react/jsx-no-literals` with `{ "noStrings": true, "ignoreProps": true }`;
  - `no-restricted-syntax` with the named-prop and `Alert.alert` selectors (RESEARCH Pattern 9).
- Add a second override for the survey-detail, survey-form and public-map folders, with the two `Pressable` `:has()` selectors.
- Put the same "(phase 01.9 D-06)" or "(phase 01.9 D-07)" suffix in each message.
- Exclude test files by listing the test override **after** these.
- `plugin:react/recommended` is already extended (`:2`), so no new dependency is needed.

### Removals: root files, API dependencies, EmailService and SMTP

- **Root:** delete `App.tsx` (3 lines, `import App from "./mobile/App"`), `tsconfig.json` (`"extends": "expo/tsconfig.base"`) and the `dependencies` block of `package.json` (`expo`, `react`, `react-native`).
  - Keep `overrides` and `devDependencies.react-test-renderer`.
  - Drop the `App.tsx` line from `.dockerignore:13`.
  - Fix the stale comment in `api/Dockerfile:5-6` and `:22-23` ("the root package.json's dependencies are Expo/React Native").
  - The CI `shared` filter lists `tsconfig*.json` (`ci.yml:45`). That is harmless once the file is gone.
- **API deps:** remove from `api/package.json` `:27` `@types/nodemailer`, `:48` `@nestjs/schedule`, `:50` `bcryptjs` and `:58` `nodemailer`. `grep -rn "ScheduleModule\|bcrypt" api/src` is empty.
- **`@expo/ngrok`:** move `mobile/package.json:23` to `devDependencies`.
- **`EmailService`:** delete `api/src/users/email.service.ts`. It is registered in no module. Stale `api/dist/users/email.service.js` goes on rebuild.
- **Config** (C-2):
  - `env.schema.ts:65-73` (the `// SMTP` block + `EMAIL_CHANGE_CONFIRM_URL_TEMPLATE`);
  - `config.types.ts:68-77` (`smtp`);
  - `app-config.ts:120-130` (`smtp:`, and the comment "EmailService keeps its own … rule");
  - `api/test/env.schema.spec.ts:74-75`, `:134`, `:141-146`.
- **Env examples:**
  - `api/.env.example:41-50`;
  - `api/.env.production.example:45-53`;
  - `infra/.env.example:33-40`;
  - `infra/vps/env.example:39-46`.
  - The parity spec's "with only its CHANGE_ME placeholders replaced passes both checks" (`check-env-parity.spec.ts:275-289`) reads `infra/vps/env.example`. It must stay green after the edit.
- **CI:** drop `SMTP_ENABLED: false` at `ci.yml:212` and `:300`, and `-e SMTP_ENABLED=false \` at `:497`.
- **`check-env.sh`:** see C-1. Parity test analog (`check-env-parity.spec.ts:226-233`):
  ```ts
  it("flags dead variables as removable lines, never as errors", () => {
    const { shell } = runBoth(`${withChanges({})}\nACCESS_TOKEN_SECRET=${DB_SECRET}`)
    expect(shell.status).toBe(0)
    expect(shell.output).toContain(
      "INFO : ACCESS_TOKEN_SECRET : ligne inutile, peut être supprimée",
    )
    expect(shell.output).not.toContain(DB_SECRET)
  })
  ```
  Add an `SMTP_PASSWORD=<secret>` case, asserting the INFO line, exit 0 and no secret echo.
- **Autolinking proof** (D-09): before and after, run `npx expo-modules-autolinking resolve -p android --json`, `… react-native-config -p android --json` and `npm ls react react-native expo --all` from `mobile/`. Save the JSON in the phase directory (RESEARCH Pattern 10).

### `.github/workflows/ci.yml` (native build jobs, D-10)

**Analogs:**
- the `changes` job and its filter list (`:17-52`);
- the `mobile-build` job (`:359-404`): the checkout pinned by SHA with `persist-credentials: false`, `setup-node` 22 with the npm cache, the `node_modules` cache keyed on `package-lock.json`, `npm ci` on a cache miss, and `working-directory: mobile`;
- the `ci-ok` aggregator (`:568-614`).

Changes:
- Add a `native` output to `changes`:
  ```yaml
  native:
    - 'mobile/package.json'
    - 'mobile/app.json'
    - 'mobile/plugins/**'
    - 'package.json'
    - 'package-lock.json'
  ```
  Also consider `workflow_dispatch` under `on:` (`:3-7`).
- New `native-android` job (`ubuntu-latest`): `actions/setup-java` 17, then `npx expo prebuild -p android --no-install`, then `./gradlew assembleRelease` (A3: fall back to `assembleDebug`).
- New `native-ios` job (`macos-latest`): prebuild, then `pod install`, then `xcodebuild … -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO`.
- Pin every action by SHA, as the existing ones are.
- Add both jobs to `ci-ok.needs` (`:573-574`), add a `*_RESULT` env and put them in the "success or skipped" loop (`:602-606`).
- Keep `timeout-minutes` explicit (the existing jobs use 5-20). Native builds need about 45-60 minutes.

### `scripts/owner-check-simulation.mjs`

**Analog:** self, `:934-939`:
```js
r = await api(null, "GET", "/public/map-items")
check(
  "GET /public/map-items 200 with an items array",
  r.status === 200 && Array.isArray(r.json?.items),
  ...
```
Add a read-only `?bbox=…` probe and a malformed-`bbox` 400 probe in `phaseProduction()`.

---

## Shared Patterns

### Hook test recipe
Follow `render-hook-smoke.test.ts:1-26`:
1. Declare `jest.mock("react-native", …)` with a plain object first.
2. Then `import … from "@testing-library/react-native/pure"`.
3. Always `await renderHook`/`act`.
4. Call `cleanup()` in `afterEach`.

Mocked collaborators must be **stable objects** (`useSurveySync.logout-purge.test.ts:78-80` comment).

### Storage writes
- Every multi-statement write goes through `runInTransaction(async (tx) => …)` (`surveys.ts:43`, `db.ts:213`).
- Additive schema changes go through `ensureColumn` only (`db.ts:47-64`, T-01.5-09).

### Public API query shape
- Keep `PUBLIC_SURVEY_PREDICATE` (`public-map.queries.ts:11`, T-01.7-42) and `PUBLIC_MAP_ITEMS_LIMIT = 500` (`:14`).
- Errors are fixed-message `BadRequestException`s with no echo (`parseBbox`).

### French user text and dev-only surfaces
- User text: `fr.*` only.
- Raw detail goes to `console.debug` under `shouldShowDevTools()` (`dev-tools.ts:8-10`).
- Dev-only props go through `devOnlyHandler` (`dev-tools.ts:19-21`, already used in navigation `:23`).

### Code style
- Prettier: double quotes, no semicolons, trailing commas, 100 columns. It covers `.ts`, `.tsx` and `.json` only, so `.js` configs keep their own style.
- Comments cite decision IDs, as in `// D-07/T-01.5-27:` (`sync.ts:309`) and `// WR-08:` (`useSurveySync.ts:58`).
- Use `export type` for type-only exports.

---

## Hotspot files (serialize, do not edit in parallel)

The plan labels below follow RESEARCH's recommended order:
- **HARN**: render-count harness, scanners, ESLint gates as warnings, CI native jobs on the unchanged tree.
- **STATE**: contexts, assembler, renderHook rewrites.
- **LIST**: migration 2, completion column, `FlatList`, `DraftCard`.
- **NAV**: navigation split, typed navigation, tab changes (C-3, C-6, C-7).
- **SCR-***: per-screen splits with strings and a11y. The screens are detail, form, list, auth, account and home.
- **I18N**: catalogue core, status codes, `app.json`.
- **MAP**: API `bbox`, mobile map, supercluster.
- **HYG**: removals, SMTP, lockfile, autolinking proof.
- **ZZ**: after 01.8 (D-12).

| File | Touched by | Rule |
|---|---|---|
| `mobile/App.tsx` | STATE (provider), I18N (`Init error:` `:140`, `Survey … opened` `:146`), HYG (none: the root `App.tsx` is a different file) | STATE first. I18N edits come after STATE, in the provider file that the code moves to. |
| `mobile/src/app/AuthenticatedAppNavigation.tsx` (961 lines, becomes `navigation/`) | STATE (props → contexts), NAV (split, types, tabs), I18N (`TAB_TITLES`, header titles), MAP (`makePublicMapTabListeners` `:264-274` calls `loadPublicMap()`) | **Strictly sequential: STATE → NAV → I18N/MAP.** Never two in one wave. MAP must start from the NAV version (the file is gone by then). |
| `mobile/src/hooks/useSurveySync.ts` | STATE (slices, `useCallback` debug resets), I18N (status codes, Alert texts `:309-322`, `:336-356`) | STATE → I18N |
| `mobile/src/app/styles.ts` (deleted) | STATE/NAV (its 6 live keys move with `App.tsx` and navigation), SCR-* (unused-key scanner reaches 0) | Delete it in NAV, the last consumer. SCR-* plans never edit it. |
| `mobile/src/screens/SurveyListScreen.tsx` | LIST (`FlatList`, row), NAV (`visibleSurveys`/`showInlineSearch` props, C-6), SCR-list (split, strings) | LIST → NAV → SCR-list, or merge LIST and SCR-list into one plan |
| `mobile/src/screens/PublicMapScreen.tsx` | MAP (debounce, clusters), SCR-map (split, a11y, strings) | One plan (recommended), or MAP → SCR-map |
| `mobile/src/hooks/usePublicMapExplorer.ts` (+ test, C-4) | STATE (`onStatusChange` becomes a stable `reportStatus`), MAP (`bbox`), I18N (status codes) | STATE → MAP → I18N |
| `mobile/src/storage/surveys.ts`, `sync.ts`, `db.ts`, `utils.ts` | LIST only | none. Keep them out of other plans. |
| **`package-lock.json`** + root/api/mobile `package.json` | MAP (`supercluster@9.1.0`, owner checkpoint), HYG (root deps, API deps, `@expo/ngrok`), 01.8 (`packages/ibp-domain`) | **One lockfile plan in flight at a time** (D-09, Pitfall 14). Either install supercluster inside HYG, or run MAP's install strictly before or after HYG. Never in parallel with 01.8 lockfile work. Resolve conflicts by `npm install`, never by hand. |
| `mobile/jest.unit.config.js` | HARN (`__checks__` row), STATE (`state/`), NAV (`navigation/`), I18N (`i18n/`), MAP (`^supercluster$`) | Additive rows. Ratchet each row only in the last plan touching the directory. Sequence the MAP mapper after the install. |
| `mobile/.eslintrc.json` | HARN (rules as `warn`), SCR-*/I18N (flip to `error` per folder) | Only the final SCR/I18N plan flips the global level |
| `.github/workflows/ci.yml` | HARN (native jobs, `native` filter, `ci-ok`), HYG (`SMTP_ENABLED` `:212,:300,:497`) | HARN → HYG |
| `api/src/surveys/public-map.{service,queries}.ts`, `dtos/public-map-items-query.dto.ts`, `api/test/public-map-bbox.e2e-spec.ts` | MAP only | none. Do not touch `surveys-idempotency.e2e-spec.ts` (01.8 splits it). |
| `api/src/config/*`, `api/test/env.schema.spec.ts`, `infra/vps/check-env.sh`, `api/test/check-env-parity.spec.ts`, env examples | HYG only | none |
| `CLAUDE.md` | STATE (the "no Context API" line), NAV (tabs), HYG (SMTP env row `:291`), ZZ (final sweep) | Each plan corrects only its own facts, and ZZ does the rest. Serialize edits, or append in merge order. |
| `docs/technical/api-contract-v1.md` | MAP (`:931-947`) | MAP only |

**Safe to parallelize:**
- After STATE: LIST ‖ MAP-API (API files only) ‖ HYG-config (API config + infra, no lockfile) can run together.
- SCR-detail ‖ SCR-form ‖ SCR-auth ‖ SCR-account can run together once NAV has merged, since they touch disjoint folders.

**E2E DB isolation per plan** (as in 01.7): `POSTGRES_DB=ibp_p19_<plan>_test … flock /tmp/ibp-e2e.lock npm --workspace api run test:e2e`.

---

## Specs and docs that must be updated

| Doc | What changes | Plan |
|---|---|---|
| `docs/technical/api-contract-v1.md:931-947` | `GET /public/map-items?from=&to=&region=&bbox=`: format `minLng,minLat,maxLng,maxLat`, 400 on malformed input, no `bbox` = today's answer, still capped at 500 | MAP |
| `docs/technical/technical-architecture-v1.md:118` | Viewport-driven public map loading and client clustering | MAP |
| `docs/technical/data-contract-v1.md` (Survey local diagnostic fields, around `:60-90`) | Local-only `payload_completion`, SQLite `user_version` 2 | LIST |
| `docs/technical/sync-conflict-resolution-v1.md` | Only if the `applyRemoteChanges` write sites are described (they gain the column). Verify only. | LIST |
| `docs/specs/epic-e-data-quality-and-trust.md:27-37` (US-E2 Search a Survey) | Search is the header search bar of "Mes Relevés". There is no separate tab. | NAV |
| `docs/specs/user-stories.md:36,65-73` (Explore map) | Viewport loading and clustering. The anonymisation and rounding rules are unchanged. | MAP |
| `mobile/README-native.md` | `EXPO_PUBLIC_ENABLE_NATIVE_TABS` meaning, the logged fallback reason, CI native jobs | NAV / HARN |
| `README.md:89-90`, `api/README.md:17-18`, `CLAUDE.md:291` | Remove the SMTP and `EMAIL_CHANGE_CONFIRM_URL_TEMPLATE` rows | HYG |
| `infra/vps/README.md` | Mention the obsolete `SMTP_*` INFO lines in the owner checklist | HYG |
| `CLAUDE.md` (architecture: "no Redux or Context API", hooks list, Key files `app/styles.ts`) | Contexts in `src/state/`, catalogue in `src/i18n/`, navigation folder | STATE / NAV / I18N, then ZZ |
| `CLAUDE.md` + `docs/technical/*` final sweep, the audit "Statut" links for 01.8/01.9, IBP validation messages | D-12 | **ZZ (blocked on 01.8)** |
| `docs/audits/audit-2026-09-code-complet.md` "Statut" rows for 01.2–01.7 (#127–#157) | D-12 says "written now" | any early plan (HARN or HYG) |
| `.planning/codebase/{STACK,STRUCTURE,ARCHITECTURE,INTEGRATIONS}.md` | They mention SMTP, nodemailer and the old structure | ZZ |

---

## No Analog Found

| File / Concern | Role | Reason | Use instead |
|---|---|---|---|
| `React.memo` rows and markers | component | `grep "memo("` in `mobile/src` is empty | RESEARCH Pattern 3 and Pattern 7 code |
| `FlatList` / `Animated.FlatList` | component | Every list is a `ScrollView` + `.map` | RESEARCH Pattern 3; Pitfall 5 |
| Production React contexts (5 slices) | provider | Only a test uses `createContext` + `Provider`; `useAppBottomTabBarHeight` only consumes library contexts | RESEARCH Pattern 1; `render-hook-wrapper.test.tsx:22-30` for the mechanics |
| supercluster integration | hook | No clustering anywhere | RESEARCH Pattern 7; Pitfalls 7-8 |
| AST scanners (unused styles, ≤ 400 lines, literals) | test/utility | No TypeScript-compiler-API code in the repo | RESEARCH Pattern 9 (the scratch scripts' approach); `coverage-by-directory.js` for the pure-function and CLI shape |
| `react/jsx-no-literals` / `:has()` selectors | config | No JSX-level lint rules configured yet | RESEARCH Pattern 9 (prototyped) |
| Native Android and iOS CI jobs | CI | No Java, Gradle, CocoaPods or Xcode steps exist | RESEARCH Pattern 11; A2 and A3 caveats |
| Catalogue `Widen<typeof fr>` type | type | No second-language typing exists | RESEARCH Pattern 8 |

---

## Metadata

**Analog search scope:**
- `mobile/App.tsx` and `mobile/src/{app,hooks,hooks/survey-sync,storage,screens,components,ui,api}`;
- `mobile/{jest.unit.config.js,.eslintrc.json,app.json,package.json}`;
- `api/src/{surveys,config,users}` and `api/test/*.{spec,e2e-spec}.ts`;
- `api/{package.json,.eslintrc.json,jest.config.js,Dockerfile}`;
- `infra/vps/check-env.sh` and the env examples;
- `.github/workflows/ci.yml`, `scripts/*`, root `package.json`, `tsconfig.json`, `App.tsx` and `.dockerignore`;
- `docs/technical/*` and `docs/specs/*`;
- the installed `@bottom-tabs/react-navigation` and `react-native-bottom-tabs` type declarations.

**Files scanned:** about 70.
**Pattern extraction date:** 2026-09-26.
