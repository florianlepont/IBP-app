import React from "react"
import renderer, { act, ReactTestRenderer } from "react-test-renderer"
import { shouldShowDevTools } from "../../app/dev-tools"
import { SurveyEventItem } from "../../app/types"
import { fr } from "../../i18n"
import { LocalAttachment, LocalSurvey } from "../../storage"
import { DebugTab } from "./DebugTab"
import { DetailTabBar } from "./DetailTabBar"
import { EventsTab } from "./EventsTab"

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

jest.mock("react-native", () => {
  const ReactRef = require("react") as typeof import("react")
  const mockComponent =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactRef.createElement(name, props, children)
  return {
    ActivityIndicator: mockComponent("ActivityIndicator"),
    Pressable: mockComponent("Pressable"),
    Text: mockComponent("Text"),
    View: mockComponent("View"),
    StyleSheet: { create: <T,>(styles: T): T => styles },
  }
})

jest.mock("expo-image", () => ({ Image: "ExpoImage" }))
jest.mock("@expo/vector-icons", () => ({ Ionicons: "Ionicons" }))

jest.mock("../../ui/AppChoiceChip", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppChoiceChip: ({ label, onPress }: { label: string; onPress?: () => void }) =>
      ReactRef.createElement("AppChoiceChip", { label, onPress }),
  }
})
jest.mock("../../ui/AppButton", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppButton: ({ label, onPress }: { label: string; onPress?: () => void }) =>
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
jest.mock("../../ui/AppSectionHeader", () => {
  const ReactRef = require("react") as typeof import("react")
  return {
    AppSectionHeader: ({
      title,
      subtitle,
      trailing,
    }: {
      title: string
      subtitle?: string
      trailing?: React.ReactNode
    }) => ReactRef.createElement("AppSectionHeader", { title, subtitle }, trailing),
  }
})

jest.mock("../../app/dev-tools", () => ({
  shouldShowDevTools: jest.fn(() => false),
}))

const mockedShouldShowDevTools = shouldShowDevTools as jest.MockedFunction<
  typeof shouldShowDevTools
>

const SURVEY_ID = "5b7d2c1e-9f3a-4c8b-a1d2-3e4f5a6b7c8d"

const render = (element: React.ReactElement): ReactTestRenderer => {
  let tree: ReactTestRenderer | undefined
  act(() => {
    tree = renderer.create(element)
  })
  return tree as ReactTestRenderer
}

const chipLabels = (tree: ReactTestRenderer): string[] =>
  tree.root.findAllByType("AppChoiceChip" as never).map((chip) => chip.props.label as string)

const allText = (tree: ReactTestRenderer): string => JSON.stringify(tree.toJSON())

const sampleEvent: SurveyEventItem = {
  id: "0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b",
  survey_id: SURVEY_ID,
  event_type: "submitted",
  payload: { survey_id: SURVEY_ID, sync_error_code: "survey_conflict" },
  created_at: "2026-09-26T10:00:00.000Z",
}

const sampleSurvey = {
  id: SURVEY_ID,
  site_name: "Parcelle du Bois",
  status: "draft",
  updated_at: "2026-09-26T10:00:00.000Z",
  completion_rate: 40,
  last_sync_error: "HTTP 409 conflict",
  last_sync_error_code: "survey_conflict",
  last_sync_error_at: "2026-09-26T10:00:00.000Z",
} as unknown as LocalSurvey

afterEach(() => {
  mockedShouldShowDevTools.mockReturnValue(false)
})

describe("DetailTabBar", () => {
  test("hides the Debug chip when dev tools are off", () => {
    mockedShouldShowDevTools.mockReturnValue(false)
    const tree = render(<DetailTabBar activeTab="summary" onSelectTab={jest.fn()} />)
    expect(chipLabels(tree)).toEqual([fr.surveyDetail.tabs.summary, fr.surveyDetail.tabs.events])
  })

  test("shows the Debug chip when dev tools are on", () => {
    mockedShouldShowDevTools.mockReturnValue(true)
    const onSelectTab = jest.fn()
    const tree = render(<DetailTabBar activeTab="summary" onSelectTab={onSelectTab} />)
    expect(chipLabels(tree)).toEqual([
      fr.surveyDetail.tabs.summary,
      fr.surveyDetail.tabs.events,
      fr.surveyDetail.tabs.debug,
    ])
    const debugChip = tree.root
      .findAllByType("AppChoiceChip" as never)
      .find((chip) => chip.props.label === fr.surveyDetail.tabs.debug)
    act(() => {
      debugChip?.props.onPress()
    })
    expect(onSelectTab).toHaveBeenCalledWith("debug")
  })
})

describe("EventsTab", () => {
  test("shows the French event label and no JSON or raw ids", () => {
    const tree = render(<EventsTab events={[sampleEvent]} isLoading={false} onReload={jest.fn()} />)
    const text = allText(tree)
    expect(text).toContain(fr.surveyDetail.eventTypes.submitted)
    expect(text).not.toContain(SURVEY_ID)
    expect(text).not.toContain(sampleEvent.id)
    expect(text).not.toContain("survey_conflict")
    expect(text).not.toContain('\\"survey_id\\"')
  })

  test("shows the empty text and the loading text from the catalogue", () => {
    const empty = render(<EventsTab events={[]} isLoading={false} onReload={jest.fn()} />)
    expect(allText(empty)).toContain(fr.surveyDetail.events.empty)
    const loading = render(<EventsTab events={[]} isLoading onReload={jest.fn()} />)
    expect(allText(loading)).toContain(fr.surveyDetail.events.loading)
    expect(allText(loading)).not.toContain(fr.surveyDetail.events.empty)
  })
})

describe("DebugTab", () => {
  const props = {
    survey: sampleSurvey,
    attachments: [] as LocalAttachment[],
    events: [sampleEvent],
    createdAt: "2026-09-20T10:00:00.000Z",
    submittedAt: null,
    publishableOnPublicMap: false,
  }

  test("renders nothing when dev tools are off", () => {
    mockedShouldShowDevTools.mockReturnValue(false)
    const tree = render(<DebugTab {...props} />)
    expect(tree.toJSON()).toBeNull()
  })

  test("shows ids, error codes and event payloads when dev tools are on", () => {
    mockedShouldShowDevTools.mockReturnValue(true)
    const text = allText(render(<DebugTab {...props} />))
    expect(text).toContain(SURVEY_ID)
    expect(text).toContain("survey_conflict")
    expect(text).toContain(fr.surveyDetail.debug.snapshotTitle)
  })
})
