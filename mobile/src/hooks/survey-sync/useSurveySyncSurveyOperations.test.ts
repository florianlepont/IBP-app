/**
 * Tests for useSurveySyncSurveyOperations.
 *
 * Strategy: spy on React.useCallback so the hook can be called directly in
 * Node without a renderer (same pattern as other survey-sync hooks).
 */

const mockGetSubmitBlockReason = jest.fn()
const mockEvaluateSubmitReadiness = jest.fn()
const mockGetLocalSurveyDraft = jest.fn()
const mockSubmitSurvey = jest.fn()
const mockRetrySurveyNow = jest.fn()
const mockDiscardSurveyLocalChanges = jest.fn()
const mockUpdateSurveyVisibility = jest.fn()
const mockQueueDeleteSurvey = jest.fn()
const mockQueueLocalAttachment = jest.fn()
const mockQueueDeleteAttachment = jest.fn()
const mockMarkSurveyExpiredLocally = jest.fn()
const mockSyncPending = jest.fn()

jest.mock("../useAuth0Session", () => ({ AUTH_REQUIRED_ERROR: "AUTH_REQUIRED" }))
jest.mock("react-native", () => ({ Alert: { alert: jest.fn() } }))
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}))
jest.mock("../../app/survey-logic", () => ({
  getSubmitBlockReason: mockGetSubmitBlockReason,
}))
jest.mock("../../app/ibp-scoring", () => ({
  evaluateSubmitReadinessFromDraft: mockEvaluateSubmitReadiness,
}))
jest.mock("../../storage", () => ({
  getLocalSurveyDraft: mockGetLocalSurveyDraft,
  submitSurvey: mockSubmitSurvey,
  retrySurveyNow: mockRetrySurveyNow,
  discardSurveyLocalChanges: mockDiscardSurveyLocalChanges,
  updateSurveyVisibility: mockUpdateSurveyVisibility,
  queueDeleteSurvey: mockQueueDeleteSurvey,
  queueLocalAttachment: mockQueueLocalAttachment,
  queueDeleteAttachment: mockQueueDeleteAttachment,
  markSurveyExpiredLocally: mockMarkSurveyExpiredLocally,
  syncPending: mockSyncPending,
}))

import React from "react"
import * as ImagePicker from "expo-image-picker"
import { Alert } from "react-native"
import { useSurveySyncSurveyOperations } from "./useSurveySyncSurveyOperations"

function useBuildHook(overrides: Record<string, unknown> = {}) {
  const params = {
    apiUrl: "http://localhost:3000",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    selectedSurveyId: null,
    editingSurveyId: null,
    surveys: [],
    clearSession: jest.fn().mockResolvedValue(undefined),
    refreshSessionTokens: jest
      .fn()
      .mockResolvedValue({ accessToken: "new-token", refreshToken: "" }),
    withAuthRetry: jest.fn((fn: (token: string) => unknown) => fn("token")),
    refreshLocalSurveys: jest.fn().mockResolvedValue(undefined),
    refreshLocalAttachments: jest.fn().mockResolvedValue(undefined),
    onCloseSurveyDetail: jest.fn(),
    onStopEditing: jest.fn(),
    setStatus: jest.fn(),
    maybeAutoSync: jest.fn().mockResolvedValue(undefined),
    handleLoadCanonicalDetails: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  const hook = useSurveySyncSurveyOperations(params as never)
  return { ...hook, ...params }
}

describe("useSurveySyncSurveyOperations", () => {
  let useCallbackSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    useCallbackSpy = jest.spyOn(React, "useCallback").mockImplementation((fn) => fn as never)
  })

  afterEach(() => {
    useCallbackSpy.mockRestore()
  })

  // ─── handleSubmitSurvey ───────────────────────────────────────────────────

  describe("handleSubmitSurvey", () => {
    test("sets status when survey not found", async () => {
      mockGetSubmitBlockReason.mockReturnValue("not_found")
      const { handleSubmitSurvey, setStatus } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("not found"))
    })

    test("sets status when global sync conflict", async () => {
      mockGetSubmitBlockReason.mockReturnValue("global_blocked")
      const { handleSubmitSurvey, setStatus } = useBuildHook({
        surveys: [{ id: "survey-1", sync_blocked: 1 }],
      })
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Sync conflict"))
    })

    test("sets status when already submitted", async () => {
      mockGetSubmitBlockReason.mockReturnValue("already_submitted")
      const { handleSubmitSurvey, setStatus } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("already submitted"))
    })

    test("sets status when not synced", async () => {
      mockGetSubmitBlockReason.mockReturnValue("not_synced")
      const { handleSubmitSurvey, setStatus } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("must be synced"))
    })

    test("sets status when survey-level sync conflict", async () => {
      mockGetSubmitBlockReason.mockReturnValue("survey_blocked")
      const { handleSubmitSurvey, setStatus } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("unresolved sync conflict"))
    })

    test("sets status when draft not found locally", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue(null)
      const { handleSubmitSurvey, setStatus } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("not found locally"))
    })

    test("sets status when draft is not ready", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({
        region_version: null,
        vegetation_stage: null,
        factors: {},
        parcel_ids: [],
        expires_at: null,
      })
      mockEvaluateSubmitReadiness.mockReturnValue({
        ready: false,
        expired: false,
        missing_factors: ["A1"],
        missing_fields: [],
      })
      const { handleSubmitSurvey, setStatus } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("A1"))
    })

    test("marks survey expired when readiness check returns expired", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({
        region_version: "ACA",
        vegetation_stage: "planitiaire",
        factors: {},
        parcel_ids: [],
        expires_at: "2020-01-01",
      })
      mockEvaluateSubmitReadiness.mockReturnValue({
        ready: false,
        expired: true,
        missing_factors: [],
        missing_fields: [],
      })
      mockMarkSurveyExpiredLocally.mockResolvedValue(undefined)
      const { handleSubmitSurvey, refreshLocalSurveys } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(mockMarkSurveyExpiredLocally).toHaveBeenCalledWith("survey-1")
      expect(refreshLocalSurveys).toHaveBeenCalled()
    })

    test("submits successfully and updates status", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({
        region_version: "ACA",
        vegetation_stage: "planitiaire",
        factors: {},
        parcel_ids: ["p1"],
        expires_at: null,
      })
      mockEvaluateSubmitReadiness.mockReturnValue({
        ready: true,
        expired: false,
        missing_factors: [],
        missing_fields: [],
      })
      mockSubmitSurvey.mockResolvedValue({ ok: true, message: "Submitted" })
      const { handleSubmitSurvey, setStatus, refreshLocalSurveys } = useBuildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Submitted"))
      expect(refreshLocalSurveys).toHaveBeenCalled()
    })

    test("calls clearSession on AUTH_REQUIRED during submit", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({
        region_version: "ACA",
        vegetation_stage: "planitiaire",
        factors: {},
        parcel_ids: ["p1"],
        expires_at: null,
      })
      mockEvaluateSubmitReadiness.mockReturnValue({
        ready: true,
        expired: false,
        missing_factors: [],
        missing_fields: [],
      })
      const { handleSubmitSurvey, clearSession } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })
      await handleSubmitSurvey("survey-1")
      expect(clearSession).toHaveBeenCalled()
    })

    test("sets error status on generic submit error", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({
        region_version: "ACA",
        vegetation_stage: "planitiaire",
        factors: {},
        parcel_ids: ["p1"],
        expires_at: null,
      })
      mockEvaluateSubmitReadiness.mockReturnValue({
        ready: true,
        expired: false,
        missing_factors: [],
        missing_fields: [],
      })
      const { handleSubmitSurvey, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Network error")),
      })
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Network error"))
    })
  })

  // ─── handleRetrySurvey ────────────────────────────────────────────────────

  describe("handleRetrySurvey", () => {
    test("retries and sets status on success", async () => {
      mockRetrySurveyNow.mockResolvedValue({ queued: 1 })
      const { handleRetrySurvey, setStatus, refreshLocalSurveys } = useBuildHook()
      await handleRetrySurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Retry queued"))
      expect(refreshLocalSurveys).toHaveBeenCalled()
    })

    test("sets error status on failure", async () => {
      mockRetrySurveyNow.mockRejectedValue(new Error("Retry failed"))
      const { handleRetrySurvey, setStatus } = useBuildHook()
      await handleRetrySurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Retry failed"))
    })
  })

  // ─── handleDiscardSurvey ──────────────────────────────────────────────────

  describe("handleDiscardSurvey", () => {
    test("discards and sets status on success", async () => {
      mockDiscardSurveyLocalChanges.mockResolvedValue({ removed_queue: 2 })
      const { handleDiscardSurvey, setStatus } = useBuildHook()
      await handleDiscardSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Local changes discarded"))
    })

    test("sets error status on failure", async () => {
      mockDiscardSurveyLocalChanges.mockRejectedValue(new Error("Discard failed"))
      const { handleDiscardSurvey, setStatus } = useBuildHook()
      await handleDiscardSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Discard failed"))
    })
  })

  // ─── handleToggleVisibility ───────────────────────────────────────────────

  describe("handleToggleVisibility", () => {
    test("sets status on success", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue({
        ok: true,
        message: "Visibility updated",
        synced: false,
      })
      const { handleToggleVisibility, setStatus } = useBuildHook()
      await handleToggleVisibility("survey-1", "public")
      expect(setStatus).toHaveBeenCalledWith("Visibility updated")
    })

    test("sets warning status when result is not ok", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue({
        ok: false,
        message: "Conflict",
        synced: false,
      })
      const { handleToggleVisibility, setStatus } = useBuildHook()
      await handleToggleVisibility("survey-1", "public")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Conflict"))
    })

    test("refreshes session and retries on 401", async () => {
      mockUpdateSurveyVisibility
        .mockResolvedValueOnce({ ok: false, message: "401 Unauthorized", synced: false })
        .mockResolvedValueOnce({ ok: true, message: "Updated", synced: false })
      const { handleToggleVisibility, setStatus } = useBuildHook()
      await handleToggleVisibility("survey-1", "public")
      expect(mockUpdateSurveyVisibility).toHaveBeenCalledTimes(2)
      expect(setStatus).toHaveBeenCalledWith("Updated")
    })

    test("calls clearSession when token refresh fails on 401", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue({
        ok: false,
        message: "401 error",
        synced: false,
      })
      const { handleToggleVisibility, clearSession } = useBuildHook({
        refreshSessionTokens: jest.fn().mockResolvedValue(null),
      })
      await handleToggleVisibility("survey-1", "public")
      expect(clearSession).toHaveBeenCalled()
    })

    test("sets error status on exception", async () => {
      mockUpdateSurveyVisibility.mockRejectedValue(new Error("Visibility error"))
      const { handleToggleVisibility, setStatus } = useBuildHook()
      await handleToggleVisibility("survey-1", "public")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Visibility error"))
    })
  })

  // ─── confirmDeleteSurvey ──────────────────────────────────────────────────

  describe("confirmDeleteSurvey", () => {
    test("shows an Alert with Delete and Cancel options", () => {
      const { confirmDeleteSurvey } = useBuildHook()
      confirmDeleteSurvey("survey-1")
      expect(Alert.alert).toHaveBeenCalledWith(
        "Delete survey",
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: "Cancel" }),
          expect.objectContaining({ text: "Delete" }),
        ]),
      )
    })
  })

  // ─── handleQueueAttachmentFromLibrary ─────────────────────────────────────

  describe("handleQueueAttachmentFromLibrary", () => {
    test("sets status for submitted survey", async () => {
      const { handleQueueAttachmentFromLibrary, setStatus } = useBuildHook({
        surveys: [{ id: "survey-1", status: "submitted" }],
      })
      await handleQueueAttachmentFromLibrary("survey-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("submitted and read-only"))
    })

    test("sets status when permission denied", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      })
      const { handleQueueAttachmentFromLibrary, setStatus } = useBuildHook()
      await handleQueueAttachmentFromLibrary("survey-1")
      expect(setStatus).toHaveBeenCalledWith("Media library permission is required")
    })

    test("sets status when picker cancelled", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handleQueueAttachmentFromLibrary, setStatus } = useBuildHook()
      await handleQueueAttachmentFromLibrary("survey-1")
      expect(setStatus).toHaveBeenCalledWith("No image selected")
    })

    test("queues attachment and sets status on success", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: "file://photo.jpg",
            mimeType: "image/jpeg",
            fileName: "photo.jpg",
            fileSize: 100000,
            width: 100,
            height: 100,
          },
        ],
      })
      mockQueueLocalAttachment.mockResolvedValue(undefined)
      const { handleQueueAttachmentFromLibrary, setStatus } = useBuildHook()
      await handleQueueAttachmentFromLibrary("survey-1")
      expect(mockQueueLocalAttachment).toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("queued"))
    })
  })

  // ─── handleQueueAttachmentFromCamera ─────────────────────────────────────

  describe("handleQueueAttachmentFromCamera", () => {
    test("sets status when camera permission denied", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      })
      const { handleQueueAttachmentFromCamera, setStatus } = useBuildHook()
      await handleQueueAttachmentFromCamera("survey-1")
      expect(setStatus).toHaveBeenCalledWith("Camera permission is required")
    })

    test("sets status when camera cancelled", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
      ;(ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handleQueueAttachmentFromCamera, setStatus } = useBuildHook()
      await handleQueueAttachmentFromCamera("survey-1")
      expect(setStatus).toHaveBeenCalledWith("No photo captured")
    })
  })

  // ─── handleDeleteAttachment ───────────────────────────────────────────────

  describe("handleDeleteAttachment", () => {
    test("sets status for submitted survey", async () => {
      const { handleDeleteAttachment, setStatus } = useBuildHook({
        surveys: [{ id: "survey-1", status: "submitted" }],
      })
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("submitted and read-only"))
    })

    test("sets status when attachment not found locally", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: false, queued_delete: false })
      const { handleDeleteAttachment, setStatus } = useBuildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("not found locally"))
    })

    test("removes locally and syncs when queued_delete is true", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: true })
      mockSyncPending.mockResolvedValue({
        synced: 1,
        failed: 0,
        pulled_surveys: 0,
        pulled_attachments: 0,
      })
      const { handleDeleteAttachment, setStatus } = useBuildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("synced"))
    })

    test("handles AUTH_REQUIRED during sync after delete", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: true })
      const { handleDeleteAttachment, setStatus } = useBuildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Login and sync"))
    })

    test("removes locally without sync when queued_delete is false", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: false })
      const { handleDeleteAttachment, setStatus } = useBuildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith("Attachment removed locally")
    })

    test("sets error status on exception", async () => {
      mockQueueDeleteAttachment.mockRejectedValue(new Error("Delete failed"))
      const { handleDeleteAttachment, setStatus } = useBuildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(expect.stringContaining("Delete failed"))
    })
  })
})
