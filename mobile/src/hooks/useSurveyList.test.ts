/**
 * Tests for useSurveyList.
 *
 * Strategy: render the real hook with renderHook (phase 01.9 D-01); storage and
 * survey-logic are mocked, and assertions read the rendered state after act.
 */

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }))

const mockListLocalSurveys = jest.fn()
const mockListLocalAttachments = jest.fn()
const mockBuildAttachmentsBySurvey = jest.fn()
const mockBuildAttachmentCountBySurvey = jest.fn()
const mockComputeSurveyStats = jest.fn()
const mockFilterAndSortSurveys = jest.fn()

jest.mock("../storage/surveys", () => ({
  listLocalSurveys: (...args: unknown[]) => mockListLocalSurveys(...args),
  listLocalAttachments: (...args: unknown[]) => mockListLocalAttachments(...args),
}))

jest.mock("../app/survey-logic", () => ({
  buildAttachmentsBySurvey: (...args: unknown[]) => mockBuildAttachmentsBySurvey(...args),
  buildAttachmentCountBySurvey: (...args: unknown[]) => mockBuildAttachmentCountBySurvey(...args),
  computeSurveyStats: (...args: unknown[]) => mockComputeSurveyStats(...args),
  filterAndSortSurveys: (...args: unknown[]) => mockFilterAndSortSurveys(...args),
}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { useSurveyList } from "./useSurveyList"

async function renderList() {
  return renderHook(() => useSurveyList())
}

afterEach(async () => {
  await cleanup()
})

describe("useSurveyList", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBuildAttachmentsBySurvey.mockReturnValue({})
    mockBuildAttachmentCountBySurvey.mockReturnValue({})
    mockComputeSurveyStats.mockReturnValue({ total: 0 })
    mockFilterAndSortSurveys.mockReturnValue([])
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns all expected properties", async () => {
      const { result } = await renderList()
      const hook = result.current
      expect(hook).toHaveProperty("surveys")
      expect(hook).toHaveProperty("attachments")
      expect(hook).toHaveProperty("selectedSurveyId")
      expect(hook).toHaveProperty("selectedSurvey")
      expect(hook).toHaveProperty("visibleSurveys")
      expect(hook).toHaveProperty("surveyStats")
      expect(hook).toHaveProperty("surveyQuery")
      expect(hook).toHaveProperty("statusFilter")
      expect(hook).toHaveProperty("sortMode")
      expect(hook).toHaveProperty("refreshLocalSurveys")
      expect(hook).toHaveProperty("refreshLocalAttachments")
      expect(hook).toHaveProperty("resetFilters")
      expect(hook).toHaveProperty("openSurvey")
      expect(hook).toHaveProperty("closeSurvey")
      expect(hook.surveys).toEqual([])
      expect(hook.attachments).toEqual([])
      expect(hook.surveyStats).toEqual({ total: 0 })
    })

    test("calls survey-logic functions during useMemo initialization", async () => {
      await renderList()
      expect(mockBuildAttachmentsBySurvey).toHaveBeenCalledWith([])
      expect(mockBuildAttachmentCountBySurvey).toHaveBeenCalledWith([])
      expect(mockComputeSurveyStats).toHaveBeenCalledWith([])
      expect(mockFilterAndSortSurveys).toHaveBeenCalled()
    })

    test("selectedSurvey is null when selectedSurveyId is null", async () => {
      const { result } = await renderList()
      expect(result.current.selectedSurvey).toBeNull()
    })

    test("selectedSurveyAttachments is empty array when no survey selected", async () => {
      const { result } = await renderList()
      expect(result.current.selectedSurveyAttachments).toEqual([])
    })
  })

  // ─── refreshLocalSurveys ──────────────────────────────────────────────────

  describe("refreshLocalSurveys", () => {
    test("calls listLocalSurveys and stores the rows", async () => {
      const rows = [{ id: "s1" }, { id: "s2" }]
      mockListLocalSurveys.mockResolvedValue(rows)
      const { result } = await renderList()

      await act(async () => {
        await result.current.refreshLocalSurveys()
      })

      expect(mockListLocalSurveys).toHaveBeenCalled()
      expect(result.current.surveys).toEqual(rows)
      expect(mockComputeSurveyStats).toHaveBeenLastCalledWith(rows)
    })
  })

  // ─── refreshLocalAttachments ──────────────────────────────────────────────

  describe("refreshLocalAttachments", () => {
    test("calls listLocalAttachments and stores the rows", async () => {
      const rows = [{ id: "a1", survey_id: "s1" }]
      mockListLocalAttachments.mockResolvedValue(rows)
      const { result } = await renderList()

      await act(async () => {
        await result.current.refreshLocalAttachments()
      })

      expect(mockListLocalAttachments).toHaveBeenCalled()
      expect(result.current.attachments).toEqual(rows)
      expect(mockBuildAttachmentsBySurvey).toHaveBeenLastCalledWith(rows)
    })
  })

  // ─── resetFilters ─────────────────────────────────────────────────────────

  describe("resetFilters", () => {
    test("resets all filter states to defaults", async () => {
      const { result } = await renderList()

      await act(async () => {
        result.current.setSurveyQuery("chêne")
        result.current.setSurveyFromDate("2024-01-01")
        result.current.setSurveyToDate("2024-12-31")
        result.current.setStatusFilter("draft")
        result.current.setVisibilityFilter("public")
        result.current.setSyncFilter("failed")
        result.current.setBlockedFilter("blocked")
        result.current.setAttachmentFilter("with")
        result.current.setSortMode("site_asc")
      })
      expect(result.current.surveyQuery).toBe("chêne")
      expect(result.current.statusFilter).toBe("draft")
      expect(result.current.sortMode).toBe("site_asc")

      await act(async () => {
        result.current.resetFilters()
      })

      expect(result.current.surveyQuery).toBe("")
      expect(result.current.surveyFromDate).toBe("")
      expect(result.current.surveyToDate).toBe("")
      expect(result.current.statusFilter).toBe("all")
      expect(result.current.visibilityFilter).toBe("all")
      expect(result.current.syncFilter).toBe("all")
      expect(result.current.blockedFilter).toBe("all")
      expect(result.current.attachmentFilter).toBe("all")
      expect(result.current.sortMode).toBe("updated_desc")
    })
  })

  // ─── openSurvey / closeSurvey ─────────────────────────────────────────────

  describe("openSurvey", () => {
    test("sets selectedSurveyId to the given surveyId", async () => {
      const { result } = await renderList()

      await act(async () => {
        result.current.openSurvey("survey-123")
      })

      expect(result.current.selectedSurveyId).toBe("survey-123")
    })

    test("resolves the selected survey and its attachments", async () => {
      const survey = { id: "s1" }
      const attachment = { id: "a1", survey_id: "s1" }
      mockListLocalSurveys.mockResolvedValue([survey])
      mockListLocalAttachments.mockResolvedValue([attachment])
      mockBuildAttachmentsBySurvey.mockImplementation((rows: unknown[]) =>
        rows.length > 0 ? { s1: rows } : {},
      )
      const { result } = await renderList()

      await act(async () => {
        await result.current.refreshLocalSurveys()
        await result.current.refreshLocalAttachments()
        result.current.openSurvey("s1")
      })

      expect(result.current.selectedSurvey).toEqual(survey)
      expect(result.current.selectedSurveyAttachments).toEqual([attachment])

      await act(async () => {
        result.current.openSurvey("unknown")
      })
      expect(result.current.selectedSurvey).toBeNull()
    })
  })

  describe("closeSurvey", () => {
    test("sets selectedSurveyId to null", async () => {
      const { result } = await renderList()
      await act(async () => {
        result.current.openSurvey("survey-123")
      })

      await act(async () => {
        result.current.closeSurvey()
      })

      expect(result.current.selectedSurveyId).toBeNull()
    })
  })

  // ─── visibleSurveys useMemo ───────────────────────────────────────────────

  describe("visibleSurveys", () => {
    test("passes filter state to filterAndSortSurveys", async () => {
      const visible = [{ id: "s9" }]
      mockFilterAndSortSurveys.mockReturnValue(visible)
      const { result } = await renderList()
      expect(mockFilterAndSortSurveys).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          surveyQuery: "",
          statusFilter: "all",
          sortMode: "updated_desc",
        }),
        expect.anything(),
      )
      expect(result.current.visibleSurveys).toBe(visible)

      await act(async () => {
        result.current.setSurveyQuery("hêtre")
      })
      expect(mockFilterAndSortSurveys).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ surveyQuery: "hêtre" }),
        expect.anything(),
      )
    })
  })
})
