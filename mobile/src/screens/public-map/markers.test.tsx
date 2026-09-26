/**
 * Memoised map markers (D-05, D-07): a parent re-render with the same props does
 * not re-render a marker, the callbacks receive ids, and the accessibility
 * labels come from the catalogue with scores and counts only (T-01.9-50).
 */
import React, { useState } from "react"
import renderer, { act, type ReactTestRenderer } from "react-test-renderer"
import { fr } from "../../i18n"
import { ClusterMarker } from "./ClusterMarker"
import { SurveyMarker } from "./SurveyMarker"

const mockMarkerRenders: { count: number } = { count: 0 }

jest.mock("react-native", () => {
  const ReactRef = require("react") as typeof import("react")
  const mockComponent =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
  return {
    Text: mockComponent("Text"),
    View: mockComponent("View"),
    StyleSheet: { create: <T,>(styles: T): T => styles, absoluteFill: {} },
  }
})

jest.mock("react-native-maps", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    Marker: ({ children, ...props }: { children?: React.ReactNode }) => {
      mockMarkerRenders.count += 1
      return ReactRef.createElement("Marker", props, children)
    },
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

beforeEach(() => {
  mockMarkerRenders.count = 0
})

const COORDINATE = { latitude: 45.76, longitude: 4.84 }

function mount(element: React.ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined
  act(() => {
    tree = renderer.create(element)
  })
  return tree as ReactTestRenderer
}

function markerProps(tree: ReactTestRenderer) {
  return tree.root.findByType("Marker" as never).props as Record<string, unknown>
}

describe("SurveyMarker", () => {
  test("does not re-render when its parent re-renders with identical props", () => {
    const onSelect = jest.fn()
    let bump: () => void = () => undefined
    function Parent() {
      const [tick, setTick] = useState(0)
      bump = () => setTick((value) => value + 1)
      return (
        <>
          <SurveyMarker
            id="s-1"
            // A new object with the same values on each render, as the cluster list builds it.
            coordinate={{ ...COORDINATE }}
            ibpTotal={30}
            selected={false}
            onSelect={onSelect}
          />
          {tick >= 0 ? null : null}
        </>
      )
    }

    mount(<Parent />)
    expect(mockMarkerRenders.count).toBe(1)
    act(() => bump())
    act(() => bump())
    expect(mockMarkerRenders.count).toBe(1)
  })

  test("re-renders when the selection or the position changes", () => {
    const onSelect = jest.fn()
    const tree = mount(
      <SurveyMarker id="s-1" coordinate={COORDINATE} ibpTotal={30} selected={false} onSelect={onSelect} />,
    )
    act(() => {
      tree.update(
        <SurveyMarker id="s-1" coordinate={COORDINATE} ibpTotal={30} selected onSelect={onSelect} />,
      )
    })
    act(() => {
      tree.update(
        <SurveyMarker
          id="s-1"
          coordinate={{ latitude: 45.77, longitude: 4.84 }}
          ibpTotal={30}
          selected
          onSelect={onSelect}
        />,
      )
    })
    expect(mockMarkerRenders.count).toBe(3)
    expect(markerProps(tree).zIndex).toBe(3)
  })

  test("passes its id to onSelect and labels itself with the score, not the id", () => {
    const onSelect = jest.fn()
    const tree = mount(
      <SurveyMarker id="s-42" coordinate={COORDINATE} ibpTotal={27} selected={false} onSelect={onSelect} />,
    )
    const props = markerProps(tree)
    ;(props.onPress as () => void)()
    expect(onSelect).toHaveBeenCalledWith("s-42")
    expect(props.accessibilityLabel).toBe(fr.publicMap.a11y.surveyMarker(27))
    expect(String(props.accessibilityLabel)).not.toContain("s-42")
    expect(props.coordinate).toEqual(COORDINATE)
  })
})

describe("ClusterMarker", () => {
  test("renders tracksViewChanges false, a count label and its count", () => {
    const onPress = jest.fn()
    const tree = mount(
      <ClusterMarker clusterId={7} coordinate={COORDINATE} count={12} onPress={onPress} />,
    )
    const props = markerProps(tree)
    expect(props.tracksViewChanges).toBe(false)
    expect(props.accessibilityLabel).toBe(fr.publicMap.a11y.cluster(12))
    expect(props.accessibilityLabel).toBe("Groupe de 12 relevés")
    expect(tree.root.findByType("Text" as never).props.children).toBe("12")
    ;(props.onPress as () => void)()
    expect(onPress).toHaveBeenCalledWith(7)
  })

  test("caps the displayed count and does not re-render on identical props", () => {
    const onPress = jest.fn()
    const tree = mount(
      <ClusterMarker clusterId={8} coordinate={COORDINATE} count={150} onPress={onPress} />,
    )
    expect(tree.root.findByType("Text" as never).props.children).toBe("99+")
    act(() => {
      tree.update(
        <ClusterMarker clusterId={8} coordinate={{ ...COORDINATE }} count={150} onPress={onPress} />,
      )
    })
    expect(mockMarkerRenders.count).toBe(1)
  })
})

describe("fr.publicMap", () => {
  test("uses singular and plural forms", () => {
    expect(fr.publicMap.count(0)).toBe("Aucun relevé public")
    expect(fr.publicMap.count(1)).toBe("1 relevé public")
    expect(fr.publicMap.count(3)).toBe("3 relevés publics")
    expect(fr.publicMap.a11y.cluster(1)).toBe("Groupe de 1 relevé")
    expect(fr.publicMap.clusterList.title(1)).toBe("1 relevé à cet endroit")
    expect(fr.publicMap.clusterList.title(4)).toBe("4 relevés à cet endroit")
  })
})
