/**
 * Tests for useSurveyList.
 *
 * Strategy: spy on React.useState / useCallback / useMemo so the hook can be
 * called directly in Node without a renderer.
 */

const mockListLocalSurveys = jest.fn()
const mockListLocalAttachments = jest.fn()
const mockBuildAttachmentsBySurvey = jest.fn()
const mockBuildAttachmentCountBySurvey = jest.fn()
const mockComputeSurveyStats = jest.fn()
const mockFilterAndSortSurveys = jest.fn()

jest.mock("../storage", () => ({
  listLocalSurveys: (...args: unknown[]) => mockListLocalSurveys(...args),
  listLocalAttachments: (...args: unknown[]) => mockListLocalAttachments(...args),
}))

jest.mock("../app/survey-logic", () => ({
  buildAttachmentsBySurvey: (...args: unknown[]) => mockBuildAttachmentsBySurvey(...args),
  buildAttachmentCountBySurvey: (...args: unknown[]) => mockBuildAttachmentCountBySurvey(...args),
  computeSurveyStats: (...args: unknown[]) => mockComputeSurveyStats(...args),
  filterAndSortSurveys: (...args: unknown[]) => mockFilterAndSortSurveys(...args),
}))

import React from "react"
import { useSurveyList } from "./useSurveyList"

function useBuildHook() {
  return useSurveyList()
}

describe("useSurveyList", () => {
  let useStateSpy: jest.SpyInstance
  let useCallbackSpy: jest.SpyInstance
  let useMemoSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockBuildAttachmentsBySurvey.mockReturnValue({})
    mockBuildAttachmentCountBySurvey.mockReturnValue({})
    mockComputeSurveyStats.mockReturnValue({ total: 0 })
    mockFilterAndSortSurveys.mockReturnValue([])

    useStateSpy = jest
      .spyOn(React, "useState")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((initial: unknown) => [initial, jest.fn()]) as any)
    useCallbackSpy = jest.spyOn(React, "useCallback").mockImplementation((fn) => fn as never)
    useMemoSpy = jest
      .spyOn(React, "useMemo")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((fn) => fn() as any)
  })

  afterEach(() => {
    useStateSpy.mockRestore()
    useCallbackSpy.mockRestore()
    useMemoSpy.mockRestore()
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns all expected properties", () => {
      const hook = useBuildHook()
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
    })

    test("calls survey-logic functions during useMemo initialization", () => {
      useBuildHook()
      expect(mockBuildAttachmentsBySurvey).toHaveBeenCalledWith([])
      expect(mockBuildAttachmentCountBySurvey).toHaveBeenCalledWith([])
      expect(mockComputeSurveyStats).toHaveBeenCalledWith([])
      expect(mockFilterAndSortSurveys).toHaveBeenCalled()
    })

    test("selectedSurvey is null when selectedSurveyId is null", () => {
      const hook = useBuildHook()
      expect(hook.selectedSurvey).toBeNull()
    })

    test("selectedSurveyAttachments is empty array when no survey selected", () => {
      const hook = useBuildHook()
      expect(hook.selectedSurveyAttachments).toEqual([])
    })
  })

  // ─── refreshLocalSurveys ──────────────────────────────────────────────────

  describe("refreshLocalSurveys", () => {
    test("calls listLocalSurveys", async () => {
      const rows = [{ id: "s1" }, { id: "s2" }]
      mockListLocalSurveys.mockResolvedValue(rows)
      const hook = useBuildHook()

      await hook.refreshLocalSurveys()

      expect(mockListLocalSurveys).toHaveBeenCalled()
    })
  })

  // ─── refreshLocalAttachments ──────────────────────────────────────────────

  describe("refreshLocalAttachments", () => {
    test("calls listLocalAttachments", async () => {
      const rows = [{ id: "a1", survey_id: "s1" }]
      mockListLocalAttachments.mockResolvedValue(rows)
      const hook = useBuildHook()

      await hook.refreshLocalAttachments()

      expect(mockListLocalAttachments).toHaveBeenCalled()
    })
  })

  // ─── resetFilters ─────────────────────────────────────────────────────────

  describe("resetFilters", () => {
    test("resets all filter states to defaults", () => {
      const hook = useBuildHook()
      const setSurveyQuery = hook.setSurveyQuery as jest.Mock
      const setStatusFilter = hook.setStatusFilter as jest.Mock
      const setSortMode = hook.setSortMode as jest.Mock

      hook.resetFilters()

      expect(setSurveyQuery).toHaveBeenCalledWith("")
      expect(setStatusFilter).toHaveBeenCalledWith("all")
      expect(setSortMode).toHaveBeenCalledWith("updated_desc")
    })
  })

  // ─── openSurvey / closeSurvey ─────────────────────────────────────────────

  describe("openSurvey", () => {
    test("sets selectedSurveyId to the given surveyId", () => {
      const hook = useBuildHook()
      const setSelectedSurveyId = hook.setSelectedSurveyId as jest.Mock

      hook.openSurvey("survey-123")

      expect(setSelectedSurveyId).toHaveBeenCalledWith("survey-123")
    })
  })

  describe("closeSurvey", () => {
    test("sets selectedSurveyId to null", () => {
      const hook = useBuildHook()
      const setSelectedSurveyId = hook.setSelectedSurveyId as jest.Mock

      hook.closeSurvey()

      expect(setSelectedSurveyId).toHaveBeenCalledWith(null)
    })
  })

  // ─── visibleSurveys useMemo ───────────────────────────────────────────────

  describe("visibleSurveys", () => {
    test("passes filter state to filterAndSortSurveys", () => {
      useBuildHook()
      expect(mockFilterAndSortSurveys).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          surveyQuery: "",
          statusFilter: "all",
          sortMode: "updated_desc",
        }),
        expect.anything(),
      )
    })
  })
})
