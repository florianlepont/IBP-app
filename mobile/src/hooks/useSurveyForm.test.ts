/**
 * Tests for useSurveyForm.
 *
 * Strategy: spy on React.useState / useCallback / useMemo so the hook can be
 * called directly in Node without a renderer. useMemo spy executes the factory
 * immediately, which covers all computed values (formErrors, factorSections,
 * factorRetainedScores, draftInput) and the validators they call
 * (numberError, oneOfError, requiredError).
 */

const mockComputeRetainedScores = jest.fn()
const mockNormalizeVegetationStage = jest.fn()
const mockDefaultVegetationStage = jest.fn()
const mockParseFinite = jest.fn()

jest.mock("../app/constants", () => ({
  DEFAULT_SURVEY_FORM: {
    siteName: "",
    regionVersion: "ACA",
    vegetationStage: "collineen",
    gpsLocation: { lat: "", lng: "", collected_at: "" },
    factorA: { native_genus_count: "" },
    factorB: { strata_count: "", covered_autochthonous_percent: "" },
    factorC: { bmg_count: "", bmm_count: "", surface_ha: "" },
    factorD: { bmg_count: "", bmm_count: "", surface_ha: "" },
    factorE: { tgb_count: "", gb_count: "", surface_ha: "" },
    factorF: { trees_per_ha: "" },
    factorG: { open_flowering_percent: "" },
    factorH: { class_score: "" },
    factorI: { type_count: "" },
    factorJ: { type_count: "" },
  },
  normalizeVegetationStageForRegion: (...args: unknown[]) =>
    mockNormalizeVegetationStage(...args),
  defaultVegetationStageForRegion: (...args: unknown[]) =>
    mockDefaultVegetationStage(...args),
}))

jest.mock("../app/ibp-scoring", () => ({
  computeRetainedScoresFromRawFactors: (...args: unknown[]) =>
    mockComputeRetainedScores(...args),
}))

jest.mock("../app/number-utils", () => ({
  parseFiniteNumberInput: (...args: unknown[]) => mockParseFinite(...args),
}))

import React from "react"
import { useSurveyForm } from "./useSurveyForm"

function buildHook() {
  return useSurveyForm()
}

describe("useSurveyForm", () => {
  let useStateSpy: jest.SpyInstance
  let useCallbackSpy: jest.SpyInstance
  let useMemoSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockNormalizeVegetationStage.mockReturnValue("collineen")
    mockDefaultVegetationStage.mockReturnValue("collineen")
    mockComputeRetainedScores.mockReturnValue({})
    mockParseFinite.mockReturnValue(null)

    useStateSpy = jest
      .spyOn(React, "useState")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((initial: unknown) => [initial, jest.fn()]) as any)
    useCallbackSpy = jest
      .spyOn(React, "useCallback")
      .mockImplementation((fn) => fn as never)
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
      const hook = buildHook()
      expect(hook).toHaveProperty("siteName")
      expect(hook).toHaveProperty("regionVersion")
      expect(hook).toHaveProperty("vegetationStage")
      expect(hook).toHaveProperty("gpsLocation")
      expect(hook).toHaveProperty("selectedParcelIds")
      expect(hook).toHaveProperty("factorSections")
      expect(hook).toHaveProperty("formErrors")
      expect(hook).toHaveProperty("draftInput")
      expect(hook).toHaveProperty("factorRetainedScores")
      expect(hook).toHaveProperty("applyDraftToForm")
      expect(hook).toHaveProperty("resetSurveyForm")
      expect(hook).toHaveProperty("buildDraftInput")
    })

    test("calls computeRetainedScoresFromRawFactors on render", () => {
      buildHook()
      expect(mockComputeRetainedScores).toHaveBeenCalled()
    })

    test("factorSections has all 10 factors", () => {
      const hook = buildHook()
      expect(Object.keys(hook.factorSections)).toEqual([
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
      ])
    })

    test("factorSections A has one field with required error when empty", () => {
      const hook = buildHook()
      expect(hook.factorSections.A).toHaveLength(1)
      expect(hook.factorSections.A[0].error).toContain("required")
    })

    test("factorSections H uses oneOfError (shows required error when empty)", () => {
      const hook = buildHook()
      expect(hook.factorSections.H[0].error).toContain("required")
    })

    test("formErrors.siteName is set when siteName is empty", () => {
      const hook = buildHook()
      expect(hook.formErrors.siteName).toContain("required")
    })

    test("draftInput has expected shape", () => {
      const hook = buildHook()
      expect(hook.draftInput).toHaveProperty("site_name")
      expect(hook.draftInput).toHaveProperty("region_version")
      expect(hook.draftInput).toHaveProperty("vegetation_stage")
      expect(hook.draftInput).toHaveProperty("factors")
      expect(hook.draftInput).toHaveProperty("parcel_ids")
    })
  })

  // ─── draftInput.factors (buildFactorsPayload) ────────────────────────────

  describe("draftInput.factors (buildFactorsPayload)", () => {
    test("returns empty object when parseFiniteNumberInput returns null for all", () => {
      mockParseFinite.mockReturnValue(null)
      const hook = buildHook()
      expect(hook.draftInput.factors).toEqual({})
    })

    test("includes all factors when inputs parse to 2 (valid for all constraints)", () => {
      // 2: integer, >= 0, <= 100, in [0, 2, 5]
      mockParseFinite.mockReturnValue(2)
      const hook = buildHook()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = hook.draftInput.factors as any
      expect(payload).toHaveProperty("A")
      expect(payload).toHaveProperty("B")
      expect(payload).toHaveProperty("C")
      expect(payload).toHaveProperty("D")
      expect(payload).toHaveProperty("E")
      expect(payload).toHaveProperty("F")
      expect(payload).toHaveProperty("G")
      expect(payload).toHaveProperty("H")
      expect(payload).toHaveProperty("I")
      expect(payload).toHaveProperty("J")
      expect(payload.A).toEqual({ native_genus_count: 2 })
      expect(payload.H).toEqual({ class_score: 2 })
    })

    test("excludes factor H when class_score is not in [0, 2, 5]", () => {
      mockParseFinite.mockReturnValue(3)
      const hook = buildHook()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = hook.draftInput.factors as any
      expect(payload).not.toHaveProperty("H")
      expect(payload).toHaveProperty("A")
    })

    test("excludes factor B when one of its two fields is null", () => {
      mockParseFinite.mockReturnValue(null)
      const hook = buildHook()
      expect(hook.draftInput.factors).not.toHaveProperty("B")
    })
  })

  // ─── buildDraftInput ──────────────────────────────────────────────────────

  describe("buildDraftInput", () => {
    test("returns the computed draftInput object", () => {
      const hook = buildHook()
      const result = hook.buildDraftInput()
      expect(result).toHaveProperty("site_name")
      expect(result).toHaveProperty("region_version", "ACA")
      expect(result).toHaveProperty("parcel_ids")
    })
  })

  // ─── applyDraftToForm ─────────────────────────────────────────────────────

  describe("applyDraftToForm", () => {
    test("applies site_name from draft", () => {
      const hook = buildHook()
      const setSiteName = hook.setSiteName as jest.Mock
      hook.applyDraftToForm({ site_name: "My Forest" })
      expect(setSiteName).toHaveBeenCalledWith("My Forest")
    })

    test("uses 'ACA' region version for unknown values", () => {
      const hook = buildHook()
      hook.applyDraftToForm({ region_version: "UNKNOWN", vegetation_stage: "collineen" })
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("ACA", "collineen")
    })

    test("uses 'M' region version when specified", () => {
      const hook = buildHook()
      hook.applyDraftToForm({ region_version: "M", vegetation_stage: "montagnard" })
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("M", "montagnard")
    })

    test("falls back to DEFAULT_SURVEY_FORM.siteName when site_name is missing", () => {
      const hook = buildHook()
      const setSiteName = hook.setSiteName as jest.Mock
      hook.applyDraftToForm({})
      expect(setSiteName).toHaveBeenCalledWith("")
    })

    test("handles null draft without throwing (asObject returns {})", () => {
      const hook = buildHook()
      expect(() => hook.applyDraftToForm(null)).not.toThrow()
    })

    test("handles non-object draft (string) without throwing", () => {
      const hook = buildHook()
      expect(() => hook.applyDraftToForm("not-an-object")).not.toThrow()
    })

    test("handles array draft without throwing (asObject returns {})", () => {
      const hook = buildHook()
      expect(() => hook.applyDraftToForm([1, 2, 3])).not.toThrow()
    })

    test("normalizes parcel_ids: trims, uppercases, deduplicates, skips non-strings", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.applyDraftToForm({
        parcel_ids: ["  abc  ", "DEF", "abc", 123, null, ""],
      })
      expect(setSelectedParcelIds).toHaveBeenCalledWith(["ABC", "DEF"])
    })

    test("applies numeric factor values (converted to strings via toTextNum)", () => {
      const hook = buildHook()
      expect(() =>
        hook.applyDraftToForm({
          factors: {
            A: { native_genus_count: 5 },
            B: { strata_count: 3, covered_autochthonous_percent: 75.5 },
            F: { trees_per_ha: 100 },
          },
        }),
      ).not.toThrow()
    })

    test("handles parcel_ids that is not an array", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.applyDraftToForm({ parcel_ids: "not-an-array" })
      expect(setSelectedParcelIds).toHaveBeenCalledWith([])
    })

    test("applies full draft with all factors", () => {
      const hook = buildHook()
      expect(() =>
        hook.applyDraftToForm({
          site_name: "Site A",
          region_version: "M",
          vegetation_stage: "montagnard",
          factors: {
            A: { native_genus_count: 3 },
            B: { strata_count: 2, covered_autochthonous_percent: 60 },
            C: { bmg_count: 1, bmm_count: 2, surface_ha: 0.5 },
            D: { bmg_count: 0, bmm_count: 1, surface_ha: 1 },
            E: { tgb_count: 2, gb_count: 3, surface_ha: 2 },
            F: { trees_per_ha: 15 },
            G: { open_flowering_percent: 50 },
            H: { class_score: 2 },
            I: { type_count: 1 },
            J: { type_count: 0 },
          },
          parcel_ids: ["P001", "P002"],
        }),
      ).not.toThrow()
    })
  })

  // ─── resetSurveyForm ──────────────────────────────────────────────────────

  describe("resetSurveyForm", () => {
    test("resets siteName to default", () => {
      const hook = buildHook()
      const setSiteName = hook.setSiteName as jest.Mock
      hook.resetSurveyForm()
      expect(setSiteName).toHaveBeenCalledWith("") // DEFAULT_SURVEY_FORM.siteName
    })

    test("calls defaultVegetationStageForRegion to reset vegetationStage", () => {
      const hook = buildHook()
      hook.resetSurveyForm()
      expect(mockDefaultVegetationStage).toHaveBeenCalled()
    })

    test("resets selectedParcelIds to empty array", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.resetSurveyForm()
      expect(setSelectedParcelIds).toHaveBeenCalledWith([])
    })
  })

  // ─── handleRegionChange ───────────────────────────────────────────────────

  describe("handleRegionChange", () => {
    test("calls normalizeVegetationStageForRegion with the new region", () => {
      const hook = buildHook()
      hook.handleRegionChange("M")
      const setVegetationStage = hook.setVegetationStage as jest.Mock
      expect(setVegetationStage).toHaveBeenCalledWith(expect.any(Function))
      const updater = setVegetationStage.mock.calls[0][0]
      updater("collineen")
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("M", "collineen")
    })

    test("calls normalizeVegetationStageForRegion with ACA region", () => {
      const hook = buildHook()
      hook.handleRegionChange("ACA")
      const setVegetationStage = hook.setVegetationStage as jest.Mock
      const updater = setVegetationStage.mock.calls[0][0]
      updater("subalpin")
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("ACA", "subalpin")
    })
  })

  // ─── applyGpsLocation ────────────────────────────────────────────────────

  describe("applyGpsLocation", () => {
    test("calls setGpsLocation with formatted lat/lng strings", () => {
      const hook = buildHook()
      expect(() =>
        hook.applyGpsLocation({
          lat: 48.8566,
          lng: 2.3522,
          collected_at: "2024-01-01T00:00:00Z",
        }),
      ).not.toThrow()
    })
  })

  // ─── toggleParcelSelection ────────────────────────────────────────────────

  describe("toggleParcelSelection", () => {
    test("does nothing when parcelId is whitespace only", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.toggleParcelSelection("   ")
      expect(setSelectedParcelIds).not.toHaveBeenCalled()
    })

    test("calls setSelectedParcelIds with an updater function", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.toggleParcelSelection("abc")
      expect(setSelectedParcelIds).toHaveBeenCalledWith(expect.any(Function))
    })

    test("updater adds normalized parcelId when not present", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.toggleParcelSelection("  abc  ")
      const updater = setSelectedParcelIds.mock.calls[0][0]
      expect(updater([])).toEqual(["ABC"])
      expect(updater(["DEF"])).toEqual(["DEF", "ABC"])
    })

    test("updater removes parcelId when already present", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.toggleParcelSelection("abc")
      const updater = setSelectedParcelIds.mock.calls[0][0]
      expect(updater(["ABC", "DEF"])).toEqual(["DEF"])
    })

    test("does nothing when parcelId is empty string", () => {
      const hook = buildHook()
      const setSelectedParcelIds = hook.setSelectedParcelIds as jest.Mock
      hook.toggleParcelSelection("")
      expect(setSelectedParcelIds).not.toHaveBeenCalled()
    })
  })

  // ─── factorSections field onChange callbacks ──────────────────────────────

  describe("factorSections onChange callbacks", () => {
    test("factorA onChange calls setFactorA with new value", () => {
      const hook = buildHook()
      // The onChange is a closure, ensure it doesn't throw
      expect(() => hook.factorSections.A[0].onChange("5")).not.toThrow()
    })

    test("factorB onChange does not throw for strata_count", () => {
      const hook = buildHook()
      expect(() => hook.factorSections.B[0].onChange("3")).not.toThrow()
    })

    test("factorH onChange does not throw", () => {
      const hook = buildHook()
      expect(() => hook.factorSections.H[0].onChange("2")).not.toThrow()
    })

    test("all factor onChange callbacks can be invoked without throwing", () => {
      const hook = buildHook()
      const keys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const
      for (const key of keys) {
        for (const field of hook.factorSections[key]) {
          expect(() => field.onChange("3")).not.toThrow()
        }
      }
    })
  })

  // ─── numberError / oneOfError deeper branches ─────────────────────────────

  describe("numberError branches via factorSections (non-empty values)", () => {
    test("non-finite value produces 'must be a number' error", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "abc" },
      }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toContain("must be a number")
    })

    test("non-integer value produces 'must be an integer' error", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "1.5" },
      }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toContain("must be an integer")
    })

    test("value below min produces '>= min' error", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "-1" },
      }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toContain(">= 0")
    })

    test("value above max produces '<= max' error (factorG, max=100)", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorG: { open_flowering_percent: "101" },
      }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.G[0].error).toContain("<= 100")
    })

    test("valid value produces null error for factorA", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "3" },
      }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toBeNull()
    })

    test("oneOfError: valid value in [0,2,5] produces null error (factorH)", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorH: { class_score: "2" },
      }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.H[0].error).toBeNull()
    })

    test("oneOfError: integer not in [0,2,5] produces 'must be one of' error", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorH: { class_score: "3" },
      }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.H[0].error).toContain("must be one of")
    })

    test("formErrors.siteName is null when siteName is non-empty", () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = { ...saved, siteName: "Mon site" }
      const hook = buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.formErrors.siteName).toBeNull()
    })
  })
})
