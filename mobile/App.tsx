import { useEffect, useMemo, useState } from "react"
import { Alert, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { initLocalDb } from "./src/storage"
import { AuthenticatedAppNavigation, FormMode } from "./src/app/AuthenticatedAppNavigation"
import { styles } from "./src/app/styles"
import { SurveyDetailTab } from "./src/app/types"
import { useSurveyForm } from "./src/hooks/useSurveyForm"
import { useSurveyList } from "./src/hooks/useSurveyList"
import { usePublicMapExplorer } from "./src/hooks/usePublicMapExplorer"
import { useSurveySync } from "./src/hooks/useSurveySync"
import { useAuthenticationState } from "./src/hooks/useAuthenticationState"
import { useEditingDraft } from "./src/hooks/useEditingDraft"
import { useSurveyDraftPatcher } from "./src/hooks/useSurveyDraftPatcher"
import { useGpsCapture } from "./src/hooks/useGpsCapture"
import { PreAuthNavigator } from "./src/app/PreAuthNavigator"

export default function App() {
  const auth = useAuthenticationState()
  const [formMode, setFormMode] = useState<FormMode>("create")
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>("summary")

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
    apiUrl: auth.apiUrl,
    email: auth.email,
    password: auth.password,
    displayName: auth.displayName,
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

  const publicMapExplorer = usePublicMapExplorer({
    apiUrl: auth.apiUrl,
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

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.container}
        edges={
          surveySync.isAuthenticated && !surveySync.pendingEmailVerification
            ? ["top", "left", "right"]
            : ["left", "right"]
        }
      >
        <View style={styles.appLayout}>
          {!surveySync.isAuthenticated || surveySync.pendingEmailVerification ? (
            <PreAuthNavigator
              apiUrl={auth.apiUrl}
              onApiUrlChange={auth.handleApiUrlChange}
              email={auth.email}
              onEmailChange={auth.setEmail}
              password={auth.password}
              onPasswordChange={auth.setPassword}
              displayName={auth.displayName}
              onDisplayNameChange={auth.setDisplayName}
              onLogin={surveySync.handleLogin}
              onRegister={surveySync.handleRegister}
              status={surveySync.sessionRestoring ? "Restoring session..." : surveySync.status}
              logoSource={require("./assets/logo-app.png")}
              heroMartenSource={require("./assets/auth/marten.png")}
              pendingEmailVerification={surveySync.pendingEmailVerification}
              devVerificationToken={surveySync.devVerificationToken}
              onVerifyEmail={surveySync.handleVerifyEmail}
              onResendVerification={surveySync.handleResendVerification}
              onCancelEmailVerification={surveySync.handleCancelEmailVerification}
            />
          ) : (
            <AuthenticatedAppNavigation
              apiUrl={auth.apiUrl}
              formMode={formMode}
              editingSurveyId={editingSurveyId}
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
              onApiUrlChange={auth.handleApiUrlChange}
              onCloseSurveyDetailSelection={closeSurveyDetailSelection}
            />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
