/**
 * Tests for useSurveyForm.
 *
 * Strategy: render the real hook with renderHook from
 * @testing-library/react-native/pure (see render-hook-smoke.test.ts). The render
 * computes every memoised value (formErrors, factorSections,
 * factorRetainedScores, draftInput) and the validators they call
 * (numberError, oneOfError, requiredError). Setters and updaters run inside
 * act() and the tests read the resulting state from result.current.
 */

jest.mock("react-native", () => ({}))

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
  normalizeVegetationStageForRegion: (...args: unknown[]) => mockNormalizeVegetationStage(...args),
  defaultVegetationStageForRegion: (...args: unknown[]) => mockDefaultVegetationStage(...args),
}))

jest.mock("../app/ibp-scoring", () => ({
  computeRetainedScoresFromRawFactors: (...args: unknown[]) => mockComputeRetainedScores(...args),
}))

jest.mock("../app/number-utils", () => ({
  parseFiniteNumberInput: (...args: unknown[]) => mockParseFinite(...args),
}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { useSurveyForm } from "./useSurveyForm"

async function renderForm() {
  const { result } = await renderHook(() => useSurveyForm())
  return result
}

async function buildHook() {
  return (await renderForm()).current
}

describe("useSurveyForm", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNormalizeVegetationStage.mockReturnValue("collineen")
    mockDefaultVegetationStage.mockReturnValue("collineen")
    mockComputeRetainedScores.mockReturnValue({})
    mockParseFinite.mockReturnValue(null)
  })

  afterEach(async () => {
    await cleanup()
  })

  // ─── Initialization ───────────────────────────────────────────────────────

  describe("hook initialization", () => {
    test("returns all expected properties", async () => {
      const hook = await buildHook()
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

    test("calls computeRetainedScoresFromRawFactors on render", async () => {
      await buildHook()
      expect(mockComputeRetainedScores).toHaveBeenCalled()
    })

    test("factorSections has all 10 factors", async () => {
      const hook = await buildHook()
      expect(Object.keys(hook.factorSections)).toEqual([
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
      ])
    })

    test("factorSections A has one field with required error when empty", async () => {
      const hook = await buildHook()
      expect(hook.factorSections.A).toHaveLength(1)
      expect(hook.factorSections.A[0].error).toContain("required")
    })

    test("factorSections H uses oneOfError (shows required error when empty)", async () => {
      const hook = await buildHook()
      expect(hook.factorSections.H[0].error).toContain("required")
    })

    test("formErrors.siteName is set when siteName is empty", async () => {
      const hook = await buildHook()
      expect(hook.formErrors.siteName).toContain("required")
    })

    test("draftInput has expected shape", async () => {
      const hook = await buildHook()
      expect(hook.draftInput).toHaveProperty("site_name")
      expect(hook.draftInput).toHaveProperty("region_version")
      expect(hook.draftInput).toHaveProperty("vegetation_stage")
      expect(hook.draftInput).toHaveProperty("factors")
      expect(hook.draftInput).toHaveProperty("parcel_ids")
    })
  })

  // ─── draftInput.factors (buildFactorsPayload) ────────────────────────────

  describe("draftInput.factors (buildFactorsPayload)", () => {
    test("returns empty object when parseFiniteNumberInput returns null for all", async () => {
      mockParseFinite.mockReturnValue(null)
      const hook = await buildHook()
      expect(hook.draftInput.factors).toEqual({})
    })

    test("includes all factors when inputs parse to 2 (valid for all constraints)", async () => {
      // 2: integer, >= 0, <= 100, in [0, 2, 5]
      mockParseFinite.mockReturnValue(2)
      const hook = await buildHook()
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

    test("excludes factor H when class_score is not in [0, 2, 5]", async () => {
      mockParseFinite.mockReturnValue(3)
      const hook = await buildHook()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = hook.draftInput.factors as any
      expect(payload).not.toHaveProperty("H")
      expect(payload).toHaveProperty("A")
    })

    test("excludes factor B when one of its two fields is null", async () => {
      mockParseFinite.mockReturnValue(null)
      const hook = await buildHook()
      expect(hook.draftInput.factors).not.toHaveProperty("B")
    })
  })

  // ─── buildDraftInput ──────────────────────────────────────────────────────

  describe("buildDraftInput", () => {
    test("returns the computed draftInput object", async () => {
      const hook = await buildHook()
      const result = hook.buildDraftInput()
      expect(result).toHaveProperty("site_name")
      expect(result).toHaveProperty("region_version", "ACA")
      expect(result).toHaveProperty("parcel_ids")
    })
  })

  // ─── applyDraftToForm ─────────────────────────────────────────────────────

  describe("applyDraftToForm", () => {
    test("applies site_name from draft", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.applyDraftToForm({ site_name: "My Forest" })
      })
      expect(result.current.siteName).toBe("My Forest")
    })

    test("uses 'ACA' region version for unknown values", async () => {
      const hook = await buildHook()
      await act(async () => {
        hook.applyDraftToForm({ region_version: "UNKNOWN", vegetation_stage: "collineen" })
      })
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("ACA", "collineen")
    })

    test("uses 'M' region version when specified", async () => {
      const hook = await buildHook()
      await act(async () => {
        hook.applyDraftToForm({ region_version: "M", vegetation_stage: "montagnard" })
      })
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("M", "montagnard")
    })

    test("falls back to DEFAULT_SURVEY_FORM.siteName when site_name is missing", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.setSiteName("Previous site")
      })
      await act(async () => {
        result.current.applyDraftToForm({})
      })
      expect(result.current.siteName).toBe("")
    })

    test("handles null draft without throwing (asObject returns {})", async () => {
      const hook = await buildHook()
      await act(async () => {
        expect(() => hook.applyDraftToForm(null)).not.toThrow()
      })
    })

    test("handles non-object draft (string) without throwing", async () => {
      const hook = await buildHook()
      await act(async () => {
        expect(() => hook.applyDraftToForm("not-an-object")).not.toThrow()
      })
    })

    test("handles array draft without throwing (asObject returns {})", async () => {
      const hook = await buildHook()
      await act(async () => {
        expect(() => hook.applyDraftToForm([1, 2, 3])).not.toThrow()
      })
    })

    test("normalizes parcel_ids: trims, uppercases, deduplicates, skips non-strings", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.applyDraftToForm({
          parcel_ids: ["  abc  ", "DEF", "abc", 123, null, ""],
        })
      })
      expect(result.current.selectedParcelIds).toEqual(["ABC", "DEF"])
    })

    test("applies numeric factor values (converted to strings via toTextNum)", async () => {
      const hook = await buildHook()
      await act(async () => {
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
    })

    test("handles parcel_ids that is not an array", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.setSelectedParcelIds(["P001"])
      })
      await act(async () => {
        result.current.applyDraftToForm({ parcel_ids: "not-an-array" })
      })
      expect(result.current.selectedParcelIds).toEqual([])
    })

    test("applies full draft with all factors", async () => {
      const hook = await buildHook()
      await act(async () => {
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
  })

  // ─── resetSurveyForm ──────────────────────────────────────────────────────

  describe("resetSurveyForm", () => {
    test("resets siteName to default", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.setSiteName("Previous site")
      })
      await act(async () => {
        result.current.resetSurveyForm()
      })
      expect(result.current.siteName).toBe("") // DEFAULT_SURVEY_FORM.siteName
    })

    test("calls defaultVegetationStageForRegion to reset vegetationStage", async () => {
      const hook = await buildHook()
      await act(async () => {
        hook.resetSurveyForm()
      })
      expect(mockDefaultVegetationStage).toHaveBeenCalled()
    })

    test("resets selectedParcelIds to empty array", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.setSelectedParcelIds(["P001"])
      })
      await act(async () => {
        result.current.resetSurveyForm()
      })
      expect(result.current.selectedParcelIds).toEqual([])
    })
  })

  // ─── handleRegionChange ───────────────────────────────────────────────────

  describe("handleRegionChange", () => {
    test("calls normalizeVegetationStageForRegion with the new region", async () => {
      mockNormalizeVegetationStage.mockReturnValue("montagnard")
      const result = await renderForm()
      await act(async () => {
        result.current.handleRegionChange("M")
      })
      // The vegetation stage is derived from the current one ("collineen").
      expect(result.current.regionVersion).toBe("M")
      expect(result.current.vegetationStage).toBe("montagnard")
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("M", "collineen")
    })

    test("calls normalizeVegetationStageForRegion with ACA region", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.setVegetationStage("subalpin" as never)
      })
      await act(async () => {
        result.current.handleRegionChange("ACA")
      })
      expect(mockNormalizeVegetationStage).toHaveBeenCalledWith("ACA", "subalpin")
    })
  })

  // ─── applyGpsLocation ────────────────────────────────────────────────────

  describe("applyGpsLocation", () => {
    test("calls setGpsLocation with formatted lat/lng strings", async () => {
      const hook = await buildHook()
      await act(async () => {
        expect(() =>
          hook.applyGpsLocation({
            lat: 48.8566,
            lng: 2.3522,
            collected_at: "2024-01-01T00:00:00Z",
          }),
        ).not.toThrow()
      })
    })
  })

  // ─── toggleParcelSelection ────────────────────────────────────────────────

  describe("toggleParcelSelection", () => {
    test("does nothing when parcelId is whitespace only", async () => {
      const result = await renderForm()
      const before = result.current.selectedParcelIds
      await act(async () => {
        result.current.toggleParcelSelection("   ")
      })
      expect(result.current.selectedParcelIds).toBe(before)
    })

    test("calls setSelectedParcelIds with an updater function", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.toggleParcelSelection("abc")
      })
      expect(result.current.selectedParcelIds).toEqual(["ABC"])
    })

    test("updater adds normalized parcelId when not present", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.toggleParcelSelection("  abc  ")
      })
      expect(result.current.selectedParcelIds).toEqual(["ABC"])
      await act(async () => {
        result.current.setSelectedParcelIds(["DEF"])
      })
      await act(async () => {
        result.current.toggleParcelSelection("  abc  ")
      })
      expect(result.current.selectedParcelIds).toEqual(["DEF", "ABC"])
    })

    test("updater removes parcelId when already present", async () => {
      const result = await renderForm()
      await act(async () => {
        result.current.setSelectedParcelIds(["ABC", "DEF"])
      })
      await act(async () => {
        result.current.toggleParcelSelection("abc")
      })
      expect(result.current.selectedParcelIds).toEqual(["DEF"])
    })

    test("does nothing when parcelId is empty string", async () => {
      const result = await renderForm()
      const before = result.current.selectedParcelIds
      await act(async () => {
        result.current.toggleParcelSelection("")
      })
      expect(result.current.selectedParcelIds).toBe(before)
    })
  })

  // ─── factorSections field onChange callbacks ──────────────────────────────

  describe("factorSections onChange callbacks", () => {
    test("factorA onChange calls setFactorA with new value", async () => {
      const hook = await buildHook()
      // The onChange is a closure, ensure it doesn't throw
      await act(async () => {
        expect(() => hook.factorSections.A[0].onChange("5")).not.toThrow()
      })
    })

    test("factorB onChange does not throw for strata_count", async () => {
      const hook = await buildHook()
      await act(async () => {
        expect(() => hook.factorSections.B[0].onChange("3")).not.toThrow()
      })
    })

    test("factorH onChange does not throw", async () => {
      const hook = await buildHook()
      await act(async () => {
        expect(() => hook.factorSections.H[0].onChange("2")).not.toThrow()
      })
    })

    test("all factor onChange callbacks can be invoked without throwing", async () => {
      const hook = await buildHook()
      const keys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const
      await act(async () => {
        for (const key of keys) {
          for (const field of hook.factorSections[key]) {
            expect(() => field.onChange("3")).not.toThrow()
          }
        }
      })
    })
  })

  // ─── numberError / oneOfError deeper branches ─────────────────────────────

  describe("numberError branches via factorSections (non-empty values)", () => {
    test("non-finite value produces 'must be a number' error", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "abc" },
      }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toContain("must be a number")
    })

    test("non-integer value produces 'must be an integer' error", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "1.5" },
      }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toContain("must be an integer")
    })

    test("value below min produces '>= min' error", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "-1" },
      }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toContain(">= 0")
    })

    test("value above max produces '<= max' error (factorG, max=100)", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorG: { open_flowering_percent: "101" },
      }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.G[0].error).toContain("<= 100")
    })

    test("valid value produces null error for factorA", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorA: { native_genus_count: "3" },
      }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.A[0].error).toBeNull()
    })

    test("oneOfError: valid value in [0,2,5] produces null error (factorH)", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorH: { class_score: "2" },
      }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.H[0].error).toBeNull()
    })

    test("oneOfError: integer not in [0,2,5] produces 'must be one of' error", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = {
        ...saved,
        factorH: { class_score: "3" },
      }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.factorSections.H[0].error).toContain("must be one of")
    })

    test("formErrors.siteName is null when siteName is non-empty", async () => {
      const mockConstants = jest.requireMock("../app/constants")
      const saved = mockConstants.DEFAULT_SURVEY_FORM
      mockConstants.DEFAULT_SURVEY_FORM = { ...saved, siteName: "Mon site" }
      const hook = await buildHook()
      mockConstants.DEFAULT_SURVEY_FORM = saved
      expect(hook.formErrors.siteName).toBeNull()
    })
  })
})
