import React from "react"
import renderer, { act } from "react-test-renderer"
import { FACTOR_TITLES } from "../../app/constants"
import { FactorKey, FactorRetainedScore } from "../../app/types"
import { fr } from "../../i18n"
import { FACTOR_ORDER, StepButton } from "./components"
import { FactorProgress, FactorsList } from "./FactorsList"

const originalConsoleError = console.error

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const message = String(args[0] ?? "")
    if (message.includes("react-test-renderer is deprecated")) {
      return
    }
    originalConsoleError(...(args as Parameters<typeof console.error>))
  })
})

afterAll(() => {
  jest.restoreAllMocks()
})

jest.mock("react-native", () => {
  const mockComponent = (name: string) => {
    const ReactRef = require("react") as typeof import("react")
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
  }
  return {
    Pressable: mockComponent("Pressable"),
    Text: mockComponent("Text"),
    View: mockComponent("View"),
    Platform: { OS: "ios", select: (options: { default?: unknown }) => options.default },
    StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
  }
})

jest.mock("../../ui/AppCard", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppCard: ({ children }: { children?: React.ReactNode }) =>
      ReactRef.createElement("AppCard", null, children),
  }
})

jest.mock("../../ui/AppSectionHeader", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppSectionHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
      ReactRef.createElement("AppSectionHeader", { title, subtitle }),
  }
})

jest.mock("../../ui/AppChoiceChip", () => ({ AppChoiceChip: () => null }))

type Node = renderer.ReactTestInstance

const progressFor = (overrides: Partial<FactorProgress> = {}): FactorProgress => ({
  complete: false,
  filled: 0,
  total: 3,
  invalid: 0,
  ...overrides,
})

const buildProgress = (): Record<FactorKey, FactorProgress> => {
  const progress = {} as Record<FactorKey, FactorProgress>
  for (const factor of FACTOR_ORDER) progress[factor] = progressFor()
  progress.B = progressFor({ complete: true, filled: 3 })
  return progress
}

const buildScores = (): Record<FactorKey, FactorRetainedScore | null> => {
  const scores = {} as Record<FactorKey, FactorRetainedScore | null>
  for (const factor of FACTOR_ORDER) scores[factor] = null
  scores.A = { selected_class: "S5", score: 5 }
  return scores
}

const renderList = (onOpenFactor = jest.fn()) => {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <FactorsList
        factorProgress={buildProgress()}
        factorRetainedScores={buildScores()}
        scoreTotals={
          {
            ibp_total: 12,
            ibp_peuplement_gestion: 8,
            ibp_contexte: 4,
            completed_factors: 2,
            factor_scores: {},
          } as unknown as Parameters<typeof FactorsList>[0]["scoreTotals"]
        }
        onOpenFactor={onOpenFactor}
      />,
    )
  })
  return tree
}

const textOf = (node: Node): string =>
  node.children.map((child) => (typeof child === "string" ? child : textOf(child))).join("")

describe("FactorsList", () => {
  test("every factor tile is a button with the catalogue label for its name and state", () => {
    const tree = renderList()
    const tiles = tree.root.findAllByType("Pressable" as unknown as React.ElementType)
    expect(tiles).toHaveLength(FACTOR_ORDER.length)

    const expected = FACTOR_ORDER.map((factor) => {
      const state =
        factor === "A"
          ? fr.surveyForm.factors.retainedScore({ selectedClass: "S5", score: 5 })
          : factor === "B"
            ? fr.surveyForm.factors.ready
            : fr.surveyForm.factors.pending
      return fr.surveyForm.a11y.factorTile({ factor, title: FACTOR_TITLES[factor], state })
    })

    tiles.forEach((tile, index) => {
      expect(tile.props.accessibilityRole).toBe("button")
      expect(tile.props.accessibilityLabel).toBe(expected[index])
    })
    expect(tiles[0].props.accessibilityLabel).toContain("Facteur A")
  })

  test("pressing a tile opens that factor", () => {
    const onOpenFactor = jest.fn()
    const tree = renderList(onOpenFactor)
    const tiles = tree.root.findAllByType("Pressable" as unknown as React.ElementType)
    act(() => {
      tiles[2].props.onPress()
    })
    expect(onOpenFactor).toHaveBeenCalledWith("C")
  })

  test("renders no English text from the former screen", () => {
    const tree = renderList()
    const texts = tree.root
      .findAllByType("Text" as unknown as React.ElementType)
      .map((node) => textOf(node))
    const headers = tree.root
      .findAllByType("AppSectionHeader" as unknown as React.ElementType)
      .flatMap((node) => [node.props.title as string, node.props.subtitle as string])
    const rendered = [...texts, ...headers].join("\n")

    for (const english of [
      "fields",
      "Ready",
      "Pending",
      "IBP total in progress",
      "factors currently scoreable",
      "Factor scoring",
      "Open each factor",
    ]) {
      expect(rendered).not.toContain(english)
    }
    expect(rendered).toContain(fr.surveyForm.factors.sectionTitle)
  })
})

describe("StepButton", () => {
  test("exposes role, catalogue label and selected/disabled state", () => {
    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(
        <StepButton
          index="02"
          label={fr.surveyForm.header.steps.parcels}
          meta={fr.surveyForm.header.steps.nameRequiredFirst}
          active={false}
          complete={false}
          disabled
          onPress={jest.fn()}
        />,
      )
    })
    const button = tree.root.findByType("Pressable" as unknown as React.ElementType)
    expect(button.props.accessibilityRole).toBe("button")
    expect(button.props.accessibilityLabel).toBe(
      fr.surveyForm.a11y.stepButton({
        index: "02",
        label: fr.surveyForm.header.steps.parcels,
        meta: fr.surveyForm.header.steps.nameRequiredFirst,
      }),
    )
    expect(button.props.accessibilityState).toEqual({ selected: false, disabled: true })
    expect(textOf(button)).toContain(fr.surveyForm.header.steps.hintNameRequired)
  })
})
