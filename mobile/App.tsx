import { useEffect, useMemo, useState } from 'react'
import { Alert, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { initLocalDb } from './src/storage'
import { AuthenticatedAppNavigation, FormMode } from './src/app/AuthenticatedAppNavigation'
import { styles } from './src/app/styles'
import { SurveyDetailTab } from './src/app/types'
import { useSurveyForm } from './src/hooks/useSurveyForm'
import { useSurveyList } from './src/hooks/useSurveyList'
import { usePublicMapExplorer } from './src/hooks/usePublicMapExplorer'
import { useSurveySync } from './src/hooks/useSurveySync'
import { useAuthenticationState } from './src/hooks/useAuthenticationState'
import { useEditingDraft } from './src/hooks/useEditingDraft'
import { useSurveyDraftPatcher } from './src/hooks/useSurveyDraftPatcher'
import { useGpsCapture } from './src/hooks/useGpsCapture'
import { AuthGateScreen } from './src/screens/AuthGateScreen'

export default function App() {
  const auth = useAuthenticationState()
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>('summary')

  const surveyForm = useSurveyForm()
  const surveyList = useSurveyList()
  const ownSurveyIds = useMemo(() => surveyList.surveys.map((survey) => survey.id), [surveyList.surveys])
  const editingSurveyVisibility = useMemo(
    () =>
      editingSurveyId
        ? (surveyList.surveys.find((survey) => survey.id === editingSurveyId)?.visibility ?? 'private')
        : 'private',
    [editingSurveyId, surveyList.surveys],
  )

  const closeSurveyDetailSelection = (): void => {
    surveyList.closeSurvey()
    setSurveyDetailTab('summary')
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
      setFormMode('create')
    },
  })

  const publicMapExplorer = usePublicMapExplorer({
    apiUrl: auth.apiUrl,
    onStatusChange: surveySync.setStatus,
  })

  const editing = useEditingDraft({
    editingSurveyId,
    setEditingSurveyId,
    editingSurveyVisibility,
    setFormMode,
    surveyForm,
    surveyList,
    onStatusChange: surveySync.setStatus,
    onCloseSurveyDetail: closeSurveyDetailSelection,
  })

  const draftPatcher = useSurveyDraftPatcher({
    surveyList,
    onStatusChange: surveySync.setStatus,
  })

  const gpsCapture = useGpsCapture({
    surveyForm,
    onStatusChange: surveySync.setStatus,
    onAlert: (title, message) => Alert.alert(title, message),
  })

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb()
      await surveyList.refreshLocalSurveys()
      await surveyList.refreshLocalAttachments()
    }

    bootstrap().catch((error) => surveySync.setStatus(`Init error: ${(error as Error).message}`))
  }, [])

  const handleOpenSurvey = (surveyId: string): void => {
    surveyList.openSurvey(surveyId)
    setSurveyDetailTab('summary')
    surveySync.setStatus(`Survey ${surveyId} opened`)
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.container}
        edges={surveySync.isAuthenticated ? ['top', 'left', 'right'] : ['left', 'right']}
      >
        <View style={styles.appLayout}>
          {!surveySync.isAuthenticated ? (
            <AuthGateScreen
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
              logoSource={require('./assets/logo-etats-sauvages-cropped.png')}
              heroMartenSource={require('./assets/auth/marten.png')}
              status={surveySync.sessionRestoring ? 'Restoring session...' : surveySync.status}
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
