/**
 * 500-survey proof for the survey list (phase 01.9-22, D-03, rendering half).
 *
 * react-native is mocked with the render-count harness shape: FlatList renders
 * its header, the first `initialNumToRender` items and its footer, so the rows
 * that mount here are the rows a real FlatList mounts on its first render.
 * Each row is a gesture-handler Swipeable whose mock counts renders, so
 * Swipeable renders = SurveyRow renders.
 */
import React from "react"
import renderer, { act, type ReactTestInstance } from "react-test-renderer"
import { formatShortDateTime } from "../../app/formatters"
import { formatSurveyUiStatusLabel } from "../../app/survey-logic"
import { fr } from "../../i18n"
import type { LocalSurvey } from "../../storage/types"
import { SurveyListScreen } from "../SurveyListScreen"

const mockRowRenders: { count: number; closes: number } = { count: 0, closes: 0 }
const mockList: { renderItem: unknown; initialNumToRender: number | undefined } = {
  renderItem: null,
  initialNumToRender: undefined,
}

jest.mock("react-native", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const mockComponent = (name: string) => {
    const Component = ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
    Component.displayName = name
    return Component
  }

  type Slot = React.ComponentType | React.ReactElement | null | undefined
  type ListProps = {
    data?: unknown[] | null
    initialNumToRender?: number
    renderItem?: (info: { item: unknown; index: number }) => React.ReactNode
    keyExtractor?: (item: unknown, index: number) => string
    ListHeaderComponent?: Slot
    ListFooterComponent?: Slot
  }
  const renderSlot = (slot: Slot): React.ReactNode => {
    if (slot == null) return null
    if (ReactRef.isValidElement(slot)) return slot
    return ReactRef.createElement(slot as React.ComponentType)
  }
  const FlatList = (props: ListProps) => {
    mockList.renderItem = props.renderItem
    mockList.initialNumToRender = props.initialNumToRender
    const data = props.data ?? []
    const items = data
      .slice(0, props.initialNumToRender ?? 10)
      .map((item, index) =>
        ReactRef.createElement(
          ReactRef.Fragment,
          { key: props.keyExtractor ? props.keyExtractor(item, index) : String(index) },
          props.renderItem ? props.renderItem({ item, index }) : null,
        ),
      )
    return ReactRef.createElement(
      "FlatList",
      null,
      renderSlot(props.ListHeaderComponent),
      items,
      renderSlot(props.ListFooterComponent),
    )
  }

  const animatedValue = () => ({ interpolate: () => ({}), setValue: () => undefined })
  const Animated = {
    Value: function MockValue() {
      return animatedValue()
    },
    View: mockComponent("Animated.View"),
    FlatList,
    event: () => () => undefined,
    add: () => animatedValue(),
  }

  const known: Record<string, unknown> = {
    Animated,
    FlatList,
    Platform: {
      OS: "android",
      select: <T,>(options: { ios?: T; android?: T; default?: T }): T | undefined =>
        options.android ?? options.default,
    },
    StyleSheet: {
      create: <T extends object>(value: T): T => value,
      flatten: (value: unknown) => value,
      absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
      absoluteFillObject: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
      hairlineWidth: 0.5,
    },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
  }

  return new Proxy(known, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined
      if (prop in target) return target[prop]
      if (/^[A-Z]/.test(prop)) {
        target[prop] = mockComponent(prop)
        return target[prop]
      }
      return undefined
    },
  })
})

jest.mock("react-native-gesture-handler/Swipeable", () => {
  const ReactRef = jest.requireActual("react") as typeof import("react")
  const SwipeableProbe = ReactRef.forwardRef(function SwipeableProbe(
    {
      children,
      renderLeftActions,
    }: { children?: React.ReactNode; renderLeftActions?: () => React.ReactNode },
    ref: React.Ref<{ close: () => void }>,
  ) {
    mockRowRenders.count += 1
    ReactRef.useImperativeHandle(ref, () => ({
      close: () => {
        mockRowRenders.closes += 1
      },
    }))
    return ReactRef.createElement(
      "Swipeable",
      null,
      renderLeftActions ? renderLeftActions() : null,
      children,
    )
  })
  return { __esModule: true, default: SwipeableProbe }
})

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock("../../app/useAppBottomTabBarHeight", () => ({
  useAppBottomTabBarHeight: (fallback: number) => fallback,
}))

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

const SURVEY_COUNT = 500

function makeSurvey(index: number): LocalSurvey {
  const n = String(index + 1).padStart(3, "0")
  return {
    id: `id-${n}`,
    site_name: `Site ${n}`,
    status: "submitted",
    visibility: "private",
    sync_version: 1,
    sync_state: "synced",
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    sync_blocked: 0,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: new Date(Date.UTC(2026, 8, 1) + index * 60_000).toISOString(),
    completion_rate: 100,
  }
}

type ScreenProps = React.ComponentProps<typeof SurveyListScreen>

const noop = () => undefined
const onDeleteSurvey = jest.fn()
const onOpenSurvey = jest.fn()

function baseProps(surveys: LocalSurvey[]): ScreenProps {
  return {
    surveys,
    visibleSurveys: surveys,
    selectedSurveyId: null,
    attachmentsBySurvey: {},
    surveyQuery: "",
    setSurveyQuery: noop,
    surveyFromDate: "",
    setSurveyFromDate: noop,
    surveyToDate: "",
    setSurveyToDate: noop,
    statusFilter: "all",
    setStatusFilter: noop,
    visibilityFilter: "all",
    setVisibilityFilter: noop,
    syncFilter: "all",
    setSyncFilter: noop,
    blockedFilter: "all",
    setBlockedFilter: noop,
    attachmentFilter: "all",
    setAttachmentFilter: noop,
    sortMode: "updated_desc",
    setSortMode: noop,
    resetFilters: noop,
    onDeleteSurvey,
    onOpenCreateSurvey: noop,
    onOpenSurvey,
  }
}

function mount(props: ScreenProps): renderer.ReactTestRenderer {
  let tree: renderer.ReactTestRenderer | null = null
  act(() => {
    tree = renderer.create(<SurveyListScreen {...props} />)
  })
  return tree as unknown as renderer.ReactTestRenderer
}

function rerender(tree: renderer.ReactTestRenderer, props: ScreenProps): void {
  act(() => {
    tree.update(<SurveyListScreen {...props} />)
  })
}

function findByLabel(tree: renderer.ReactTestRenderer, label: string): ReactTestInstance {
  return tree.root.find(
    (node) => typeof node.type === "string" && node.props.accessibilityLabel === label,
  )
}

describe("SurveyListScreen with 500 surveys (D-03)", () => {
  const surveys = Array.from({ length: SURVEY_COUNT }, (_, index) => makeSurvey(index))

  beforeEach(() => {
    mockRowRenders.count = 0
    mockRowRenders.closes = 0
    onDeleteSurvey.mockClear()
    onOpenSurvey.mockClear()
  })

  it("mounts only the initial window of rows", () => {
    const tree = mount(baseProps(surveys))

    expect(mockRowRenders.count).toBeGreaterThan(0)
    expect(mockRowRenders.count).toBeLessThanOrEqual(10)
    expect(tree.root.findAllByType("Swipeable" as never)).toHaveLength(mockRowRenders.count)
  })

  it("re-renders exactly one row when one survey object is replaced", () => {
    const props = baseProps(surveys)
    const tree = mount(props)
    const renderItem = mockList.renderItem
    mockRowRenders.count = 0

    const next = [...surveys]
    next[3] = { ...surveys[3], site_name: "Site renamed" }
    rerender(tree, { ...props, surveys: next, visibleSurveys: next })

    expect(mockRowRenders.count).toBe(1)
    expect(mockList.renderItem).toBe(renderItem)
  })

  it("re-renders no row on a parent re-render with unchanged list props", () => {
    const props = baseProps(surveys)
    const tree = mount(props)
    const renderItem = mockList.renderItem
    mockRowRenders.count = 0

    rerender(tree, { ...props })

    expect(mockRowRenders.count).toBe(0)
    expect(mockList.renderItem).toBe(renderItem)
  })

  it("re-renders no row when an off-screen survey is selected", () => {
    const props = baseProps(surveys)
    const tree = mount(props)
    mockRowRenders.count = 0

    rerender(tree, { ...props, selectedSurveyId: surveys[400].id })

    expect(mockRowRenders.count).toBe(0)
  })

  it("re-renders only the two rows whose selection changes", () => {
    const props = baseProps(surveys)
    const tree = mount({ ...props, selectedSurveyId: surveys[1].id })
    mockRowRenders.count = 0

    rerender(tree, { ...props, selectedSurveyId: surveys[2].id })

    expect(mockRowRenders.count).toBe(2)
  })

  it("passes the row's own survey id to onDelete and closes the row", () => {
    const tree = mount(baseProps(surveys))
    const target = surveys[4]

    const deleteAction = findByLabel(tree, fr.surveyList.a11y.deleteSurvey(target.site_name))
    act(() => {
      deleteAction.props.onPress()
    })

    expect(onDeleteSurvey).toHaveBeenCalledTimes(1)
    expect(onDeleteSurvey).toHaveBeenCalledWith(target.id)
    expect(mockRowRenders.closes).toBe(1)
  })

  it("labels rows from the catalogue without the survey id and opens by id", () => {
    const tree = mount(baseProps(surveys))
    const rowLabels = tree.root
      .findAll(
        (node) => (node.type as unknown) === "Pressable" && node.props.accessibilityState != null,
      )
      .map((node) => node.props.accessibilityLabel as string)
    expect(rowLabels.length).toBeGreaterThan(0)
    for (const label of rowLabels) {
      expect(label).not.toMatch(/id-\d{3}/)
    }

    const target = surveys[0]
    const expectedLabel = fr.surveyList.a11y.openSurvey({
      name: target.site_name,
      status: formatSurveyUiStatusLabel("submitted"),
      updatedAt: formatShortDateTime(target.updated_at),
    })
    expect(rowLabels).toContain(expectedLabel)
    expect(expectedLabel).not.toContain(target.id)

    act(() => {
      findByLabel(tree, expectedLabel).props.onPress()
    })
    expect(onOpenSurvey).toHaveBeenCalledWith(target.id)
  })

  it("renders the first photo preview once per survey and skips surveys without photos", () => {
    const withPhoto = surveys[0]
    const props = {
      ...baseProps(surveys),
      attachmentsBySurvey: {
        [withPhoto.id]: [
          {
            id: "att-1",
            survey_id: withPhoto.id,
            mime_type: "image/jpeg",
            file_state: "remote",
          },
        ],
      } as unknown as ScreenProps["attachmentsBySurvey"],
    }
    const tree = mount(props)

    expect(tree.root.findAllByType("ActivityIndicator" as never)).toHaveLength(1)
  })
})
