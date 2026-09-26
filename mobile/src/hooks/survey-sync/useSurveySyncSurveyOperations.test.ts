/**
 * Tests for useSurveySyncSurveyOperations.
 *
 * Strategy: render the real hook with renderHook from
 * @testing-library/react-native/pure (see render-hook-smoke.test.ts). The hook
 * holds no React state, so its callbacks are called directly.
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
const mockPreparePhotoForStorage = jest.fn()
const mockDeleteAttachmentFile = jest.fn()

// auth-errors.ts imports react-native-auth0 for CredentialsManagerError; mock it
// minimally so the module resolves under the node test environment (no native code).
jest.mock("react-native-auth0", () => ({
  CredentialsManagerError: class MockCredentialsManagerError extends Error {},
  CredentialsManagerErrorCodes: {},
}))
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
jest.mock("../../storage/attachments", () => ({
  preparePhotoForStorage: mockPreparePhotoForStorage,
}))
jest.mock("../../storage/attachment-files", () => ({
  deleteAttachmentFile: mockDeleteAttachmentFile,
}))

import { cleanup, renderHook } from "@testing-library/react-native/pure"
import * as ImagePicker from "expo-image-picker"
import { Alert } from "react-native"
import { fr } from "../../i18n"
import { useSurveySyncSurveyOperations } from "./useSurveySyncSurveyOperations"
import { createSyncActivity } from "./sync-activity"

const text = fr.status.surveyOps
// The test surveys carry no site_name, so messages name them with the fallback.
const name = fr.common.untitledSurvey

async function buildHook(overrides: Record<string, unknown> = {}) {
  const params = {
    apiUrl: "http://localhost:3000",
    accessToken: "access-token",
    selectedSurveyId: null,
    editingSurveyId: null,
    surveys: [],
    clearSession: jest.fn().mockResolvedValue(undefined),
    refreshSessionTokens: jest.fn().mockResolvedValue({ accessToken: "new-token" }),
    withAuthRetry: jest.fn((fn: (token: string, tokenSub: string | null) => unknown) =>
      fn("token", "auth0|owner"),
    ),
    refreshLocalSurveys: jest.fn().mockResolvedValue(undefined),
    refreshLocalAttachments: jest.fn().mockResolvedValue(undefined),
    onCloseSurveyDetail: jest.fn(),
    onStopEditing: jest.fn(),
    setStatus: jest.fn(),
    maybeAutoSync: jest.fn().mockResolvedValue(undefined),
    handleLoadCanonicalDetails: jest.fn().mockResolvedValue(undefined),
    syncAllowed: true,
    ensureSyncOwner: jest.fn().mockResolvedValue(true),
    syncActivity: createSyncActivity(),
    ...overrides,
  }
  const { result } = await renderHook(() => useSurveySyncSurveyOperations(params as never))
  return { ...result.current, ...params }
}

describe("useSurveySyncSurveyOperations", () => {
  // logStatusDetail writes raw error detail to console.debug in dev builds.
  let debug: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    debug = jest.spyOn(console, "debug").mockImplementation(() => undefined)
  })

  afterEach(async () => {
    debug.mockRestore()
    await cleanup()
  })

  // ─── handleSubmitSurvey ───────────────────────────────────────────────────

  describe("handleSubmitSurvey", () => {
    test("sets status when survey not found", async () => {
      mockGetSubmitBlockReason.mockReturnValue("not_found")
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.notFound())
    })

    test("sets status when global sync conflict", async () => {
      mockGetSubmitBlockReason.mockReturnValue("global_blocked")
      const { handleSubmitSurvey, setStatus } = await buildHook({
        surveys: [{ id: "survey-1", sync_blocked: 1 }],
      })
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.conflictUnresolved({ name }))
    })

    test("sets status when already submitted", async () => {
      mockGetSubmitBlockReason.mockReturnValue("already_submitted")
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.alreadySubmitted({ name }))
    })

    test("sets status when not synced", async () => {
      mockGetSubmitBlockReason.mockReturnValue("not_synced")
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.notSynced({ name }))
    })

    test("sets status when survey-level sync conflict", async () => {
      mockGetSubmitBlockReason.mockReturnValue("survey_blocked")
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.surveyConflict({ name }))
    })

    test("sets status when draft not found locally", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue(null)
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.notFound())
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
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(
        text.notReady({ name, details: text.readiness.missingFactors({ factors: "A1" }) }),
      )
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
      const { handleSubmitSurvey, refreshLocalSurveys } = await buildHook()
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
      mockSubmitSurvey.mockResolvedValue({ ok: true })
      const { handleSubmitSurvey, setStatus, refreshLocalSurveys } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.submitted({ name }))
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
      const { handleSubmitSurvey, clearSession } = await buildHook({
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
      const { handleSubmitSurvey, setStatus } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Network error")),
      })
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.submitFailed({ name }))
    })

    test("logs the raw error for dev tools and keeps the id and error text out of the status", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({ parcel_ids: ["p1"] })
      mockEvaluateSubmitReadiness.mockReturnValue({ ready: true })
      const failure = new Error("socket hang up")
      const { handleSubmitSurvey, setStatus } = await buildHook({
        surveys: [{ id: "survey-1", site_name: "Parcelle A" }],
        withAuthRetry: jest.fn().mockRejectedValue(failure),
      })
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.submitFailed({ name: "Parcelle A" }))
      const shown = (setStatus as jest.Mock).mock.calls[0][0] as string
      expect(shown).not.toContain("survey-1")
      expect(shown).not.toContain("socket hang up")
      expect(debug).toHaveBeenCalledWith("[status] surveyOps.submit", failure)
    })

    test("names the missing fields when the draft is not ready", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({ parcel_ids: [] })
      mockEvaluateSubmitReadiness.mockReturnValue({
        ready: false,
        expired: false,
        missing_factors: [],
        missing_fields: ["region_version", "vegetation_stage", "parcel_ids"],
      })
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(
        text.notReady({
          name,
          details: [
            text.readiness.missingRegion,
            text.readiness.missingVegetationStage,
            text.readiness.missingParcels,
          ].join(" ; "),
        }),
      )
    })

    test("reports an expired draft and a draft with nothing named missing", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({ parcel_ids: [] })
      mockEvaluateSubmitReadiness.mockReturnValueOnce({
        ready: false,
        expired: true,
        missing_factors: [],
        missing_fields: [],
      })
      mockEvaluateSubmitReadiness.mockReturnValueOnce({
        ready: false,
        expired: false,
        missing_factors: [],
        missing_fields: [],
      })
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenNthCalledWith(1, text.expired({ name }))
      expect(setStatus).toHaveBeenNthCalledWith(2, text.notReadyGeneric({ name }))
    })

    test("reports a rejected submit without the server text", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({ parcel_ids: ["p1"] })
      mockEvaluateSubmitReadiness.mockReturnValue({ ready: true })
      mockSubmitSurvey.mockResolvedValue({ ok: false, message: "factor A invalid" })
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.submitRejected({ name }))
    })

    test("reports a failed readiness check without the error text", async () => {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockRejectedValue(new Error("db locked"))
      const { handleSubmitSurvey, setStatus } = await buildHook()
      await handleSubmitSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.submitCheckFailed({ name }))
    })
  })

  describe("handleSubmitSurvey owner gate (WR-01)", () => {
    function readyToSubmit() {
      mockGetSubmitBlockReason.mockReturnValue(null)
      mockGetLocalSurveyDraft.mockResolvedValue({
        region_version: "v1",
        vegetation_stage: "stage",
        factors: {},
        parcel_ids: [],
        expires_at: null,
      })
      mockEvaluateSubmitReadiness.mockReturnValue({ ready: true })
    }

    test("does not submit when syncAllowed is false", async () => {
      readyToSubmit()
      const { handleSubmitSurvey, withAuthRetry } = await buildHook({ syncAllowed: false })
      await handleSubmitSurvey("survey-1")
      expect(withAuthRetry).not.toHaveBeenCalled()
      expect(mockSubmitSurvey).not.toHaveBeenCalled()
    })

    test("the execution-time owner check blocks submitSurvey", async () => {
      readyToSubmit()
      const { handleSubmitSurvey, setStatus } = await buildHook({
        ensureSyncOwner: jest.fn().mockResolvedValue(false),
      })
      await handleSubmitSurvey("survey-1")
      expect(mockSubmitSurvey).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(text.submitPostponed({ name }))
    })
  })

  // ─── handleRetrySurvey ────────────────────────────────────────────────────

  describe("handleRetrySurvey", () => {
    test("retries and sets status on success", async () => {
      mockRetrySurveyNow.mockResolvedValue({ queued: 1 })
      const { handleRetrySurvey, setStatus, refreshLocalSurveys } = await buildHook()
      await handleRetrySurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.retryQueued({ count: 1 }))
      expect(refreshLocalSurveys).toHaveBeenCalled()
    })

    test("sets error status on failure", async () => {
      mockRetrySurveyNow.mockRejectedValue(new Error("Retry failed"))
      const { handleRetrySurvey, setStatus } = await buildHook()
      await handleRetrySurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.retryFailed())
    })
  })

  // ─── handleDiscardSurvey ──────────────────────────────────────────────────

  describe("handleDiscardSurvey", () => {
    test("discards and sets status on success", async () => {
      mockDiscardSurveyLocalChanges.mockResolvedValue({ removed_queue: 2 })
      const { handleDiscardSurvey, setStatus } = await buildHook()
      await handleDiscardSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.discarded({ count: 2 }))
    })

    test("sets error status on failure", async () => {
      mockDiscardSurveyLocalChanges.mockRejectedValue(new Error("Discard failed"))
      const { handleDiscardSurvey, setStatus } = await buildHook()
      await handleDiscardSurvey("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.discardFailed())
    })
  })

  // ─── handleToggleVisibility ───────────────────────────────────────────────

  describe("handleToggleVisibility", () => {
    const QUEUED = {
      ok: true,
      visibility: "public",
      queued: true,
      synced: false,
    }

    test("queues locally, then syncs through the owner-guarded withAuthRetry", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue(QUEUED)
      mockSyncPending.mockResolvedValue({ synced: 1, failed: 0 })
      const { handleToggleVisibility, setStatus, handleLoadCanonicalDetails, ensureSyncOwner } =
        await buildHook()
      await handleToggleVisibility("survey-1", "public")
      // Queue-only call: updateSurveyVisibility never drains the queue itself.
      expect(mockUpdateSurveyVisibility).toHaveBeenCalledWith(
        "http://localhost:3000",
        "",
        "survey-1",
        "public",
      )
      expect(ensureSyncOwner).toHaveBeenCalledWith("auth0|owner")
      expect(mockSyncPending).toHaveBeenCalledWith("http://localhost:3000", "token")
      expect(handleLoadCanonicalDetails).toHaveBeenCalledWith("survey-1", { silent: true })
      expect(setStatus).toHaveBeenCalledWith(
        text.visibilitySynced({ visibility: text.visibility.public }),
      )
    })

    test("reports the unchanged visibility without syncing", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue({
        ok: true,
        message: "Visibility already public",
        queued: false,
        synced: false,
      })
      const { handleToggleVisibility, setStatus } = await buildHook()
      await handleToggleVisibility("survey-1", "public")
      expect(mockSyncPending).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(
        text.visibilityUnchanged({ visibility: text.visibility.public }),
      )
    })

    test("keeps the change queued and asks for login when signed out", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue(QUEUED)
      const { handleToggleVisibility, setStatus } = await buildHook({ accessToken: "" })
      await handleToggleVisibility("survey-1", "private")
      expect(mockSyncPending).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(
        text.visibilityQueuedLoginRequired({ visibility: text.visibility.private }),
      )
    })

    test("sets warning status when sync reports failures", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue(QUEUED)
      mockSyncPending.mockResolvedValue({ synced: 0, failed: 2 })
      const { handleToggleVisibility, setStatus } = await buildHook()
      await handleToggleVisibility("survey-1", "public")
      expect(setStatus).toHaveBeenCalledWith(text.visibilitySyncWarning({ failed: 2 }))
    })

    test("calls clearSession when the session ended (AUTH_REQUIRED)", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue(QUEUED)
      const { handleToggleVisibility, clearSession, setStatus } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })
      await handleToggleVisibility("survey-1", "public")
      expect(clearSession).toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(text.visibilityLoginRequired())
    })

    test("keeps the change queued when sync fails", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue(QUEUED)
      const { handleToggleVisibility, setStatus } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("Network down")),
      })
      await handleToggleVisibility("survey-1", "public")
      expect(setStatus).toHaveBeenCalledWith(
        text.visibilityQueuedSyncPending({ visibility: text.visibility.public }),
      )
    })

    test("sets error status on exception", async () => {
      mockUpdateSurveyVisibility.mockRejectedValue(new Error("Visibility error"))
      const { handleToggleVisibility, setStatus } = await buildHook()
      await handleToggleVisibility("survey-1", "public")
      expect(setStatus).toHaveBeenCalledWith(text.visibilityFailed())
    })

    test("WR-01: queues only and never drains the queue when syncAllowed is false", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue(QUEUED)
      const { handleToggleVisibility, withAuthRetry, setStatus } = await buildHook({
        syncAllowed: false,
      })
      await handleToggleVisibility("survey-1", "public")
      expect(mockUpdateSurveyVisibility).toHaveBeenCalledWith(
        "http://localhost:3000",
        "",
        "survey-1",
        "public",
      )
      expect(withAuthRetry).not.toHaveBeenCalled()
      expect(mockSyncPending).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(
        text.visibilityQueuedOwnerPending({ visibility: text.visibility.public }),
      )
    })

    test("WR-01: the execution-time owner check blocks syncPending", async () => {
      mockUpdateSurveyVisibility.mockResolvedValue(QUEUED)
      const { handleToggleVisibility } = await buildHook({
        ensureSyncOwner: jest.fn().mockResolvedValue(false),
      })
      await handleToggleVisibility("survey-1", "public")
      expect(mockSyncPending).not.toHaveBeenCalled()
    })
  })

  // ─── confirmDeleteSurvey ──────────────────────────────────────────────────

  describe("confirmDeleteSurvey", () => {
    test("shows an Alert with Delete and Cancel options", async () => {
      const { confirmDeleteSurvey } = await buildHook()
      confirmDeleteSurvey("survey-1")
      expect(Alert.alert).toHaveBeenCalledWith(
        text.alerts.deleteSurvey.title,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: fr.common.actions.cancel }),
          expect.objectContaining({ text: fr.common.actions.delete }),
        ]),
      )
    })
  })

  // ─── handleQueueAttachmentFromLibrary ─────────────────────────────────────

  describe("handleQueueAttachmentFromLibrary", () => {
    test("sets status for submitted survey", async () => {
      const { handleQueueAttachmentFromLibrary, setStatus } = await buildHook({
        surveys: [{ id: "survey-1", status: "submitted" }],
      })
      await handleQueueAttachmentFromLibrary("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.readOnly({ name }))
    })

    test("sets status when permission denied", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      })
      const { handleQueueAttachmentFromLibrary, setStatus } = await buildHook()
      await handleQueueAttachmentFromLibrary("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.mediaLibraryPermissionRequired())
    })

    test("sets status when picker cancelled", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handleQueueAttachmentFromLibrary, setStatus } = await buildHook()
      await handleQueueAttachmentFromLibrary("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.noImageSelected())
    })

    test("prepares the photo and queues it with the prepared uri/size on success", async () => {
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
      mockPreparePhotoForStorage.mockResolvedValue({
        uri: "file:///mock/documents/attachments/abc.jpg",
        sizeBytes: 54321,
        mimeType: "image/jpeg",
        width: 100,
        height: 100,
      })
      mockQueueLocalAttachment.mockResolvedValue(undefined)
      const { handleQueueAttachmentFromLibrary, setStatus } = await buildHook()
      await handleQueueAttachmentFromLibrary("survey-1")

      expect(mockPreparePhotoForStorage).toHaveBeenCalledWith({
        uri: "file://photo.jpg",
        width: 100,
        height: 100,
        mimeType: "image/jpeg",
      })
      expect(mockQueueLocalAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          survey_id: "survey-1",
          local_uri: "file:///mock/documents/attachments/abc.jpg",
          mime_type: "image/jpeg",
          size_bytes: 54321,
          metadata: expect.objectContaining({
            source: "library",
            width: 100,
            height: 100,
            original_width: 100,
            original_height: 100,
          }),
        }),
      )
      expect(setStatus).toHaveBeenCalledWith(text.photoQueued({ name }))
    })

    test("does not queue and reports the error when preparePhotoForStorage rejects", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file://photo.jpg", width: 100, height: 100 }],
      })
      mockPreparePhotoForStorage.mockRejectedValue(new Error("resize failed"))
      const { handleQueueAttachmentFromLibrary, setStatus } = await buildHook()
      await handleQueueAttachmentFromLibrary("survey-1")

      expect(mockQueueLocalAttachment).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(text.attachmentQueueFailed())
    })

    test("deletes the persisted file when queueLocalAttachment rejects after preparation", async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
      })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: "file://photo.jpg", width: 100, height: 100 }],
      })
      mockPreparePhotoForStorage.mockResolvedValue({
        uri: "file:///mock/documents/attachments/abc.jpg",
        sizeBytes: 54321,
        mimeType: "image/jpeg",
        width: 100,
        height: 100,
      })
      mockQueueLocalAttachment.mockRejectedValue(new Error("db error"))
      const { handleQueueAttachmentFromLibrary, setStatus } = await buildHook()
      await handleQueueAttachmentFromLibrary("survey-1")

      expect(mockDeleteAttachmentFile).toHaveBeenCalledWith(
        "file:///mock/documents/attachments/abc.jpg",
      )
      expect(setStatus).toHaveBeenCalledWith(text.attachmentQueueFailed())
    })
  })

  // ─── handleQueueAttachmentFromCamera ─────────────────────────────────────

  describe("handleQueueAttachmentFromCamera", () => {
    test("sets status when camera permission denied", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
      })
      const { handleQueueAttachmentFromCamera, setStatus } = await buildHook()
      await handleQueueAttachmentFromCamera("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.cameraPermissionRequired())
    })

    test("sets status when camera cancelled", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
      ;(ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true })
      const { handleQueueAttachmentFromCamera, setStatus } = await buildHook()
      await handleQueueAttachmentFromCamera("survey-1")
      expect(setStatus).toHaveBeenCalledWith(text.noPhotoCaptured())
    })

    test("prepares the captured photo and queues it with the prepared uri/size on success", async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
      ;(ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [
          {
            uri: "file://camera-photo.jpg",
            mimeType: "image/jpeg",
            fileName: "camera-photo.jpg",
            width: 4032,
            height: 3024,
          },
        ],
      })
      mockPreparePhotoForStorage.mockResolvedValue({
        uri: "file:///mock/documents/attachments/def.jpg",
        sizeBytes: 98765,
        mimeType: "image/jpeg",
        width: 2048,
        height: 1536,
      })
      mockQueueLocalAttachment.mockResolvedValue(undefined)
      const { handleQueueAttachmentFromCamera, setStatus } = await buildHook()
      await handleQueueAttachmentFromCamera("survey-1")

      expect(mockPreparePhotoForStorage).toHaveBeenCalledWith({
        uri: "file://camera-photo.jpg",
        width: 4032,
        height: 3024,
        mimeType: "image/jpeg",
      })
      expect(mockQueueLocalAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          survey_id: "survey-1",
          local_uri: "file:///mock/documents/attachments/def.jpg",
          mime_type: "image/jpeg",
          size_bytes: 98765,
          metadata: expect.objectContaining({
            source: "camera",
            width: 2048,
            height: 1536,
            original_width: 4032,
            original_height: 3024,
          }),
        }),
      )
      expect(setStatus).toHaveBeenCalledWith(text.cameraPhotoQueued({ name }))
    })
  })

  // ─── handleDeleteAttachment ───────────────────────────────────────────────

  describe("handleDeleteAttachment", () => {
    test("sets status for submitted survey", async () => {
      const { handleDeleteAttachment, setStatus } = await buildHook({
        surveys: [{ id: "survey-1", status: "submitted" }],
      })
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(text.readOnly({ name }))
    })

    test("sets status when attachment not found locally", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: false, queued_delete: false })
      const { handleDeleteAttachment, setStatus } = await buildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(text.attachmentNotFound())
    })

    test("removes locally and syncs when queued_delete is true", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: true })
      mockSyncPending.mockResolvedValue({
        synced: 1,
        failed: 0,
        pulled_surveys: 0,
        pulled_attachments: 0,
      })
      const { handleDeleteAttachment, setStatus } = await buildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(text.attachmentRemovedSynced({ failed: 0 }))
    })

    test("handles AUTH_REQUIRED during sync after delete", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: true })
      const { handleDeleteAttachment, setStatus } = await buildHook({
        withAuthRetry: jest.fn().mockRejectedValue(new Error("AUTH_REQUIRED")),
      })
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(text.attachmentRemovedLoginRequired())
    })

    test("removes locally without sync when queued_delete is false", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: false })
      const { handleDeleteAttachment, setStatus } = await buildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(text.attachmentRemoved())
    })

    test("WR-01: removes locally without draining the queue when syncAllowed is false", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: true })
      const { handleDeleteAttachment, withAuthRetry, setStatus } = await buildHook({
        syncAllowed: false,
      })
      await handleDeleteAttachment("survey-1", "att-1")
      expect(withAuthRetry).not.toHaveBeenCalled()
      expect(mockSyncPending).not.toHaveBeenCalled()
      expect(setStatus).toHaveBeenCalledWith(text.attachmentRemovedOwnerPending())
    })

    test("WR-01: the execution-time owner check blocks syncPending", async () => {
      mockQueueDeleteAttachment.mockResolvedValue({ removed_local: true, queued_delete: true })
      const ensureSyncOwner = jest.fn().mockResolvedValue(false)
      const { handleDeleteAttachment } = await buildHook({ ensureSyncOwner })
      await handleDeleteAttachment("survey-1", "att-1")
      expect(ensureSyncOwner).toHaveBeenCalledWith("auth0|owner")
      expect(mockSyncPending).not.toHaveBeenCalled()
    })

    test("sets error status on exception", async () => {
      mockQueueDeleteAttachment.mockRejectedValue(new Error("Delete failed"))
      const { handleDeleteAttachment, setStatus } = await buildHook()
      await handleDeleteAttachment("survey-1", "att-1")
      expect(setStatus).toHaveBeenCalledWith(text.attachmentDeleteFailed())
    })
  })
})
