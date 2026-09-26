/**
 * The split public map screen (01.9-28, D-05, D-06, D-07): viewport loading,
 * first-load fit, clusters (zoom or list), selection and report card, locate,
 * controls, and a role and catalogue label on every Pressable.
 */
import React from "react"
import renderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer"
import { computeRegionBbox } from "../../app/map-viewport"
import type { PublicMapItem } from "../../app/types"
import { fr } from "../../i18n"
import { PublicMapScreen } from "../PublicMapScreen"
import { DEFAULT_MAP_REGION, VIEWPORT_DEBOUNCE_MS } from "./useMapViewport"

const mockAnimateToRegion = jest.fn()
const mockAlert = jest.fn()
const mockLocation = {
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}

jest.mock("react-native", () => {
  const ReactRef = require("react") as typeof import("react")
  const mockComponent =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
  return {
    ActivityIndicator: mockComponent("ActivityIndicator"),
    Pressable: mockComponent("Pressable"),
    ScrollView: mockComponent("ScrollView"),
    Text: mockComponent("Text"),
    View: mockComponent("View"),
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    StyleSheet: { create: <T,>(styles: T): T => styles, absoluteFill: {} },
  }
})

jest.mock("react-native-maps", () => {
  const ReactRef = require("react") as typeof import("react")
  const MapView = ReactRef.forwardRef(function MapView(
    { children, ...props }: { children?: React.ReactNode },
    ref: React.Ref<unknown>,
  ) {
    ReactRef.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }))
    return ReactRef.createElement("MapView", props, children)
  })
  return {
    __esModule: true,
    default: MapView,
    Marker: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement("Marker", props, children),
  }
})

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: () => mockLocation.requestForegroundPermissionsAsync(),
  getCurrentPositionAsync: () => mockLocation.getCurrentPositionAsync(),
  Accuracy: { Balanced: 3 },
}))
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 10, left: 0, right: 0 }),
}))
jest.mock("../../app/useAppBottomTabBarHeight", () => ({ useAppBottomTabBarHeight: () => 50 }))
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }))
jest.mock("../../components/IgnCadastreTileOverlay", () => ({
  IgnCadastreTileOverlay: "IgnCadastreTileOverlay",
}))
jest.mock("../../components/ParcelOverlayPolygons", () => ({
  ParcelOverlayPolygons: "ParcelOverlayPolygons",
}))
jest.mock("../../ui/AppButton", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      ReactRef.createElement("AppButton", { label, onPress }),
  }
})
jest.mock("../../ui/AppCard", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppCard: ({ children }: { children?: React.ReactNode }) =>
      ReactRef.createElement("AppCard", null, children),
  }
})
jest.mock("../../ui/AppField", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppField: (props: { label: string; onChangeText: (value: string) => void }) =>
      ReactRef.createElement("AppField", props),
  }
})
jest.mock("../../ui/AppNotice", () => ({ AppNotice: "AppNotice" }))
jest.mock("../../ui/AppSectionHeader", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppSectionHeader: ({ title, trailing }: { title: string; trailing?: React.ReactNode }) =>
      ReactRef.createElement("AppSectionHeader", { title }, trailing),
  }
})

const originalConsoleError = console.error

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const message = String(args[0] ?? "")
    if (message.includes("react-test-renderer is deprecated")) return
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

function item(id: string, lat: number, lng: number, ibp = 30): PublicMapItem {
  return {
    survey_id: id,
    display_location: { lat, lng },
    survey_date: "2026-05-01",
    region_code: "ARA",
    ibp_total: ibp,
  }
}

type ScreenProps = React.ComponentProps<typeof PublicMapScreen>

function makeProps(overrides: Partial<ScreenProps> = {}): ScreenProps {
  return {
    items: [],
    parcelStatuses: [],
    ownSurveyIds: [],
    loading: false,
    parcelsLoading: false,
    fromDate: "",
    toDate: "",
    region: "",
    onChangeFromDate: jest.fn(),
    onChangeToDate: jest.fn(),
    onChangeRegion: jest.fn(),
    onLoad: jest.fn(async () => undefined),
    onLoadParcels: jest.fn(async () => undefined),
    onReportSurvey: jest.fn(async () => ({ ok: true, message: "Signalement envoyé" })),
    onViewportBboxChange: jest.fn(),
    ...overrides,
  }
}

let tree: ReactTestRenderer

function mount(props: ScreenProps) {
  act(() => {
    tree = renderer.create(<PublicMapScreen {...props} />)
  })
}

function update(props: ScreenProps) {
  act(() => {
    tree.update(<PublicMapScreen {...props} />)
  })
}

function byLabel(label: string): ReactTestInstance {
  return tree.root.find(
    (node) => (node.type as unknown) === "Pressable" && node.props.accessibilityLabel === label,
  )
}

function markers(): ReactTestInstance[] {
  return tree.root.findAll((node) => (node.type as unknown) === "Marker")
}

function texts(): string[] {
  return tree.root
    .findAll((node) => (node.type as unknown) === "Text")
    .map((node) => [node.props.children].flat().join(""))
}

beforeEach(() => {
  mockAnimateToRegion.mockClear()
  mockAlert.mockClear()
  mockLocation.requestForegroundPermissionsAsync.mockReset()
  mockLocation.getCurrentPositionAsync.mockReset()
})

afterEach(() => {
  act(() => tree.unmount())
})

describe("PublicMapScreen", () => {
  test("loads the first viewport by bbox and fits the first items once", () => {
    const props = makeProps()
    mount(props)
    const bbox = computeRegionBbox(DEFAULT_MAP_REGION)
    expect(props.onLoad).toHaveBeenCalledWith({ bbox })
    expect(props.onViewportBboxChange).toHaveBeenCalledWith(bbox)

    const items = [item("a", 45.7, 4.8), item("b", 48.8, 2.3)]
    update({ ...props, items })
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1)
    update({ ...props, items: [item("c", 45.7, 4.8)] })
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1)
    expect(texts()).toContain(fr.publicMap.count(1))
  })

  test("a marker press shows the survey card, which never shows the id", () => {
    const props = makeProps({ items: [item("secret-id", 45.7, 4.8, 27)] })
    mount(props)
    const marker = markers().find(
      (node) => node.props.accessibilityLabel === fr.publicMap.a11y.surveyMarker(27),
    ) as ReactTestInstance
    act(() => marker.props.onPress())

    const header = tree.root.find((node) => (node.type as unknown) === "AppSectionHeader")
    expect(header.props.title).toBe(fr.publicMap.selected.title(27))
    expect(JSON.stringify(tree.toJSON())).not.toContain("secret-id")

    act(() => byLabel(fr.publicMap.a11y.closeSelection).props.onPress())
    expect(tree.root.findAll((node) => (node.type as unknown) === "AppSectionHeader")).toHaveLength(
      0,
    )
  })

  test("the report form sends the reason and shows the result; own surveys cannot be reported", async () => {
    const props = makeProps({ items: [item("s-1", 45.7, 4.8), item("mine", 48.8, 2.3, 12)] })
    props.ownSurveyIds = ["mine"]
    mount(props)
    const select = (ibp: number) =>
      act(() =>
        markers()
          .find((node) => node.props.accessibilityLabel === fr.publicMap.a11y.surveyMarker(ibp))
          ?.props.onPress(),
      )
    const button = (label: string) =>
      tree.root.find((node) => (node.type as unknown) === "AppButton" && node.props.label === label)

    select(12)
    expect(tree.root.findAll((node) => (node.type as unknown) === "AppNotice")).toHaveLength(1)

    select(30)
    act(() => button(fr.publicMap.selected.report).props.onPress())
    act(() => button(fr.common.actions.cancel).props.onPress())
    act(() => button(fr.publicMap.selected.report).props.onPress())
    const field = tree.root.find((node) => (node.type as unknown) === "AppField")
    act(() => field.props.onChangeText("Coordonnées incohérentes"))
    await act(async () => {
      button(fr.publicMap.selected.send).props.onPress()
    })
    expect(props.onReportSurvey).toHaveBeenCalledWith("s-1", "Coordonnées incohérentes")
    expect(texts()).toContain("Signalement envoyé")
  })

  test("a cluster that cannot split opens the list, and a row selects the survey", () => {
    const props = makeProps({
      items: [item("a", 45.76, 4.84, 10), item("b", 45.76, 4.84, 20), item("c", 45.76, 4.84, 30)],
    })
    mount(props)
    const cluster = markers().find(
      (node) => node.props.accessibilityLabel === fr.publicMap.a11y.cluster(3),
    ) as ReactTestInstance
    mockAnimateToRegion.mockClear()
    act(() => cluster.props.onPress())
    expect(mockAnimateToRegion).not.toHaveBeenCalled()
    expect(texts()).toContain(fr.publicMap.clusterList.row({ ibp: 20, date: "2026-05-01" }))

    act(() =>
      byLabel(
        fr.publicMap.a11y.clusterListItem({ ibp: 20, date: "2026-05-01", region: "ARA" }),
      ).props.onPress(),
    )
    const header = tree.root.find((node) => (node.type as unknown) === "AppSectionHeader")
    expect(header.props.title).toBe(fr.publicMap.selected.title(20))

    act(() => cluster.props.onPress())
    act(() => byLabel(fr.publicMap.a11y.closeClusterList).props.onPress())
    expect(texts()).not.toContain(fr.publicMap.clusterList.row({ ibp: 20, date: "2026-05-01" }))
  })

  test("a cluster that can split zooms the camera to its expansion zoom", () => {
    const props = makeProps({ items: [item("a", 45.7, 4.8), item("b", 45.71, 4.81)] })
    mount(props)
    mockAnimateToRegion.mockClear()
    const cluster = markers().find(
      (node) => node.props.accessibilityLabel === fr.publicMap.a11y.cluster(2),
    ) as ReactTestInstance
    act(() => cluster.props.onPress())
    expect(mockAnimateToRegion).toHaveBeenCalledTimes(1)
    const [target, duration] = mockAnimateToRegion.mock.calls[0] as [
      { longitudeDelta: number },
      number,
    ]
    expect(duration).toBe(450)
    expect(target.longitudeDelta).toBeLessThan(DEFAULT_MAP_REGION.longitudeDelta)
  })

  test("controls: filters, apply, refresh and the parcel layer label", () => {
    jest.useFakeTimers()
    try {
      const props = makeProps()
      mount(props)
      act(() => byLabel(fr.publicMap.a11y.showFilters).props.onPress())
      expect(
        byLabel(fr.publicMap.a11y.hideParcels).findByType("Text" as never).props.children,
      ).toBe(fr.publicMap.layer.zoomIn)

      const apply = tree.root.find(
        (node) =>
          (node.type as unknown) === "AppButton" && node.props.label === fr.publicMap.filters.apply,
      )
      act(() => apply.props.onPress())
      expect(props.onLoad).toHaveBeenLastCalledWith({ force: true })

      act(() => byLabel(fr.publicMap.a11y.refresh).props.onPress())
      expect(props.onLoad).toHaveBeenLastCalledWith({
        bbox: computeRegionBbox(DEFAULT_MAP_REGION),
        force: true,
      })

      // Zoom in to parcel level: the cadastre loads after the debounce.
      const map = tree.root.find((node) => (node.type as unknown) === "MapView")
      act(() =>
        map.props.onRegionChangeComplete(
          { latitude: 45.76, longitude: 4.84, latitudeDelta: 0.004, longitudeDelta: 0.004 },
          { isGesture: true },
        ),
      )
      act(() => {
        jest.advanceTimersByTime(VIEWPORT_DEBOUNCE_MS)
      })
      expect(props.onLoadParcels).toHaveBeenCalledTimes(1)
      update({ ...props, parcelsLoading: true })
      expect(texts()).toContain(fr.publicMap.layer.loading)
      update({ ...props, parcelsLoading: false })
      expect(texts()).toContain(fr.publicMap.layer.active)

      act(() => byLabel(fr.publicMap.a11y.hideParcels).props.onPress())
      expect(texts()).toContain(fr.publicMap.layer.hidden)
      update({ ...props, loading: true })
      expect(
        tree.root.findAll((node) => (node.type as unknown) === "ActivityIndicator"),
      ).toHaveLength(1)
      act(() => byLabel(fr.publicMap.a11y.hideFilters).props.onPress())
      expect(tree.root.findAll((node) => (node.type as unknown) === "AppField")).toHaveLength(0)
    } finally {
      jest.useRealTimers()
    }
  })

  test("locate: centres on the position, or explains a refusal or a failure", async () => {
    mount(makeProps())
    const press = async () => {
      await act(async () => {
        byLabel(fr.publicMap.a11y.locate).props.onPress()
      })
    }

    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false })
    await press()
    expect(mockAlert).toHaveBeenLastCalledWith(
      fr.publicMap.alerts.locationDisabled.title,
      fr.publicMap.alerts.locationDisabled.message,
    )

    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error("gps off"))
    await press()
    expect(mockAlert).toHaveBeenLastCalledWith(
      fr.publicMap.alerts.locationUnavailable.title,
      fr.publicMap.alerts.locationUnavailable.message,
    )

    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 45.1, longitude: 5.2 },
    })
    await press()
    expect(mockAnimateToRegion).toHaveBeenLastCalledWith(
      { latitude: 45.1, longitude: 5.2, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      450,
    )
    const position = markers().find(
      (node) => node.props.title === fr.publicMap.currentPosition,
    ) as ReactTestInstance
    expect(position.props.coordinate).toEqual({ latitude: 45.1, longitude: 5.2 })
  })

  test("a second locate press while locating is ignored", async () => {
    mount(makeProps())
    let resolvePermission: (value: { granted: boolean }) => void = () => undefined
    mockLocation.requestForegroundPermissionsAsync.mockReturnValue(
      new Promise((resolve) => {
        resolvePermission = resolve
      }),
    )
    await act(async () => {
      byLabel(fr.publicMap.a11y.locate).props.onPress()
    })
    await act(async () => {
      byLabel(fr.publicMap.a11y.locate).props.onPress()
    })
    expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolvePermission({ granted: false })
    })
  })

  test("every Pressable has a role and a catalogue label (D-07)", () => {
    mount(makeProps({ items: [item("a", 45.76, 4.84), item("b", 45.76, 4.84)] }))
    act(() => byLabel(fr.publicMap.a11y.showFilters).props.onPress())
    const cluster = markers().find(
      (node) => node.props.accessibilityLabel === fr.publicMap.a11y.cluster(2),
    ) as ReactTestInstance
    act(() => cluster.props.onPress())
    const pressables = tree.root.findAll((node) => (node.type as unknown) === "Pressable")
    expect(pressables.length).toBeGreaterThanOrEqual(6)
    for (const pressable of pressables) {
      expect(pressable.props.accessibilityRole).toBe("button")
      expect(typeof pressable.props.accessibilityLabel).toBe("string")
      expect(pressable.props.accessibilityLabel.length).toBeGreaterThan(0)
    }
  })
})
