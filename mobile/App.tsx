import { useEffect, useMemo, useState } from "react"
import { Alert, StyleSheet, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { initLocalDb } from "./src/storage/db"
import { AuthenticatedAppNavigation, FormMode } from "./src/app/AuthenticatedAppNavigation"
import { styles } from "./src/app/styles"
import { SurveyDetailTab } from "./src/app/types"
import { useSurveyForm } from "./src/hooks/useSurveyForm"
import { useSurveyList } from "./src/hooks/useSurveyList"
import { usePublicMapExplorer } from "./src/hooks/usePublicMapExplorer"
import { useSurveySync } from "./src/hooks/useSurveySync"
import { useEditingDraft } from "./src/hooks/useEditingDraft"
import { useSurveyDraftPatcher } from "./src/hooks/useSurveyDraftPatcher"
import { useGpsCapture } from "./src/hooks/useGpsCapture"
import { useNearbyParcels } from "./src/hooks/useNearbyParcels"
import { loadStoredApiUrl, saveStoredApiUrl } from "./src/app/api-url-storage"
import { DEFAULT_API_URL } from "./src/app/constants"
import type { SurveyStats } from "./src/app/types"
import { AuthGateScreen } from "./src/screens/AuthGateScreen"
import { ProfileSetupScreen } from "./src/screens/ProfileSetupScreen"

export default function App() {
  const [apiUrl, setApiUrl] = useState(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL)
  const [profileSetupSkipped, setProfileSetupSkipped] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>("create")
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>("summary")

  useEffect(() => {
    void loadStoredApiUrl()
      .then((stored) => {
        if (stored) setApiUrl(stored)
      })
      .catch(() => undefined)
  }, [])

  const handleApiUrlChange = (value: string): void => {
    setApiUrl(value)
    void saveStoredApiUrl(value).catch(() => undefined)
  }

  const surveyForm = useSurveyForm()
  const surveyList = useSurveyList()
  const refreshLocalSurveys = surveyList.refreshLocalSurveys
  const refreshLocalAttachments = surveyList.refreshLocalAttachments
  const openSurvey = surveyList.openSurvey
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

  const closeSurveyDetailSelection = (): void => {
    surveyList.closeSurvey()
    setSurveyDetailTab("summary")
  }

  const surveySync = useSurveySync({
    apiUrl,
    surveys: surveyList.surveys,
    selectedSurveyId: surveyList.selectedSurveyId,
    surveyDetailTab,
    editingSurveyId,
    refreshLocalSurveys: surveyList.refreshLocalSurveys,
    refreshLocalAttachments: surveyList.refreshLocalAttachments,
    onCloseSurveyDetail: closeSurveyDetailSelection,
    onStopEditing: () => {
      setEditingSurveyId(null)
      setFormMode("create")
    },
  })
  const setStatus = surveySync.setStatus

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

  const publicMapExplorer = usePublicMapExplorer({
    apiUrl,
    onStatusChange: setStatus,
  })

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

  const gpsCapture = useGpsCapture({
    surveyForm,
    onStatusChange: setStatus,
    onAlert: (title, message) => Alert.alert(title, message),
  })

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb()
      await refreshLocalSurveys()
      await refreshLocalAttachments()
    }

    bootstrap().catch((error) => setStatus(`Init error: ${(error as Error).message}`))
  }, [refreshLocalAttachments, refreshLocalSurveys, setStatus])

  const handleOpenSurvey = (surveyId: string): void => {
    openSurvey(surveyId)
    setSurveyDetailTab("summary")
    setStatus(`Survey ${surveyId} opened`)
  }

  const needsProfileSetup =
    !profileSetupSkipped &&
    surveySync.currentUser != null &&
    !surveySync.currentUser.first_name &&
    !surveySync.currentUser.last_name

  const showAuthOverlay = !surveySync.isAuthenticated
  const showProfileSetupOverlay = surveySync.isAuthenticated && needsProfileSetup

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={styles.container}>
          <SafeAreaView style={styles.container} edges={["left", "right"]}>
            <View style={styles.appLayout}>
              <AuthenticatedAppNavigation
                apiUrl={apiUrl}
                formMode={formMode}
                editingSurveyId={editingSurveyId}
                surveyStats={surveyStats}
                nearbyParcels={nearbyParcels}
                onLoadNearbyParcels={nearbyParcels.load}
                surveyDetailTab={surveyDetailTab}
                setSurveyDetailTab={setSurveyDetailTab}
                surveyForm={surveyForm}
                surveyList={surveyList}
                surveySync={surveySync}
                publicMapExplorer={publicMapExplorer}
                ownSurveyIds={ownSurveyIds}
                onOpenCreateSurvey={editing.handleOpenCreateSurvey}
                onOpenSurvey={handleOpenSurvey}
                onStartEditSurvey={editing.handleStartEditSurvey}
                onRenameSurvey={draftPatcher.handleRenameSurvey}
                onUpdateRegionVersion={draftPatcher.handleUpdateSurveyRegionVersion}
                onUpdateVegetationStage={draftPatcher.handleUpdateSurveyVegetationStage}
                onSaveSurveyEdits={editing.handleSaveSurveyEdits}
                onCreateDraft={editing.handleCreateDraft}
                onCaptureGpsLocation={gpsCapture.handleCaptureGpsLocation}
                onApiUrlChange={handleApiUrlChange}
                onCloseSurveyDetailSelection={closeSurveyDetailSelection}
              />
            </View>
          </SafeAreaView>

          {/* Auth screens rendered as overlays — outside the navigation tree so the
            NavigationContainer (and native tab bar) is always mounted and stable. */}
          {showAuthOverlay && (
            <View style={overlayStyles.fill}>
              <AuthGateScreen
                apiUrl={apiUrl}
                onApiUrlChange={handleApiUrlChange}
                onLogin={surveySync.handleLogin}
                onRegister={surveySync.handleRegister}
                onForgotPassword={surveySync.handleForgotPassword}
                sessionRestoring={surveySync.sessionRestoring}
                logoSource={require("./assets/logo-app.png")}
                heroMartenSource={require("./assets/auth/marten.png")}
              />
            </View>
          )}
          {showProfileSetupOverlay && (
            <View style={overlayStyles.fill}>
              <ProfileSetupScreen
                saving={surveySync.profileUpdating}
                logoSource={require("./assets/logo-app.png")}
                onSave={async (firstName, lastName) => {
                  await surveySync.handleUpdateProfile({
                    first_name: firstName,
                    last_name: lastName,
                    display_name: [firstName, lastName].filter(Boolean).join(" "),
                  })
                }}
                onSkip={() => setProfileSetupSkipped(true)}
              />
            </View>
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const overlayStyles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
})
