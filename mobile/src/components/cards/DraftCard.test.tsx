import React from "react"
import renderer, { act, type ReactTestInstance } from "react-test-renderer"
import { DraftCard } from "./DraftCard"
import { brandColors } from "../../app/brand-tokens"
import type { LocalSurvey } from "../../storage/types"

jest.mock("react-native", () => {
  const ReactActual = jest.requireActual<typeof import("react")>("react")
  const mockComponent =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactActual.createElement(name, props, children)

  return {
    Pressable: mockComponent("Pressable"),
    Text: mockComponent("Text"),
    View: mockComponent("View"),
    StyleSheet: { create: <T,>(styles: T): T => styles },
    Platform: {
      OS: "ios",
      select: <T,>(options: { ios?: T; android?: T; default?: T }): T | undefined =>
        options.ios ?? options.default,
    },
  }
})

const originalConsoleError = console.error

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0] ?? "").includes("react-test-renderer is deprecated")) {
      return
    }
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

function makeSurvey(completionRate: number): LocalSurvey {
  return {
    id: "survey-1",
    site_name: "Parcelle A",
    status: "draft",
    visibility: "private",
    sync_version: 1,
    sync_state: "synced",
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    sync_blocked: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: new Date().toISOString(),
    completion_rate: completionRate,
  }
}

type FlatStyle = { width?: string; backgroundColor?: string }

function flattenStyle(style: unknown): FlatStyle {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle)) as FlatStyle
  }
  return (style ?? {}) as FlatStyle
}

function render(completionRate: number) {
  let tree: renderer.ReactTestRenderer | undefined
  act(() => {
    tree = renderer.create(<DraftCard survey={makeSurvey(completionRate)} onPress={jest.fn()} />)
  })
  const root = tree!.root
  const fill = root
    .findAll((node: ReactTestInstance) => (node.type as unknown) === "View")
    .map((node) => flattenStyle(node.props.style))
    .find((style) => typeof style.width === "string")
  const texts = root
    .findAll((node: ReactTestInstance) => (node.type as unknown) === "Text")
    .map((node) => String([node.props.children].flat().join("")))
  return { fill, texts }
}

describe("DraftCard treats completion_rate as 0-100 (01.9 D-03)", () => {
  test("40 renders a 40% bar, 4/10 factors and the in-progress colour", () => {
    const { fill, texts } = render(40)
    expect(fill?.width).toBe("40%")
    expect(texts).toContain("4/10")
    expect(fill?.backgroundColor).toBe(brandColors.ochre)
    expect(fill?.backgroundColor).not.toBe(brandColors.moss)
  })

  test("100 renders a 100% bar, 10/10 factors and the moss colour", () => {
    const { fill, texts } = render(100)
    expect(fill?.width).toBe("100%")
    expect(texts).toContain("10/10")
    expect(fill?.backgroundColor).toBe(brandColors.moss)
  })

  test("0 renders a 0% bar and 0/10 factors", () => {
    const { fill, texts } = render(0)
    expect(fill?.width).toBe("0%")
    expect(texts).toContain("0/10")
    expect(fill?.backgroundColor).toBe(brandColors.ochre)
  })

  test("out-of-range values are clamped to 0-100", () => {
    expect(render(140).fill?.width).toBe("100%")
    expect(render(-5).fill?.width).toBe("0%")
  })
})
