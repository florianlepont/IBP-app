import { normalizeVegetationStageForRegion } from "./vegetation"
import {
  buildAttachmentCountBySurvey,
  filterAndSortSurveys,
  formatSurveySyncDisplayLabel,
  formatSurveyUiStatusLabel,
  formatSurveyWorkflowStatusLabel,
  getSubmitBlockReason,
  resolveEffectiveSurveyStatus,
  resolveSurveySyncDisplay,
  resolveSurveyWorkflowStatus,
  resolveSurveyUiStatus,
} from "./survey-logic"
import { LocalAttachment, LocalSurvey } from "../storage"
import { SurveyListFilters } from "./types"

const makeSurvey = (overrides: Partial<LocalSurvey>): LocalSurvey => ({
  id: "survey-default",
  site_name: "Default site",
  status: "draft",
  visibility: "private",
  sync_version: 1,
  sync_state: "pending",
  last_sync_error: null,
  last_sync_error_code: null,
  last_sync_error_at: null,
  sync_blocked: 0,
  created_at: "2026-03-01T09:00:00.000Z",
  updated_at: "2026-03-01T10:00:00.000Z",
  completion_rate: 0,
  ...overrides,
})

const makeAttachment = (overrides: Partial<LocalAttachment>): LocalAttachment => ({
  id: "att-default",
  survey_id: "survey-default",
  local_uri: "file:///tmp/default.jpg",
  mime_type: "image/jpeg",
  size_bytes: 50000,
  sync_state: "pending",
  remote_attachment_id: null,
  storage_key: null,
  upload_url: null,
  confirm_url: null,
  last_sync_error: null,
  last_sync_error_code: null,
  last_sync_error_at: null,
  updated_at: "2026-03-01T10:00:00.000Z",
  ...overrides,
})

describe("normalizeVegetationStageForRegion", () => {
  test("maps montagnard_mediterraneen to montagnard in ACA", () => {
    expect(normalizeVegetationStageForRegion("ACA", "montagnard_mediterraneen")).toBe("montagnard")
  })

  test("falls back to ACA default when stage does not belong to ACA", () => {
    expect(normalizeVegetationStageForRegion("ACA", "thermo_mediterraneen")).toBe("planitiaire")
  })

  test("keeps valid M stage unchanged", () => {
    expect(normalizeVegetationStageForRegion("M", "meso_mediterraneen")).toBe("meso_mediterraneen")
  })
})

describe("filterAndSortSurveys", () => {
  const surveys: LocalSurvey[] = [
    makeSurvey({
      id: "s-a",
      site_name: "Alpha Forest",
      status: "draft",
      sync_state: "pending",
      updated_at: "2026-03-09T10:00:00.000Z",
    }),
    makeSurvey({
      id: "s-b",
      site_name: "Beta Ridge",
      status: "submitted",
      sync_state: "synced",
      updated_at: "2026-03-08T10:00:00.000Z",
    }),
    makeSurvey({
      id: "s-c",
      site_name: "Gamma Creek",
      status: "draft",
      sync_state: "failed",
      last_sync_error: "network timeout",
      sync_blocked: 1,
      updated_at: "2026-03-07T10:00:00.000Z",
    }),
    makeSurvey({
      id: "s-d",
      site_name: "Delta Grove",
      status: "draft",
      sync_state: "synced",
      updated_at: "2026-03-06T10:00:00.000Z",
    }),
  ]

  const attachments = [
    makeAttachment({ id: "a-1", survey_id: "s-a" }),
    makeAttachment({ id: "a-2", survey_id: "s-a" }),
    makeAttachment({ id: "a-3", survey_id: "s-c" }),
  ]

  const baseFilters: SurveyListFilters = {
    surveyQuery: "",
    surveyFromDate: "",
    surveyToDate: "",
    statusFilter: "all",
    visibilityFilter: "all",
    syncFilter: "all",
    blockedFilter: "all",
    attachmentFilter: "all",
    sortMode: "updated_desc",
  }

  test("filters by query and sync state", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const result = filterAndSortSurveys(
      surveys,
      { ...baseFilters, surveyQuery: "gamma", syncFilter: "failed" },
      attachmentCounts,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("s-c")
  })

  test("filters by attachment presence", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const result = filterAndSortSurveys(
      surveys,
      { ...baseFilters, attachmentFilter: "without" },
      attachmentCounts,
    )
    expect(result.map((survey) => survey.id)).toEqual(["s-b", "s-d"])
  })

  test("filters by visibility", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const withVisibility = surveys.map((survey) =>
      survey.id === "s-b" ? { ...survey, visibility: "public" as const } : survey,
    )
    const result = filterAndSortSurveys(
      withVisibility,
      { ...baseFilters, visibilityFilter: "public" },
      attachmentCounts,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("s-b")
  })

  test("sorts by site name ascending", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const result = filterAndSortSurveys(
      surveys,
      { ...baseFilters, sortMode: "site_asc" },
      attachmentCounts,
    )
    expect(result.map((survey) => survey.id)).toEqual(["s-a", "s-b", "s-d", "s-c"])
  })

  test("filters by lifecycle status draft regardless of sync state", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const result = filterAndSortSurveys(
      surveys,
      { ...baseFilters, statusFilter: "draft" },
      attachmentCounts,
    )
    expect(result.map((survey) => survey.id)).toEqual(["s-a", "s-c", "s-d"])
  })

  test("filters by lifecycle status submitted", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const result = filterAndSortSurveys(
      surveys,
      { ...baseFilters, statusFilter: "submitted" },
      attachmentCounts,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("s-b")
  })

  test("filters by status expired from survey status", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const withExpired = surveys.map((survey) =>
      survey.id === "s-a" ? { ...survey, status: "expired" } : survey,
    )
    const result = filterAndSortSurveys(
      withExpired,
      { ...baseFilters, statusFilter: "expired" },
      attachmentCounts,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("s-a")
  })

  test("filters by updated date range", () => {
    const attachmentCounts = buildAttachmentCountBySurvey(attachments)
    const result = filterAndSortSurveys(
      surveys,
      { ...baseFilters, surveyFromDate: "2026-03-08", surveyToDate: "2026-03-09" },
      attachmentCounts,
    )
    expect(result.map((survey) => survey.id)).toEqual(["s-a", "s-b"])
  })

  test("resolves effective status with lifecycle priority", () => {
    expect(
      resolveEffectiveSurveyStatus(makeSurvey({ status: "submitted", sync_state: "synced" })),
    ).toBe("submitted")
    expect(
      resolveEffectiveSurveyStatus(makeSurvey({ status: "draft", sync_state: "synced" })),
    ).toBe("synced")
    expect(
      resolveEffectiveSurveyStatus(makeSurvey({ status: "draft", sync_state: "failed" })),
    ).toBe("error")
  })

  test("resolves single UI state for display", () => {
    expect(resolveSurveyUiStatus(makeSurvey({ status: "submitted", sync_state: "synced" }))).toBe(
      "submitted",
    )
    expect(resolveSurveyUiStatus(makeSurvey({ status: "expired", sync_state: "failed" }))).toBe(
      "expired",
    )
    expect(resolveSurveyUiStatus(makeSurvey({ status: "draft", sync_state: "pending" }))).toBe(
      "sync_pending",
    )
    expect(
      resolveSurveyUiStatus(makeSurvey({ status: "draft", sync_state: "failed", sync_blocked: 1 })),
    ).toBe("sync_blocked")
    expect(resolveSurveyUiStatus(makeSurvey({ status: "draft", sync_state: "synced" }))).toBe(
      "draft",
    )
  })

  test("formats UI state labels", () => {
    expect(formatSurveyUiStatusLabel("submitted")).toBe("Soumis")
    expect(formatSurveyUiStatusLabel("expired")).toBe("Expiré")
    expect(formatSurveyUiStatusLabel("sync_error")).toBe("Erreur de sync")
    expect(formatSurveyUiStatusLabel("sync_pending")).toBe("Sync en attente")
    expect(formatSurveyUiStatusLabel("sync_blocked")).toBe("Sync bloqué")
    expect(formatSurveyUiStatusLabel("draft")).toBe("Brouillon")
  })

  test("resolves workflow status for explicit badge display", () => {
    expect(
      resolveSurveyWorkflowStatus(makeSurvey({ status: "submitted", sync_state: "synced" })),
    ).toBe("submitted")
    expect(
      resolveSurveyWorkflowStatus(makeSurvey({ status: "draft", sync_state: "pending" })),
    ).toBe("pending")
    expect(resolveSurveyWorkflowStatus(makeSurvey({ status: "draft", sync_state: "synced" }))).toBe(
      "draft",
    )
    expect(
      resolveSurveyWorkflowStatus(makeSurvey({ status: "expired", sync_state: "failed" })),
    ).toBe("expired")
  })

  test("resolves sync display for explicit badge display", () => {
    expect(
      resolveSurveySyncDisplay(makeSurvey({ status: "submitted", sync_state: "synced" })),
    ).toBe("sync")
    expect(resolveSurveySyncDisplay(makeSurvey({ status: "draft", sync_state: "synced" }))).toBe(
      "local",
    )
    expect(resolveSurveySyncDisplay(makeSurvey({ status: "draft", sync_state: "pending" }))).toBe(
      "local",
    )
    expect(resolveSurveySyncDisplay(makeSurvey({ status: "draft", sync_state: "failed" }))).toBe(
      "sync_error",
    )
    expect(
      resolveSurveySyncDisplay(
        makeSurvey({ status: "draft", sync_state: "failed", sync_blocked: 1 }),
      ),
    ).toBe("sync_blocked")
    expect(formatSurveySyncDisplayLabel("sync")).toBe("Sync")
    expect(formatSurveySyncDisplayLabel("local")).toBe("Local")
    expect(formatSurveySyncDisplayLabel("sync_error")).toBe("Erreur de sync")
    expect(formatSurveySyncDisplayLabel("sync_blocked")).toBe("Sync bloqué")
    expect(formatSurveyWorkflowStatusLabel("pending")).toBe("En attente")
    expect(formatSurveyWorkflowStatusLabel("submitted")).toBe("Soumis")
    expect(formatSurveyWorkflowStatusLabel("expired")).toBe("Expiré")
    expect(formatSurveyWorkflowStatusLabel("draft")).toBe("Brouillon")
  })
})

describe("getSubmitBlockReason", () => {
  test("returns null when survey can be submitted", () => {
    const surveys: LocalSurvey[] = [makeSurvey({ id: "ok", sync_state: "synced", status: "draft" })]
    expect(getSubmitBlockReason("ok", surveys)).toBeNull()
  })

  test("returns global_blocked when another survey is blocked", () => {
    const surveys: LocalSurvey[] = [
      makeSurvey({ id: "target", sync_state: "synced", status: "draft" }),
      makeSurvey({ id: "other", sync_blocked: 1, sync_state: "failed" }),
    ]
    expect(getSubmitBlockReason("target", surveys)).toBe("global_blocked")
  })

  test("returns survey_blocked when target itself is blocked", () => {
    const surveys: LocalSurvey[] = [
      makeSurvey({ id: "target", sync_state: "synced", sync_blocked: 1, status: "draft" }),
    ]
    expect(getSubmitBlockReason("target", surveys)).toBe("survey_blocked")
  })

  test("returns not_synced when survey is not synced yet", () => {
    const surveys: LocalSurvey[] = [
      makeSurvey({ id: "target", sync_state: "pending", status: "draft" }),
    ]
    expect(getSubmitBlockReason("target", surveys)).toBe("not_synced")
  })

  test("returns already_submitted for submitted survey", () => {
    const surveys: LocalSurvey[] = [
      makeSurvey({ id: "target", sync_state: "synced", status: "submitted" }),
    ]
    expect(getSubmitBlockReason("target", surveys)).toBe("already_submitted")
  })
})

describe("normalizeVegetationStageForRegion (vegetation.ts)", () => {
  test("returns default stage when stage is not a string", () => {
    const result = normalizeVegetationStageForRegion("ACA", 42)
    expect(typeof result).toBe("string")
    expect(result.length).toBeGreaterThan(0)
  })

  test("returns 'montagnard' for ACA region with montagnard_mediterraneen stage", () => {
    expect(normalizeVegetationStageForRegion("ACA", "montagnard_mediterraneen")).toBe("montagnard")
  })

  test("returns default stage for unknown stage string", () => {
    const result = normalizeVegetationStageForRegion("ACA", "unknown_stage")
    expect(typeof result).toBe("string")
  })
})
