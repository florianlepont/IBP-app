import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Alert } from "react-native"
import { loadStoredApiUrl, saveStoredApiUrl } from "../app/api-url-storage"
import type { FormMode } from "../navigation/types"
import { DEFAULT_API_URL } from "../app/constants"
import { shouldShowDevTools } from "../app/dev-tools"
import type { SurveyDetailTab, SurveyStats } from "../app/types"
import { useEditingDraft } from "../hooks/useEditingDraft"
import { useGpsCapture } from "../hooks/useGpsCapture"
import { useNearbyParcels } from "../hooks/useNearbyParcels"
import { useSurveyDraftPatcher } from "../hooks/useSurveyDraftPatcher"
import { useSurveyForm } from "../hooks/useSurveyForm"
import { useSurveyList } from "../hooks/useSurveyList"
import { useSurveySync } from "../hooks/useSurveySync"
import { fr, logStatusDetail } from "../i18n"
import { persistLegacyAttachmentFiles } from "../storage/attachments"
import { initLocalDb } from "../storage/db"
import {
  AccessTokenProvider,
  SessionProvider,
  type AccessTokenContextValue,
  type SessionContextValue,
} from "./session-context"
import { StatusProvider, type StatusContextValue } from "./status-context"
import { NearbyParcelsProvider, type NearbyParcelsContextValue } from "./nearby-parcels-context"
import { SurveyFormProvider, type SurveyFormContextValue } from "./survey-form-context"
import {
  SurveyActionsProvider,
  SurveysProvider,
  type SurveyActions,
  type SurveysContextValue,
} from "./surveys-context"
import { SyncActionsProvider } from "./sync-actions-context"
import { useLatestCallback, useStableActions } from "./useLatestCallback"

/**
 * The single assembler (phase 01.9, D-01). It holds what App.tsx held before:
 * every stateful hook is called here ONCE, so there is one sync-activity
 * tracker, one set of network listeners and one owner gate (01.5 WR-08,
 * T-01.9-18). Each context value is memoised over its own fields and every
 * action group is a stable object, so a status update changes only the status
 * value and a keystroke changes only the form value.
 */
function useAppController() {
  const [apiUrl, setApiUrlState] = useState(
    () => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL,
  )
  const [formMode, setFormMode] = useState<FormMode>("create")
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>("summary")

  useEffect(() => {
    if (!shouldShowDevTools()) return
    void loadStoredApiUrl()
      .then((stored) => {
        if (stored) setApiUrlState(stored)
      })
      .catch(() => undefined)
  }, [])

  const setApiUrl = useCallback((value: string): void => {
    setApiUrlState(value)
    void saveStoredApiUrl(value).catch(() => undefined)
  }, [])

  const surveyForm = useSurveyForm()
  const surveyList = useSurveyList()
  const { refreshLocalSurveys, refreshLocalAttachments, closeSurvey } = surveyList
  const ownSurveyIds = useMemo(
    () => surveyList.surveys.map((survey) => survey.id),
    [surveyList.surveys],
  )
  const editingSurveyVisibility = useMemo(
    () =>
      editingSurveyId
        ? (surveyList.surveys.find((survey) => survey.id === editingSurveyId)?.visibility ??
          "private")
        : "private",
    [editingSurveyId, surveyList.surveys],
  )

  const closeSurveyDetailSelection = useCallback((): void => {
    closeSurvey()
    setSurveyDetailTab("summary")
  }, [closeSurvey])

  const stopEditing = useCallback((): void => {
    setEditingSurveyId(null)
    setFormMode("create")
  }, [])

  const surveySync = useSurveySync({
    apiUrl,
    surveys: surveyList.surveys,
    selectedSurveyId: surveyList.selectedSurveyId,
    surveyDetailTab,
    editingSurveyId,
    refreshLocalSurveys,
    refreshLocalAttachments,
    onCloseSurveyDetail: closeSurveyDetailSelection,
    onStopEditing: stopEditing,
  })
  const setStatus = surveySync.syncActions.setStatus

  const nearbyParcels = useNearbyParcels(apiUrl)

  const surveyStats = useMemo((): SurveyStats => {
    const surveys = surveyList.surveys
    return {
      total: surveys.length,
      draft: surveys.filter((s) => s.status === "draft").length,
      submitted: surveys.filter((s) => s.status === "submitted").length,
      pending: surveys.filter((s) => s.sync_state === "pending").length,
      synced: surveys.filter((s) => s.sync_state === "synced").length,
      failed: surveys.filter((s) => s.sync_state === "failed").length,
      blocked: surveys.filter((s) => s.sync_blocked).length,
    }
  }, [surveyList.surveys])

  const editing = useEditingDraft({
    editingSurveyId,
    setEditingSurveyId,
    editingSurveyVisibility,
    setFormMode,
    surveyForm,
    surveyList,
    onStatusChange: setStatus,
    onCloseSurveyDetail: closeSurveyDetailSelection,
  })

  const draftPatcher = useSurveyDraftPatcher({
    surveyList,
    onStatusChange: setStatus,
  })

  const showAlert = useCallback((title: string, message: string): void => {
    Alert.alert(title, message)
  }, [])

  const gpsCapture = useGpsCapture({
    surveyForm,
    onStatusChange: setStatus,
    onAlert: showAlert,
  })

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb()
      // Best-effort: rescue photos captured by older app versions from the
      // OS-purgeable cache before the app starts using them (T-01.5-26). Must
      // never block startup.
      await persistLegacyAttachmentFiles().catch(() => undefined)
      await refreshLocalSurveys()
      await refreshLocalAttachments()
    }

    bootstrap().catch((error: unknown) => {
      logStatusDetail("app.init", error)
      setStatus(fr.status.app.initFailed())
    })
  }, [refreshLocalAttachments, refreshLocalSurveys, setStatus])

  const openSurvey = useCallback(
    (surveyId: string): void => {
      surveyList.openSurvey(surveyId)
      setSurveyDetailTab("summary")
      const opened = surveyList.surveys.find((survey) => survey.id === surveyId)
      setStatus(
        fr.status.app.surveyOpened({
          name: opened?.site_name?.trim() || fr.common.untitledSurvey,
        }),
      )
    },
    [setStatus, surveyList],
  )

  // ─── Session ───────────────────────────────────────────────────────────────

  const sessionActions = useStableActions({ setApiUrl, ...surveySync.sessionActions })
  const { sessionState: syncSessionState } = surveySync
  const session = useMemo<SessionContextValue>(
    () => ({ state: { apiUrl, ...syncSessionState }, actions: sessionActions }),
    [apiUrl, syncSessionState, sessionActions],
  )

  const rawAccessToken = surveySync.accessToken
  const accessToken = useMemo<AccessTokenContextValue>(
    () => ({ accessToken: rawAccessToken || null }),
    [rawAccessToken],
  )

  // ─── Status and sync actions ───────────────────────────────────────────────

  const statusText = surveySync.status
  const status = useMemo<StatusContextValue>(() => ({ status: statusText }), [statusText])

  const syncActions = useStableActions({
    ...surveySync.syncActions,
    refreshLocalSurveys,
    refreshLocalAttachments,
  })

  // ─── Surveys ───────────────────────────────────────────────────────────────

  const ops = surveySync.surveyOperations
  const surveyActions: SurveyActions = useStableActions({
    setSurveyQuery: surveyList.setSurveyQuery,
    setSurveyFromDate: surveyList.setSurveyFromDate,
    setSurveyToDate: surveyList.setSurveyToDate,
    setStatusFilter: surveyList.setStatusFilter,
    setVisibilityFilter: surveyList.setVisibilityFilter,
    setSyncFilter: surveyList.setSyncFilter,
    setBlockedFilter: surveyList.setBlockedFilter,
    setAttachmentFilter: surveyList.setAttachmentFilter,
    setSortMode: surveyList.setSortMode,
    resetFilters: surveyList.resetFilters,
    openSurvey,
    closeSurveyDetailSelection,
    setSurveyDetailTab,
    submitSurvey: ops.handleSubmitSurvey,
    retrySurvey: ops.handleRetrySurvey,
    discardSurvey: ops.handleDiscardSurvey,
    toggleVisibility: ops.handleToggleVisibility,
    confirmDeleteSurvey: ops.confirmDeleteSurvey,
    queueAttachmentFromLibrary: ops.handleQueueAttachmentFromLibrary,
    queueAttachmentFromCamera: ops.handleQueueAttachmentFromCamera,
    deleteAttachment: ops.handleDeleteAttachment,
    loadCanonicalDetails: ops.handleLoadCanonicalDetails,
    loadSurveyEvents: ops.handleLoadSurveyEvents,
    openCreateSurvey: editing.handleOpenCreateSurvey,
    startEditSurvey: editing.handleStartEditSurvey,
    renameSurvey: draftPatcher.handleRenameSurvey,
    updateRegionVersion: draftPatcher.handleUpdateSurveyRegionVersion,
    updateVegetationStage: draftPatcher.handleUpdateSurveyVegetationStage,
  })

  const {
    surveys,
    visibleSurveys,
    selectedSurveyId,
    selectedSurvey,
    selectedSurveyAttachments,
    attachmentsBySurvey,
    surveyQuery,
    surveyFromDate,
    surveyToDate,
    statusFilter,
    visibilityFilter,
    syncFilter,
    blockedFilter,
    attachmentFilter,
    sortMode,
  } = surveyList
  const { surveyDetailsState } = surveySync
  const surveysValue = useMemo<SurveysContextValue>(
    () => ({
      state: {
        surveys,
        visibleSurveys,
        selectedSurveyId,
        selectedSurvey,
        selectedSurveyAttachments,
        attachmentsBySurvey,
        surveyQuery,
        surveyFromDate,
        surveyToDate,
        statusFilter,
        visibilityFilter,
        syncFilter,
        blockedFilter,
        attachmentFilter,
        sortMode,
        ...surveyDetailsState,
        surveyStats,
        ownSurveyIds,
        surveyDetailTab,
        editingSurveyId,
        formMode,
      },
      actions: surveyActions,
    }),
    [
      surveys,
      visibleSurveys,
      selectedSurveyId,
      selectedSurvey,
      selectedSurveyAttachments,
      attachmentsBySurvey,
      surveyQuery,
      surveyFromDate,
      surveyToDate,
      statusFilter,
      visibilityFilter,
      syncFilter,
      blockedFilter,
      attachmentFilter,
      sortMode,
      surveyDetailsState,
      surveyStats,
      ownSurveyIds,
      surveyDetailTab,
      editingSurveyId,
      formMode,
      surveyActions,
    ],
  )

  // ─── Survey form ───────────────────────────────────────────────────────────

  const formActions = useStableActions({
    setSiteName: surveyForm.setSiteName,
    setVegetationStage: surveyForm.setVegetationStage,
    setSelectedParcelIds: surveyForm.setSelectedParcelIds,
    toggleParcelSelection: surveyForm.toggleParcelSelection,
    applyGpsLocation: surveyForm.applyGpsLocation,
    handleRegionChange: surveyForm.handleRegionChange,
    applyDraftToForm: surveyForm.applyDraftToForm,
    resetSurveyForm: surveyForm.resetSurveyForm,
    buildDraftInput: surveyForm.buildDraftInput,
    saveSurveyEdits: editing.handleSaveSurveyEdits,
    createDraft: editing.handleCreateDraft,
    captureGpsLocation: gpsCapture.handleCaptureGpsLocation,
  })

  const {
    siteName,
    regionVersion,
    vegetationStage,
    gpsLocation,
    selectedParcelIds,
    factorSections,
    factorRetainedScores,
    formErrors,
    draftInput,
  } = surveyForm
  const form = useMemo<SurveyFormContextValue>(
    () => ({
      state: {
        siteName,
        regionVersion,
        vegetationStage,
        gpsLocation,
        selectedParcelIds,
        factorSections,
        factorRetainedScores,
        formErrors,
        draftInput,
        formMode,
        editingSurveyId,
      },
      actions: formActions,
    }),
    [
      siteName,
      regionVersion,
      vegetationStage,
      gpsLocation,
      selectedParcelIds,
      factorSections,
      factorRetainedScores,
      formErrors,
      draftInput,
      formMode,
      editingSurveyId,
      formActions,
    ],
  )

  // ─── Nearby parcels (home screen) ──────────────────────────────────────────

  const { parcels, sectorAvgScore, loading, locationDenied, error } = nearbyParcels
  const loadNearbyParcels = useLatestCallback(nearbyParcels.load)
  const nearby = useMemo<NearbyParcelsContextValue>(
    () => ({
      state: { parcels, sectorAvgScore, loading, locationDenied, error },
      load: loadNearbyParcels,
    }),
    [parcels, sectorAvgScore, loading, locationDenied, error, loadNearbyParcels],
  )

  return {
    session,
    accessToken,
    status,
    syncActions,
    surveys: surveysValue,
    surveyActions,
    form,
    nearby,
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { session, accessToken, status, syncActions, surveys, surveyActions, form, nearby } =
    useAppController()

  return (
    <SessionProvider value={session}>
      <AccessTokenProvider value={accessToken}>
        <StatusProvider value={status}>
          <SyncActionsProvider value={syncActions}>
            <SurveysProvider value={surveys}>
              <SurveyActionsProvider value={surveyActions}>
                <SurveyFormProvider value={form}>
                  <NearbyParcelsProvider value={nearby}>{children}</NearbyParcelsProvider>
                </SurveyFormProvider>
              </SurveyActionsProvider>
            </SurveysProvider>
          </SyncActionsProvider>
        </StatusProvider>
      </AccessTokenProvider>
    </SessionProvider>
  )
}
