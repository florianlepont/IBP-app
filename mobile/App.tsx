import { useEffect, useState } from 'react';
import { Button, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { DEFAULT_API_URL } from './src/app/constants';
import { styles } from './src/app/styles';
import { AppScreen, SurveyDetailTab } from './src/app/types';
import { SurveyFormScreen } from './src/screens/SurveyFormScreen';
import { SurveyListScreen } from './src/screens/SurveyListScreen';
import { initLocalDb, createLocalDraft, getLocalSurveyDraft, updateLocalDraft } from './src/storage';
import { useSurveyForm } from './src/hooks/useSurveyForm';
import { useSurveyList } from './src/hooks/useSurveyList';
import { useSurveySync } from './src/hooks/useSurveySync';
import { SurveyDetailScreen } from './src/screens/SurveyDetailScreen';

export default function App() {
  const [apiUrl, setApiUrl] = useState(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL);
  const [email, setEmail] = useState('demo@ibp.local');
  const [password, setPassword] = useState('demo123');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [screen, setScreen] = useState<AppScreen>('list');
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>('summary');

  const surveyForm = useSurveyForm();
  const surveyList = useSurveyList();

  const closeSurveyDetailSelection = (): void => {
    surveyList.closeSurvey();
    setSurveyDetailTab('summary');
  };

  const surveySync = useSurveySync({
    apiUrl,
    email,
    password,
    surveys: surveyList.surveys,
    selectedSurveyId: surveyList.selectedSurveyId,
    surveyDetailTab,
    editingSurveyId,
    refreshLocalSurveys: surveyList.refreshLocalSurveys,
    refreshLocalAttachments: surveyList.refreshLocalAttachments,
    onCloseSurveyDetail: closeSurveyDetailSelection,
    onStopEditing: () => setEditingSurveyId(null)
  });

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb();
      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
    };

    bootstrap().catch((error) => surveySync.setStatus(`Init error: ${(error as Error).message}`));
  }, []);

  const handleOpenCreateSurvey = (): void => {
    setEditingSurveyId(null);
    closeSurveyDetailSelection();
    surveyForm.resetSurveyForm();
    setScreen('create');
    surveySync.setStatus('Create survey view opened');
  };

  const handleCreateDraft = async (): Promise<void> => {
    try {
      const created = await createLocalDraft(surveyForm.buildDraftInput());
      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
      setEditingSurveyId(null);
      surveyList.setSelectedSurveyId(created.id);
      setScreen('list');
      surveySync.setStatus('Local IBP draft created with raw observations');
    } catch (error) {
      surveySync.setStatus(`Draft error: ${(error as Error).message}`);
    }
  };

  const handleStartEditSurvey = async (surveyId: string): Promise<void> => {
    const current = surveyList.surveys.find((survey) => survey.id === surveyId);
    if (current?.status === 'submitted') {
      surveySync.setStatus(`Survey ${surveyId} is submitted and read-only`);
      return;
    }

    try {
      const draft = await getLocalSurveyDraft(surveyId);
      if (!draft) {
        surveySync.setStatus(`Survey not found locally: ${surveyId}`);
        return;
      }
      surveyForm.applyDraftToForm(draft);
      setEditingSurveyId(surveyId);
      surveyList.setSelectedSurveyId(surveyId);
      setScreen('edit');
      surveySync.setStatus(`Editing survey ${surveyId}`);
    } catch (error) {
      surveySync.setStatus(`Edit load error: ${(error as Error).message}`);
    }
  };

  const handleSaveSurveyEdits = async (): Promise<void> => {
    if (!editingSurveyId) {
      surveySync.setStatus('No survey selected for editing');
      return;
    }

    try {
      await updateLocalDraft({
        survey_id: editingSurveyId,
        ...surveyForm.buildDraftInput(),
        visibility: 'private'
      });

      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
      setScreen('list');
      surveySync.setStatus(`Local survey ${editingSurveyId} updated and queued for sync`);
    } catch (error) {
      surveySync.setStatus(`Edit save error: ${(error as Error).message}`);
    }
  };

  const handleCancelSurveyEdit = (): void => {
    setEditingSurveyId(null);
    setScreen('list');
    surveySync.setStatus('Edit mode cancelled');
  };

  const handleCancelSurveyForm = (): void => {
    if (screen === 'edit') {
      handleCancelSurveyEdit();
      return;
    }
    setScreen('list');
    surveySync.setStatus('Create mode cancelled');
  };

  const handleOpenSurvey = (surveyId: string): void => {
    surveyList.openSurvey(surveyId);
    setSurveyDetailTab('summary');
    surveySync.setStatus(`Survey ${surveyId} opened`);
  };

  const handleCaptureGpsLocation = async (): Promise<void> => {
    try {
      const Location = await import('expo-location');

      surveySync.setStatus('Requesting GPS permission...');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        surveySync.setStatus('Location permission is required');
        return;
      }

      surveySync.setStatus('Capturing GPS location...');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      surveyForm.applyGpsLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy_m: position.coords.accuracy ?? undefined,
        collected_at: new Date(position.timestamp).toISOString()
      });
      surveySync.setStatus('GPS location captured');
    } catch (error) {
      surveySync.setStatus(`GPS error: ${(error as Error).message}`);
    }
  };

  const handleCloseSurveyDetail = (): void => {
    closeSurveyDetailSelection();
    surveySync.setStatus('Survey detail closed');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>IBP Step 20 - Local Survey Hub + Dedicated Forms</Text>
          <View style={styles.authCompact}>
            <View style={styles.authCompactHeader}>
              <Text style={styles.label}>Settings</Text>
              <Pressable onPress={() => setShowSettingsPanel((open) => !open)}>
                <Text style={styles.helpToggle}>{showSettingsPanel ? 'Hide settings' : 'Show settings'}</Text>
              </Pressable>
            </View>
            <Text style={styles.meta}>User: {surveySync.profile}</Text>
          </View>

          {showSettingsPanel ? (
            <View style={styles.authPanel}>
              <Text style={styles.subtitle}>API URL (editable)</Text>
              <TextInput
                style={styles.input}
                value={apiUrl}
                onChangeText={setApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />

              <Text style={styles.label}>Password</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

              <Button title="Login" onPress={() => void surveySync.handleLogin()} />
              <View style={styles.spacer} />
              <Button title="Pull server changes (advanced)" onPress={() => void surveySync.handlePullChanges()} />
              <View style={styles.spacer} />
              <Button title="Refresh local list" onPress={() => void surveyList.refreshLocalSurveys()} />
              <View style={styles.spacer} />
              <Button title="Refresh local attachments" onPress={() => void surveyList.refreshLocalAttachments()} />
            </View>
          ) : null}

          <Button title="Create new survey" onPress={handleOpenCreateSurvey} />
          <View style={styles.spacer} />
          <Button title="Sync now (push + pull)" onPress={() => void surveySync.handleSync()} />

          <Text style={styles.status}>{surveySync.status}</Text>
        </View>

        {screen === 'list' ? (
          <SurveyListScreen
            surveys={surveyList.surveys}
            visibleSurveys={surveyList.visibleSurveys}
            selectedSurveyId={surveyList.selectedSurveyId}
            surveyStats={surveyList.surveyStats}
            attachmentCountBySurvey={surveyList.attachmentCountBySurvey}
            surveyQuery={surveyList.surveyQuery}
            setSurveyQuery={surveyList.setSurveyQuery}
            statusFilter={surveyList.statusFilter}
            setStatusFilter={surveyList.setStatusFilter}
            syncFilter={surveyList.syncFilter}
            setSyncFilter={surveyList.setSyncFilter}
            blockedFilter={surveyList.blockedFilter}
            setBlockedFilter={surveyList.setBlockedFilter}
            attachmentFilter={surveyList.attachmentFilter}
            setAttachmentFilter={surveyList.setAttachmentFilter}
            sortMode={surveyList.sortMode}
            setSortMode={surveyList.setSortMode}
            resetFilters={surveyList.resetFilters}
            onOpenSurvey={handleOpenSurvey}
            detailContent={
              surveyList.selectedSurvey ? (
                <SurveyDetailScreen
                  selectedSurvey={surveyList.selectedSurvey}
                  selectedSurveyAttachments={surveyList.selectedSurveyAttachments}
                  surveyDetailTab={surveyDetailTab}
                  setSurveyDetailTab={setSurveyDetailTab}
                  editingSurveyId={editingSurveyId}
                  surveyDetails={surveySync.surveyDetails}
                  detailsLoadingSurveyId={surveySync.detailsLoadingSurveyId}
                  surveyEvents={surveySync.surveyEvents}
                  eventsLoadingSurveyId={surveySync.eventsLoadingSurveyId}
                  onClose={handleCloseSurveyDetail}
                  onLoadCanonicalDetails={surveySync.handleLoadCanonicalDetails}
                  onLoadSurveyEvents={surveySync.handleLoadSurveyEvents}
                  onEditSurvey={handleStartEditSurvey}
                  onTakePhoto={surveySync.handleQueueAttachmentFromCamera}
                  onPickPhoto={surveySync.handleQueueAttachmentFromLibrary}
                  onDeleteSurvey={surveySync.confirmDeleteSurvey}
                  onSubmitSurvey={surveySync.handleSubmitSurvey}
                  onRetrySurvey={surveySync.handleRetrySurvey}
                  onDiscardSurvey={surveySync.handleDiscardSurvey}
                />
              ) : null
            }
          />
        ) : (
          <SurveyFormScreen
            screen={screen}
            editingSurveyId={editingSurveyId}
            siteName={surveyForm.siteName}
            setSiteName={surveyForm.setSiteName}
            regionVersion={surveyForm.regionVersion}
            vegetationStage={surveyForm.vegetationStage}
            setVegetationStage={surveyForm.setVegetationStage}
            onRegionChange={surveyForm.handleRegionChange}
            locationSource={surveyForm.locationSource}
            setLocationSource={surveyForm.setLocationSource}
            gpsLocation={surveyForm.gpsLocation}
            manualLocation={surveyForm.manualLocation}
            setGpsLocationField={surveyForm.setGpsLocationField}
            setManualLocationField={surveyForm.setManualLocationField}
            onCaptureGpsLocation={handleCaptureGpsLocation}
            factorSections={surveyForm.factorSections}
            onSaveSurveyEdits={handleSaveSurveyEdits}
            onCreateDraft={handleCreateDraft}
            onBackToSurveyList={handleCancelSurveyForm}
            status={surveySync.status}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
