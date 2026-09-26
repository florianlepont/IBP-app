/**
 * Route component tests (phase 01.9-18, D-01).
 *
 * Each route is rendered inside hand-built context values, with its screen
 * replaced by a probe that records the props. The tests check that the route
 * passes the context data through, that its navigation callbacks call the
 * right action and then navigate, and that the map route reloads on the
 * Explorer tab signal.
 */

import React from "react"
import renderer, { act } from "react-test-renderer"

const mockPlatform = { OS: "android" as "android" | "ios" }

jest.mock("react-native", () => ({
  Platform: mockPlatform,
  StyleSheet: { create: <T,>(value: T): T => value },
  View: "View",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
}))

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}))

const mockScreenProps: Record<string, Record<string, unknown>> = {}

function mockScreen(name: string) {
  return function ScreenProbe(props: Record<string, unknown>) {
    mockScreenProps[name] = props
    return null
  }
}

jest.mock("../../screens/HomeScreen", () => ({ HomeScreen: mockScreen("home") }))
jest.mock("../../screens/SurveyListScreen", () => ({
  SurveyListScreen: mockScreen("surveyList"),
}))
jest.mock("../../screens/SurveyDetailScreen", () => ({
  SurveyDetailScreen: mockScreen("surveyDetail"),
}))
jest.mock("../../screens/SurveyFormScreen", () => ({
  SurveyFormScreen: mockScreen("surveyForm"),
}))
jest.mock("../../screens/FactorDetailScreen", () => ({
  FactorDetailScreen: mockScreen("factorDetail"),
}))
jest.mock("../../screens/SurveyParcelSelectionScreen", () => ({
  SurveyParcelSelectionScreen: mockScreen("parcelSelection"),
}))
jest.mock("../../screens/PublicMapScreen", () => ({ PublicMapScreen: mockScreen("publicMap") }))
jest.mock("../../screens/AccountScreen", () => ({ AccountScreen: mockScreen("account") }))
jest.mock("../../screens/SettingsScreen", () => ({ SettingsScreen: mockScreen("settings") }))

const mockExplorer = {
  items: [],
  parcelStatuses: [],
  loading: false,
  parcelsLoading: false,
  fromDate: "",
  toDate: "",
  region: "",
  setFromDate: jest.fn(),
  setToDate: jest.fn(),
  setRegion: jest.fn(),
  loadPublicMap: jest.fn(async () => undefined),
  loadPublicParcels: jest.fn(async () => undefined),
}
const mockExplorerArgs: { apiUrl?: string; onStatusChange?: unknown } = {}

jest.mock("../../hooks/usePublicMapExplorer", () => ({
  usePublicMapExplorer: (args: { apiUrl: string; onStatusChange: unknown }) => {
    mockExplorerArgs.apiUrl = args.apiUrl
    mockExplorerArgs.onStatusChange = args.onStatusChange
    return mockExplorer
  },
}))

import { fr, type StatusMessage } from "../../i18n"
import { AccessTokenProvider, SessionProvider } from "../../state/session-context"
import type { SessionContextValue } from "../../state/session-context"
import { StatusProvider } from "../../state/status-context"
import { SyncActionsProvider, type SyncActions } from "../../state/sync-actions-context"
import {
  SurveyActionsProvider,
  SurveysProvider,
  type SurveysContextValue,
} from "../../state/surveys-context"
import { SurveyFormProvider, type SurveyFormContextValue } from "../../state/survey-form-context"
import {
  NearbyParcelsProvider,
  type NearbyParcelsContextValue,
} from "../../state/nearby-parcels-context"
import { PublicMapReloadContext, createPublicMapReloadSignal } from "../public-map-reload"
import { SurveysStackConfigContext } from "../stacks/surveys-stack-config"
import { AccountRoute } from "./AccountRoute"
import { FactorDetailRoute } from "./FactorDetailRoute"
import { HomeRoute } from "./HomeRoute"
import { ParcelSelectionRoute } from "./ParcelSelectionRoute"
import { PublicMapRoute } from "./PublicMapRoute"
import { SettingsRoute } from "./SettingsRoute"
import { SurveyDetailRoute } from "./SurveyDetailRoute"
import { SurveyFormRoute } from "./SurveyFormRoute"
import { SurveyListRoute } from "./SurveyListRoute"

/** An action object whose members are jest.fn()s created on first access. */
function actionsProxy<T extends object>(defaults: Record<string, unknown> = {}): T {
  const fns: Record<string, jest.Mock> = {}
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop !== "string") return undefined
      if (!(prop in fns)) {
        const result = prop in defaults ? defaults[prop] : undefined
        fns[prop] = jest.fn(async () => result)
      }
      return fns[prop]
    },
  })
}

type Fixture = {
  session: SessionContextValue
  accessToken: string | null
  status: StatusMessage
  syncActions: SyncActions
  surveys: SurveysContextValue
  form: SurveyFormContextValue
  nearby: NearbyParcelsContextValue
}

const survey = {
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
}

function makeFixture(overrides: { startEdit?: boolean; saved?: boolean } = {}): Fixture {
  const startEdit = overrides.startEdit ?? true
  const saved = overrides.saved ?? true
  return {
    session: {
      state: {
        apiUrl: "http://api.test/v1",
        isAuthenticated: true,
        sessionRestoring: false,
        currentUser: null,
        profile: "p",
        profileUpdating: false,
        localDataOwnerStatus: "ok",
        foreignWork: { surveys: 0, attachments: 0 },
        foreignOwnerEmail: null,
      } as unknown as SessionContextValue["state"],
      actions: actionsProxy(),
    },
    accessToken: "token-1",
    status: fr.status.session.ready(),
    syncActions: actionsProxy(),
    surveys: {
      state: {
        surveys: [survey],
        visibleSurveys: [],
        selectedSurveyId: null,
        selectedSurvey: null,
        selectedSurveyAttachments: [],
        attachmentsBySurvey: {},
        surveyQuery: "",
        surveyFromDate: "",
        surveyToDate: "",
        statusFilter: "all",
        visibilityFilter: "all",
        syncFilter: "all",
        blockedFilter: "all",
        attachmentFilter: "all",
        sortMode: "updated_desc",
        surveyDetails: {},
        detailsLoadingSurveyId: null,
        surveyEvents: {},
        eventsLoadingSurveyId: null,
        surveyStats: {
          total: 1,
          draft: 1,
          submitted: 0,
          pending: 0,
          synced: 1,
          failed: 0,
          blocked: 0,
        },
        ownSurveyIds: ["s-01"],
        surveyDetailTab: "summary",
        editingSurveyId: null,
        formMode: "create",
      } as unknown as SurveysContextValue["state"],
      actions: actionsProxy({ startEditSurvey: startEdit }),
    },
    form: {
      state: {
        siteName: "Site",
        regionVersion: "ACA",
        vegetationStage: "",
        gpsLocation: { lat: "", lng: "", collected_at: "" },
        selectedParcelIds: ["p-1"],
        factorSections: { A: [{ key: "a1" }] },
        factorRetainedScores: { A: null },
        formErrors: { siteName: null },
        draftInput: {},
        formMode: "create",
        editingSurveyId: null,
      } as unknown as SurveyFormContextValue["state"],
      actions: actionsProxy({ saveSurveyEdits: saved, createDraft: saved }),
    },
    nearby: {
      state: {
        parcels: [],
        sectorAvgScore: null,
        loading: false,
        locationDenied: false,
        error: false,
      },
      load: jest.fn(async () => undefined),
    },
  }
}

function Providers({ fixture, children }: { fixture: Fixture; children: React.ReactNode }) {
  return (
    <SessionProvider value={fixture.session}>
      <AccessTokenProvider value={{ accessToken: fixture.accessToken }}>
        <StatusProvider value={{ status: fixture.status }}>
          <SyncActionsProvider value={fixture.syncActions}>
            <SurveysProvider value={fixture.surveys}>
              <SurveyActionsProvider value={fixture.surveys.actions}>
                <SurveyFormProvider value={fixture.form}>
                  <NearbyParcelsProvider value={fixture.nearby}>{children}</NearbyParcelsProvider>
                </SurveyFormProvider>
              </SurveyActionsProvider>
            </SurveysProvider>
          </SyncActionsProvider>
        </StatusProvider>
      </AccessTokenProvider>
    </SessionProvider>
  )
}

function makeNavigation() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }
}

async function mount(element: React.ReactElement): Promise<renderer.ReactTestRenderer> {
  let tree: renderer.ReactTestRenderer | null = null
  await act(async () => {
    tree = renderer.create(element)
  })
  return tree as unknown as renderer.ReactTestRenderer
}

function props(name: string): Record<string, unknown> {
  const value = mockScreenProps[name]
  if (!value) throw new Error(`${name} did not render`)
  return value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any

function callback(name: string, key: string): AnyFn {
  return props(name)[key] as AnyFn
}

const originalConsoleError = console.error

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0] ?? "").includes("react-test-renderer is deprecated")) return
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

beforeEach(() => {
  for (const key of Object.keys(mockScreenProps)) delete mockScreenProps[key]
  mockPlatform.OS = "android"
  mockExplorer.loadPublicMap.mockClear()
})

describe("SettingsRoute", () => {
  test("passes the status, the session and the sync actions", async () => {
    const fixture = makeFixture()
    await mount(
      <Providers fixture={fixture}>
        <SettingsRoute navigation={makeNavigation() as never} route={{} as never} />
      </Providers>,
    )
    const settings = props("settings")
    expect(settings.status).toBe(fr.status.session.ready())
    expect(settings.apiUrl).toBe("http://api.test/v1")
    expect(settings.onApiUrlChange).toBe(fixture.session.actions.setApiUrl)
    expect(settings.onSync).toBe(fixture.syncActions.handleSync)
    expect(settings.onRefreshLocalList).toBe(fixture.syncActions.refreshLocalSurveys)
    expect(settings.onDeleteAccount).toBe(fixture.session.actions.handleDeleteAccount)
  })
})

describe("AccountRoute", () => {
  test("passes the access token, or an empty string without one", async () => {
    const fixture = makeFixture()
    await mount(
      <Providers fixture={fixture}>
        <AccountRoute navigation={makeNavigation() as never} route={{} as never} />
      </Providers>,
    )
    expect(props("account").accessToken).toBe("token-1")
    expect(props("account").onLogout).toBe(fixture.session.actions.handleLogout)

    await mount(
      <Providers fixture={{ ...fixture, accessToken: null }}>
        <AccountRoute navigation={makeNavigation() as never} route={{} as never} />
      </Providers>,
    )
    expect(props("account").accessToken).toBe("")
  })
})

describe("HomeRoute", () => {
  test("opens the form, a survey and the explorer through the tab navigator", async () => {
    const fixture = makeFixture()
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <HomeRoute navigation={navigation as never} route={{} as never} />
      </Providers>,
    )
    expect(props("home").nearbyParcels).toBe(fixture.nearby.state)
    expect(props("home").onLoadNearbyParcels).toBe(fixture.nearby.load)
    expect(props("home").surveys).toBe(fixture.surveys.state.surveys)

    callback("home", "onCreateSurvey")()
    expect(fixture.surveys.actions.openCreateSurvey).toHaveBeenCalled()
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveys", { screen: "surveyForm" })

    callback("home", "onOpenSurvey")("s-01")
    expect(fixture.surveys.actions.openSurvey).toHaveBeenCalledWith("s-01")
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveys", { screen: "surveyDetail" })

    callback("home", "onNavigateToExplorer")()
    expect(navigation.navigate).toHaveBeenLastCalledWith("publicMap")
  })
})

describe("SurveyListRoute", () => {
  test("opens the form and a survey, with the filtered list and inline search", async () => {
    const fixture = makeFixture()
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <SurveyListRoute navigation={navigation as never} route={{} as never} />
      </Providers>,
    )
    const list = props("surveyList")
    expect(list.visibleSurveys).toBe(fixture.surveys.state.visibleSurveys)
    expect(list.showInlineSearch).toBe(true)
    expect(list.useNativeSearchUI).toBe(false)
    expect(navigation.setOptions).not.toHaveBeenCalled()

    callback("surveyList", "onOpenCreateSurvey")()
    expect(fixture.surveys.actions.openCreateSurvey).toHaveBeenCalled()
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveyForm")

    callback("surveyList", "onOpenSurvey")("s-01")
    expect(fixture.surveys.actions.openSurvey).toHaveBeenCalledWith("s-01")
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveyDetail")
  })

  test("with the native tab bar outside iOS it keeps the inline search", async () => {
    mockPlatform.OS = "android"
    const fixture = makeFixture()
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <SurveysStackConfigContext.Provider value={{ useNativeNav: true }}>
          <SurveyListRoute navigation={navigation as never} route={{} as never} />
        </SurveysStackConfigContext.Provider>
      </Providers>,
    )
    expect(props("surveyList").visibleSurveys).toBe(fixture.surveys.state.visibleSurveys)
    expect(props("surveyList").showInlineSearch).toBe(true)
    expect(props("surveyList").useNativeSearchUI).toBe(false)
    expect(navigation.setOptions).not.toHaveBeenCalled()
  })

  test("in the native iOS Mes Relevés tab it owns the header search bar and syncs its text", async () => {
    mockPlatform.OS = "ios"
    const fixture = makeFixture()
    const navigation = makeNavigation()
    const nativeConfig = { useNativeNav: true }
    const route = (query: string) => (
      <Providers
        fixture={{
          ...fixture,
          surveys: { ...fixture.surveys, state: { ...fixture.surveys.state, surveyQuery: query } },
        }}
      >
        <SurveysStackConfigContext.Provider value={nativeConfig}>
          <SurveyListRoute navigation={navigation as never} route={{} as never} />
        </SurveysStackConfigContext.Provider>
      </Providers>
    )
    const tree = await mount(route(""))
    expect(props("surveyList").useNativeSearchUI).toBe(true)
    expect(props("surveyList").showInlineSearch).toBe(false)
    expect(props("surveyList").visibleSurveys).toBe(fixture.surveys.state.visibleSurveys)
    expect(navigation.setOptions).toHaveBeenCalledTimes(1)

    const options = navigation.setOptions.mock.calls[0][0].headerSearchBarOptions
    expect(options.placeholder).toBe(fr.navigation.search.placeholder)
    expect(options.placement).toBe("automatic")
    options.onChangeText({ nativeEvent: { text: "chêne" } })
    expect(fixture.surveys.actions.setSurveyQuery).toHaveBeenLastCalledWith("chêne")
    options.onCancelButtonPress()
    expect(fixture.surveys.actions.setSurveyQuery).toHaveBeenLastCalledWith("")

    const bar = { setText: jest.fn(), clearText: jest.fn() }
    options.ref.current = bar
    await act(async () => {
      tree.update(route("chêne"))
    })
    expect(bar.setText).toHaveBeenCalledWith("chêne")
    await act(async () => {
      tree.update(route("  "))
    })
    expect(bar.clearText).toHaveBeenCalled()
  })
})

describe("SurveyDetailRoute", () => {
  test("renders nothing until a survey is selected", async () => {
    await mount(
      <Providers fixture={makeFixture()}>
        <SurveyDetailRoute navigation={makeNavigation() as never} route={{} as never} />
      </Providers>,
    )
    expect(mockScreenProps.surveyDetail).toBeUndefined()
  })

  function withSelection(fixture: Fixture): Fixture {
    return {
      ...fixture,
      surveys: {
        ...fixture.surveys,
        state: { ...fixture.surveys.state, selectedSurveyId: "s-01", selectedSurvey: survey },
      } as unknown as SurveysContextValue,
    }
  }

  test("opens a factor or the parcels once the survey is loaded for editing", async () => {
    const fixture = withSelection(makeFixture())
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <SurveyDetailRoute navigation={navigation as never} route={{} as never} />
      </Providers>,
    )
    expect(props("surveyDetail").apiUrl).toBe("http://api.test/v1")
    expect(props("surveyDetail").onSubmitSurvey).toBe(fixture.surveys.actions.submitSurvey)
    expect(props("surveyDetail").onSimulateMissingAttachmentFile).toBe(
      fixture.syncActions.handleSimulateMissingAttachmentFile,
    )

    await act(async () => {
      await callback("surveyDetail", "onOpenFactor")("s-01", "B")
    })
    expect(fixture.surveys.actions.startEditSurvey).toHaveBeenCalledWith("s-01")
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveyFactorDetail", { factor: "B" })

    await act(async () => {
      await callback("surveyDetail", "onOpenParcels")("s-01")
    })
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveyParcels", {
      surveyId: "s-01",
      mode: "edit",
    })
  })

  test("does not navigate when the survey cannot be loaded", async () => {
    const fixture = withSelection(makeFixture({ startEdit: false }))
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <SurveyDetailRoute navigation={navigation as never} route={{} as never} />
      </Providers>,
    )
    await act(async () => {
      await callback("surveyDetail", "onOpenFactor")("s-01", "B")
      await callback("surveyDetail", "onOpenParcels")("s-01")
    })
    expect(navigation.navigate).not.toHaveBeenCalled()
  })
})

describe("SurveyFormRoute", () => {
  test("sets the create title, opens a factor and the parcel map, and goes back after saving", async () => {
    const fixture = makeFixture()
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <SurveyFormRoute navigation={navigation as never} route={{} as never} />
      </Providers>,
    )
    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      title: fr.navigation.headers.newSurvey,
    })
    expect(props("surveyForm").screen).toBe("create")
    expect(props("surveyForm")).not.toHaveProperty("status")

    callback("surveyForm", "onOpenFactor")("C")
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveyFactorDetail", { factor: "C" })
    callback("surveyForm", "onOpenParcelFullscreen")()
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveyParcels", {
      surveyId: "draft",
      mode: "wizard",
    })

    await act(async () => {
      await callback("surveyForm", "onSaveSurveyEdits")()
      await callback("surveyForm", "onCreateDraft")()
    })
    expect(fixture.form.actions.saveSurveyEdits).toHaveBeenCalled()
    expect(fixture.form.actions.createDraft).toHaveBeenCalled()
    expect(navigation.goBack).toHaveBeenCalledTimes(2)
  })

  test("sets the edit title, uses the edited survey id and stays when saving fails", async () => {
    const base = makeFixture({ saved: false })
    const fixture: Fixture = {
      ...base,
      form: {
        ...base.form,
        state: { ...base.form.state, formMode: "edit", editingSurveyId: "s-01" },
      },
    }
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <SurveyFormRoute navigation={navigation as never} route={{} as never} />
      </Providers>,
    )
    expect(navigation.setOptions).toHaveBeenLastCalledWith({
      title: fr.navigation.headers.editSurvey,
    })
    expect(props("surveyForm").screen).toBe("edit")
    callback("surveyForm", "onOpenParcelFullscreen")()
    expect(navigation.navigate).toHaveBeenLastCalledWith("surveyParcels", {
      surveyId: "s-01",
      mode: "wizard",
    })
    await act(async () => {
      await callback("surveyForm", "onSaveSurveyEdits")()
      await callback("surveyForm", "onCreateDraft")()
    })
    expect(navigation.goBack).not.toHaveBeenCalled()
  })
})

describe("FactorDetailRoute and ParcelSelectionRoute", () => {
  test("the factor detail shows the fields of the route's factor", async () => {
    const fixture = makeFixture()
    await mount(
      <Providers fixture={fixture}>
        <FactorDetailRoute
          navigation={makeNavigation() as never}
          route={{ params: { factor: "A" } } as never}
        />
      </Providers>,
    )
    expect(props("factorDetail").factor).toBe("A")
    expect(props("factorDetail").fields).toBe(
      (fixture.form.state.factorSections as Record<string, unknown>).A,
    )
  })

  test("the parcel selection hides Done in the wizard and goes back after saving", async () => {
    const fixture = makeFixture()
    const navigation = makeNavigation()
    await mount(
      <Providers fixture={fixture}>
        <ParcelSelectionRoute
          navigation={navigation as never}
          route={{ params: { surveyId: "draft", mode: "wizard" } } as never}
        />
      </Providers>,
    )
    expect(props("parcelSelection").hideDoneAction).toBe(true)
    expect(props("parcelSelection").selectedParcelIds).toEqual(["p-1"])
    await act(async () => {
      await callback("parcelSelection", "onSave")()
    })
    expect(navigation.goBack).toHaveBeenCalledTimes(1)

    const failing = makeFixture({ saved: false })
    const stay = makeNavigation()
    await mount(
      <Providers fixture={failing}>
        <ParcelSelectionRoute
          navigation={stay as never}
          route={{ params: { surveyId: "s-01", mode: "edit" } } as never}
        />
      </Providers>,
    )
    expect(props("parcelSelection").hideDoneAction).toBe(false)
    await act(async () => {
      await callback("parcelSelection", "onSave")()
    })
    expect(stay.goBack).not.toHaveBeenCalled()
  })
})

describe("PublicMapRoute", () => {
  test("owns the explorer and reloads on the Explorer tab signal, including a press before mount", async () => {
    const fixture = makeFixture()
    const signal = createPublicMapReloadSignal()
    // The tab press that mounts the route happens before the route exists.
    signal.request()

    const tree = await mount(
      <PublicMapReloadContext.Provider value={signal}>
        <Providers fixture={fixture}>
          <PublicMapRoute navigation={makeNavigation() as never} route={{} as never} />
        </Providers>
      </PublicMapReloadContext.Provider>,
    )
    expect(mockExplorerArgs.apiUrl).toBe("http://api.test/v1")
    expect(mockExplorerArgs.onStatusChange).toBe(fixture.syncActions.setStatus)
    expect(props("publicMap").ownSurveyIds).toEqual(["s-01"])
    expect(props("publicMap").onReportSurvey).toBe(fixture.syncActions.handleReportSurvey)
    expect(mockExplorer.loadPublicMap).toHaveBeenCalledTimes(1)
    // The press that mounted the route is not forced: the screen's first viewport load serves it.
    expect(mockExplorer.loadPublicMap).toHaveBeenLastCalledWith({ bbox: undefined, force: false })

    // Later presses force a reload of the last viewport the screen reported (01.9-28).
    act(() => {
      ;(props("publicMap").onViewportBboxChange as (bbox: string) => void)("1,2,3,4")
    })
    act(() => {
      signal.request()
    })
    expect(mockExplorer.loadPublicMap).toHaveBeenCalledTimes(2)
    expect(mockExplorer.loadPublicMap).toHaveBeenLastCalledWith({ bbox: "1,2,3,4", force: true })

    await act(async () => {
      tree.unmount()
    })
    signal.request()
    expect(mockExplorer.loadPublicMap).toHaveBeenCalledTimes(2)
  })

  test("renders without a reload signal (outside the navigation tree)", async () => {
    await mount(
      <Providers fixture={makeFixture()}>
        <PublicMapRoute navigation={makeNavigation() as never} route={{} as never} />
      </Providers>,
    )
    expect(props("publicMap").loading).toBe(false)
    expect(mockExplorer.loadPublicMap).not.toHaveBeenCalled()
  })
})
