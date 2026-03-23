jest.mock("react-native", () => {
  const ReactRef = require("react") as typeof import("react")
  const mockComponent =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)

  return {
    Alert: { alert: jest.fn() },
    Animated: {
      Value: class {
        constructor(_value: number) {}
      },
      event: jest.fn(() => jest.fn()),
    },
    Button: mockComponent("Button"),
    Image: mockComponent("Image"),
    Keyboard: {
      addListener: jest.fn(() => ({ remove: jest.fn() })),
      dismiss: jest.fn(),
    },
    Modal: mockComponent("Modal"),
    Platform: {
      OS: "ios",
      select: <T>(options: { ios?: T; android?: T; default?: T }): T | undefined =>
        options.ios ?? options.default,
    },
    Pressable: mockComponent("Pressable"),
    ScrollView: mockComponent("ScrollView"),
    StyleSheet: { create: <T extends object>(value: T): T => value },
    Text: mockComponent("Text"),
    TextInput: mockComponent("TextInput"),
    View: mockComponent("View"),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
  }
})

jest.mock("@expo/vector-icons", () => ({
  Ionicons: { glyphMap: {} },
}))

jest.mock("react-native-maps", () => {
  const ReactRef = require("react") as typeof import("react")
  const component = ({ children, ...props }: { children?: React.ReactNode }) =>
    ReactRef.createElement("MapView", props, children)
  return {
    __esModule: true,
    default: component,
    Marker: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement("Marker", props, children),
  }
})

jest.mock("expo-location", () => ({}))

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 0,
}))

jest.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 0,
}))

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock("../components/IgnCadastreTileOverlay", () => ({
  IgnCadastreTileOverlay: () => null,
}))

jest.mock("../components/ParcelOverlayPolygons", () => ({
  ParcelOverlayPolygons: () => null,
}))

jest.mock("../hooks/useParcelStatuses", () => ({
  useParcelStatuses: () => ({ items: [], isLoading: false }),
}))

jest.mock("../storage", () => ({
  getLocalSurveyDraft: jest.fn(),
}))

import { toAddressLabel } from "./SurveyFormScreen"
import { asFiniteNumber, isFactorKey, resolveDisplayCoordinates } from "./SurveyDetailScreen"

describe("Survey screen helpers", () => {
  it("formats address labels by concatenating available parts", () => {
    expect(
      toAddressLabel({
        streetNumber: "12",
        street: "Rue des Chenes",
        postalCode: "75001",
        city: "Paris",
        region: "Ile-de-France",
        country: "France",
      }),
    ).toBe("12 Rue des Chenes - 75001 Paris - Ile-de-France, France")

    expect(
      toAddressLabel({
        city: "Toulouse",
        country: "France",
      }),
    ).toBe("Toulouse - France")
  })

  it("parses finite numbers and resolves display coordinates safely", () => {
    expect(asFiniteNumber(12.5)).toBe(12.5)
    expect(asFiniteNumber("42")).toBe(42)
    expect(asFiniteNumber("not-a-number")).toBeNull()

    expect(resolveDisplayCoordinates({ lat: "48.8566", lng: 2.3522 })).toEqual({
      lat: 48.8566,
      lng: 2.3522,
    })
    expect(resolveDisplayCoordinates({ lat: "x", lng: 2.3522 })).toBeNull()
    expect(resolveDisplayCoordinates(null)).toBeNull()
  })

  it("recognizes valid factor keys only", () => {
    expect(isFactorKey("A")).toBe(true)
    expect(isFactorKey("J")).toBe(true)
    expect(isFactorKey("Z")).toBe(false)
  })
})
