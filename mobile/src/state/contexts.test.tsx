/**
 * Context contract tests (phase 01.9, D-01).
 *
 * Part 1: every consumer hook throws a clear error outside AppStateProvider,
 * so a missing provider is never a silent default.
 *
 * Part 2: AppStateProvider renders the real assembler (real hooks) with the
 * session, storage, API and native modules mocked. A probe reads all six
 * context values after each update and the tests compare identities:
 * - useSurveySync runs once per provider render (never twice: T-01.9-18);
 * - a status update changes only the status value;
 * - a form keystroke changes only the form value;
 * - the sync-actions value never changes identity;
 * - the session value holds no access token (T-01.9-17).
 */

import React from "react"
import renderer, { act } from "react-test-renderer"

type ReportStatus = (scope: "session", state: "idle", message: string) => void

const mockCaptured: {
  reportStatus: ReportStatus | null
  setSiteName: ((value: string) => void) | null
} = { reportStatus: null, setSiteName: null }

const mockUseSurveySyncCalls = { count: 0 }

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios },
  StyleSheet: {
    create: <T,>(s: T): T => s,
    flatten: (s: unknown) => s,
    absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  },
  View: "View",
}))

// ─── App shell seams (part 3) ────────────────────────────────────────────────

const mockOverlayProps: Record<string, Record<string, unknown>> = {}

function mockOverlayProbe(name: string) {
  return function OverlayProbe(props: Record<string, unknown>) {
    mockOverlayProps[name] = props
    return null
  }
}

jest.mock("../screens/AuthGateScreen", () => ({ AuthGateScreen: mockOverlayProbe("authGate") }))
jest.mock("../screens/ProfileSetupScreen", () => ({
  ProfileSetupScreen: mockOverlayProbe("profileSetup"),
}))
jest.mock("../screens/LocalDataOwnerConflictScreen", () => ({
  LocalDataOwnerConflictScreen: mockOverlayProbe("ownerConflict"),
}))
jest.mock("../app/AuthenticatedAppNavigation", () => ({
  AuthenticatedAppNavigation: () => null,
}))

jest.mock("react-native-gesture-handler", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  return {
    GestureHandlerRootView: ({ children }: { children?: React.ReactNode }) =>
      ReactRef.createElement(ReactRef.Fragment, null, children),
  }
})

jest.mock("react-native-safe-area-context", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    ReactRef.createElement(ReactRef.Fragment, null, children)
  return { SafeAreaProvider: passthrough, SafeAreaView: passthrough }
})

jest.mock("../hooks/useSurveySync", () => {
  const actual = jest.requireActual("../hooks/useSurveySync") as {
    useSurveySync: (params: unknown) => unknown
  }
  return {
    useSurveySync: (params: unknown) => {
      mockUseSurveySyncCalls.count += 1
      return actual.useSurveySync(params)
    },
  }
})

jest.mock("../hooks/useSurveyForm", () => {
  const actual = jest.requireActual("../hooks/useSurveyForm") as {
    useSurveyForm: () => { setSiteName: (value: string) => void }
  }
  return {
    ...actual,
    useSurveyForm: () => {
      const form = actual.useSurveyForm()
      mockCaptured.setSiteName = form.setSiteName
      return form
    },
  }
})

const mockOwner = { sub: "auth0|ctx", email: "ctx@example.fr" }
const mockSession = {
  accessToken: "token-ctx",
  sessionRestoring: false,
  currentUser: {
    id: "u-ctx",
    email: "ctx@example.fr",
    first_name: "Con",
    last_name: "Text",
    display_name: "Con Text",
  },
  profile: "ctx",
  sessionOwner: mockOwner,
  isAuthenticated: true,
  setProfileFromUser: jest.fn(),
  clearSession: jest.fn(async () => undefined),
  refreshSessionTokens: jest.fn(async () => undefined),
  withAuthRetry: <T,>(fn: (token: string, tokenSub: string | null) => Promise<T>) =>
    fn("token-ctx", mockOwner.sub),
  handleLoadMyProfile: jest.fn(async () => undefined),
  handleLogin: jest.fn(async () => null),
  handleRegister: jest.fn(async () => null),
  handleForgotPassword: jest.fn(async () => undefined),
  handleLogout: jest.fn(async () => undefined),
}

jest.mock("../hooks/useAuth0Session", () => ({
  ...(jest.requireActual("../hooks/auth-errors") as object),
  useAuth0Session: (params: { reportStatus: ReportStatus }) => {
    mockCaptured.reportStatus = params.reportStatus
    return mockSession
  },
}))

const mockLocalDataOwner = {
  status: "ok",
  syncAllowed: true,
  ensureSyncOwner: async () => true,
  foreignWork: { surveys: 0, attachments: 0 },
  foreignOwnerEmail: null,
  discardForeignData: jest.fn(async () => undefined),
  recheck: jest.fn(),
}

jest.mock("../hooks/useLocalDataOwner", () => ({
  useLocalDataOwner: () => mockLocalDataOwner,
}))

jest.mock("../storage/db", () => ({
  initLocalDb: jest.fn(async () => undefined),
  getDb: jest.fn(async () => {
    throw new Error("getDb is not available in this test")
  }),
}))

jest.mock("../storage/attachments", () => ({
  persistLegacyAttachmentFiles: jest.fn(async () => ({ moved: 0, missing: 0 })),
  preparePhotoForStorage: jest.fn(),
  uploadAttachmentFile: jest.fn(),
  computeResizeTarget: jest.fn(),
}))

jest.mock("../storage/surveys", () => ({
  listLocalSurveys: jest.fn(async () => [
    {
      id: "s-01",
      site_name: "Site 01",
      status: "draft",
      visibility: "private",
      sync_version: 1,
      sync_state: "synced",
      last_sync_error: null,
      last_sync_error_code: null,
      last_sync_error_at: null,
      sync_blocked: 0,
      created_at: "2026-09-01T08:00:00.000Z",
      updated_at: "2026-09-01T09:00:00.000Z",
      completion_rate: 10,
    },
  ]),
  listLocalAttachments: jest.fn(async () => []),
  getLocalSurveyDraft: jest.fn(async () => null),
  createLocalDraft: jest.fn(),
  updateLocalDraft: jest.fn(),
  clearLocalIbpData: jest.fn(async () => undefined),
  hasPendingSyncWork: jest.fn(async () => false),
}))

jest.mock("../storage/sync", () => ({
  syncPending: jest.fn(async () => ({ synced: 0, failed: 0 })),
  pullRemoteChanges: jest.fn(async () => ({ surveys: 0, attachments: 0 })),
}))

jest.mock("../storage/local-owner", () => ({
  getLocalDataOwner: jest.fn(async () => mockOwner),
  setLocalDataOwner: jest.fn(async () => undefined),
  countUnsyncedLocalWork: jest.fn(async () => ({ surveys: 0, attachments: 0 })),
}))

jest.mock(
  "../api/ibp-api",
  () =>
    new Proxy(
      {},
      {
        get(target: Record<string, unknown>, prop) {
          if (typeof prop !== "string" || prop === "__esModule") return undefined
          if (!(prop in target)) target[prop] = jest.fn(async () => ({}))
          return target[prop]
        },
      },
    ),
)

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { executionEnvironment: "bare", appOwnership: null, expoConfig: { extra: {} } },
  ExecutionEnvironment: { StoreClient: "storeClient", Bare: "bare", Standalone: "standalone" },
}))

jest.mock("expo-network", () => ({
  // Never resolves: keeps the connectivity effects inert.
  getNetworkStateAsync: jest.fn(() => new Promise(() => undefined)),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  NetworkStateType: { WIFI: "WIFI", NONE: "NONE", CELLULAR: "CELLULAR" },
}))

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4, Balanced: 3 },
}))

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}))

jest.mock("react-native-auth0", () => ({
  __esModule: true,
  default: jest.fn(),
  CredentialsManagerError: class MockCredentialsManagerError extends Error {},
  CredentialsManagerErrorCodes: {},
}))

import { cleanup, renderHook } from "@testing-library/react-native/pure"
import App from "../../App"
import { AppStateProvider } from "./AppStateProvider"
import { useAccessToken, useSession, type SessionContextValue } from "./session-context"
import { useStatus, type StatusContextValue } from "./status-context"
import { useSyncActions, type SyncActions } from "./sync-actions-context"
import { useSurveys, type SurveysContextValue } from "./surveys-context"
import { useSurveyFormState, type SurveyFormContextValue } from "./survey-form-context"

type Snapshot = {
  session: SessionContextValue
  accessToken: string | null
  status: StatusContextValue
  syncActions: SyncActions
  surveys: SurveysContextValue
  form: SurveyFormContextValue
}

const snapshots: Snapshot[] = []

function Probe() {
  snapshots.push({
    session: useSession(),
    accessToken: useAccessToken(),
    status: useStatus(),
    syncActions: useSyncActions(),
    surveys: useSurveys(),
    form: useSurveyFormState(),
  })
  return null
}

function latest(): Snapshot {
  const snapshot = snapshots[snapshots.length - 1]
  if (!snapshot) throw new Error("the probe has not rendered")
  return snapshot
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve))
    })
  }
}

describe("context hooks outside AppStateProvider", () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    // React logs the error thrown during render; keep the output readable.
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("must be used inside AppStateProvider")) return
      if (message.includes("The above error occurred")) return
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
  })

  afterEach(async () => {
    await cleanup()
    jest.restoreAllMocks()
  })

  test.each([
    ["useSession", useSession],
    ["useAccessToken", useAccessToken],
    ["useStatus", useStatus],
    ["useSyncActions", useSyncActions],
    ["useSurveys", useSurveys],
    ["useSurveyFormState", useSurveyFormState],
  ] as const)("%s throws a clear error", async (name, hook) => {
    await expect(renderHook(() => hook())).rejects.toThrow(
      `${name} must be used inside AppStateProvider`,
    )
  })
})

describe("AppStateProvider", () => {
  let tree: renderer.ReactTestRenderer | null = null
  const originalConsoleError = console.error

  beforeAll(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("react-test-renderer is deprecated")) return
      if (message.includes("not configured to support act")) return
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
    await act(async () => {
      tree = renderer.create(
        <AppStateProvider>
          <Probe />
        </AppStateProvider>,
      )
    })
    await settle()
  })

  afterAll(async () => {
    const mounted = tree
    if (mounted) {
      await act(async () => {
        mounted.unmount()
      })
    }
    jest.restoreAllMocks()
  })

  test("renders its children with all six values and loads the local surveys", () => {
    const snapshot = latest()
    expect(snapshot.session.state.isAuthenticated).toBe(true)
    expect(snapshot.session.state.apiUrl).toEqual(expect.any(String))
    expect(snapshot.accessToken).toBe("token-ctx")
    expect(snapshot.surveys.state.surveys.map((survey) => survey.id)).toEqual(["s-01"])
    expect(snapshot.surveys.state.ownSurveyIds).toEqual(["s-01"])
    expect(snapshot.surveys.state.surveyStats.total).toBe(1)
    expect(snapshot.form.state.siteName).toBe("")
  })

  test("calls useSurveySync exactly once per provider render", async () => {
    const before = mockUseSurveySyncCalls.count
    const probeRendersBefore = snapshots.length
    await act(async () => {
      mockCaptured.reportStatus?.("session", "idle", "one render")
    })
    // One provider render, one probe render, one assembler call.
    expect(snapshots.length - probeRendersBefore).toBe(1)
    expect(mockUseSurveySyncCalls.count - before).toBe(1)
  })

  test("the session value holds no access token", () => {
    const { state } = latest().session
    expect(state).not.toHaveProperty("accessToken")
    expect(Object.values(state)).not.toContain("token-ctx")
  })

  test("a status update changes only the status value", async () => {
    const before = latest()
    await act(async () => {
      mockCaptured.reportStatus?.("session", "idle", "status only")
    })
    const after = latest()
    expect(after.status.status).toBe("status only")
    expect(after.status).not.toBe(before.status)
    expect(after.session).toBe(before.session)
    expect(after.syncActions).toBe(before.syncActions)
    expect(after.surveys).toBe(before.surveys)
    expect(after.form).toBe(before.form)
  })

  test("a form keystroke changes only the form value", async () => {
    const before = latest()
    await act(async () => {
      mockCaptured.setSiteName?.("a")
    })
    const after = latest()
    expect(after.form.state.siteName).toBe("a")
    expect(after.form).not.toBe(before.form)
    expect(after.form.actions).toBe(before.form.actions)
    expect(after.session).toBe(before.session)
    expect(after.status).toBe(before.status)
    expect(after.syncActions).toBe(before.syncActions)
    expect(after.surveys).toBe(before.surveys)
  })

  test("the sync-actions value never changed identity", () => {
    const first = snapshots[0].syncActions
    expect(snapshots.every((snapshot) => snapshot.syncActions === first)).toBe(true)
    expect(
      snapshots.every((snapshot) => snapshot.surveys.actions === snapshots[0].surveys.actions),
    ).toBe(true)
    expect(
      snapshots.every((snapshot) => snapshot.session.actions === snapshots[0].session.actions),
    ).toBe(true)
  })

  test("openSurvey selects the survey, resets the tab and reports a status", async () => {
    await act(async () => {
      latest().surveys.actions.setSurveyDetailTab("events")
    })
    await act(async () => {
      latest().surveys.actions.openSurvey("s-01")
    })
    const snapshot = latest()
    expect(snapshot.surveys.state.selectedSurveyId).toBe("s-01")
    expect(snapshot.surveys.state.surveyDetailTab).toBe("summary")
    expect(snapshot.status.status).toBe("Survey s-01 opened")

    await act(async () => {
      latest().surveys.actions.closeSurveyDetailSelection()
    })
    expect(latest().surveys.state.selectedSurveyId).toBeNull()
  })

  test("setApiUrl updates the session apiUrl", async () => {
    await act(async () => {
      latest().session.actions.setApiUrl("http://example.test/v1")
    })
    expect(latest().session.state.apiUrl).toBe("http://example.test/v1")
  })
})

// ─── Part 3: the App shell overlays read the session context ─────────────────

describe("App shell overlays", () => {
  const originalConsoleError = console.error
  const savedUser = mockSession.currentUser

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("react-test-renderer is deprecated")) return
      if (message.includes("not configured to support act")) return
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
  })

  afterEach(() => {
    mockSession.isAuthenticated = true
    mockSession.currentUser = savedUser
    mockLocalDataOwner.status = "ok"
    for (const key of Object.keys(mockOverlayProps)) delete mockOverlayProps[key]
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  async function mountApp(): Promise<renderer.ReactTestRenderer> {
    let tree: renderer.ReactTestRenderer | null = null
    await act(async () => {
      tree = renderer.create(<App />)
    })
    await settle()
    if (!tree) throw new Error("App did not mount")
    return tree
  }

  async function unmount(tree: renderer.ReactTestRenderer): Promise<void> {
    await act(async () => {
      tree.unmount()
    })
  }

  test("shows no overlay for a signed-in user with a name", async () => {
    const tree = await mountApp()
    expect(Object.keys(mockOverlayProps)).toEqual([])
    await unmount(tree)
  })

  test("shows the auth gate when signed out", async () => {
    mockSession.isAuthenticated = false
    const tree = await mountApp()
    const props = mockOverlayProps.authGate
    expect(props).toBeDefined()
    expect(props.onLogin).toEqual(expect.any(Function))
    await act(async () => {
      ;(props.onApiUrlChange as (value: string) => void)("http://gate.test/v1")
    })
    expect(mockOverlayProps.authGate.apiUrl).toBe("http://gate.test/v1")
    await unmount(tree)
  })

  test("shows the owner-conflict overlay and wires its two actions", async () => {
    mockLocalDataOwner.status = "conflict"
    const tree = await mountApp()
    const props = mockOverlayProps.ownerConflict
    expect(props).toBeDefined()
    expect(mockOverlayProps.profileSetup).toBeUndefined()

    mockSession.handleLogout.mockClear()
    await act(async () => {
      ;(props.onSwitchAccount as () => void)()
    })
    expect(mockSession.handleLogout).toHaveBeenCalledTimes(1)

    const { Alert } = jest.requireMock("react-native") as { Alert: { alert: jest.Mock } }
    Alert.alert.mockClear()
    await act(async () => {
      ;(props.onDiscard as () => void)()
    })
    expect(Alert.alert).toHaveBeenCalledTimes(1)
    await unmount(tree)
  })

  test("shows the profile setup for a user without a name; save and skip are wired", async () => {
    mockSession.currentUser = { ...savedUser, first_name: "", last_name: "" }
    const tree = await mountApp()
    const props = mockOverlayProps.profileSetup
    expect(props).toBeDefined()

    await act(async () => {
      await (props.onSave as (first: string, last: string) => Promise<void>)("Ada", "Lovelace")
    })
    const api = jest.requireMock("../api/ibp-api") as Record<string, jest.Mock>
    expect(api.patchMyProfile).toHaveBeenCalledWith(
      expect.any(String),
      "token-ctx",
      expect.objectContaining({ first_name: "Ada", last_name: "Lovelace" }),
    )

    delete mockOverlayProps.profileSetup
    await act(async () => {
      ;(props.onSkip as () => void)()
    })
    expect(mockOverlayProps.profileSetup).toBeUndefined()
    await unmount(tree)
  })
})
