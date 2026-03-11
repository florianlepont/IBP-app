import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { loadStoredApiUrl, saveStoredApiUrl } from './src/app/api-url-storage';
import { DEFAULT_API_URL, DEFAULT_SURVEY_FORM, normalizeVegetationStageForRegion } from './src/app/constants';
import { AuthenticatedAppNavigation, FormMode } from './src/app/AuthenticatedAppNavigation';
import { styles } from './src/app/styles';
import { RegionVersion, SurveyDetailTab, VegetationStage } from './src/app/types';
import { initLocalDb, createLocalDraft, getLocalSurveyDraft, updateLocalDraft } from './src/storage';
import { useSurveyForm } from './src/hooks/useSurveyForm';
import { useSurveyList } from './src/hooks/useSurveyList';
import { usePublicMapExplorer } from './src/hooks/usePublicMapExplorer';
import { useSurveySync } from './src/hooks/useSurveySync';
import { AuthGateScreen } from './src/screens/AuthGateScreen';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export default function App() {
  const [apiUrl, setApiUrl] = useState(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>('summary');

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosaveSignatureRef = useRef('');
  const createDraftBootstrappingRef = useRef(false);

  const surveyForm = useSurveyForm();
  const surveyList = useSurveyList();
  const ownSurveyIds = useMemo(() => surveyList.surveys.map((survey) => survey.id), [surveyList.surveys]);
  const editingSurveyVisibility = useMemo(
    () => (editingSurveyId ? surveyList.surveys.find((survey) => survey.id === editingSurveyId)?.visibility ?? 'private' : 'private'),
    [editingSurveyId, surveyList.surveys]
  );

  const closeSurveyDetailSelection = (): void => {
    surveyList.closeSurvey();
    setSurveyDetailTab('summary');
  };

  const surveySync = useSurveySync({
    apiUrl,
    email,
    password,
    displayName,
    surveys: surveyList.surveys,
    selectedSurveyId: surveyList.selectedSurveyId,
    surveyDetailTab,
    editingSurveyId,
    refreshLocalSurveys: surveyList.refreshLocalSurveys,
    refreshLocalAttachments: surveyList.refreshLocalAttachments,
    onCloseSurveyDetail: closeSurveyDetailSelection,
    onStopEditing: () => {
      setEditingSurveyId(null);
      setFormMode('create');
    }
  });
  const publicMapExplorer = usePublicMapExplorer({
    apiUrl,
    onStatusChange: surveySync.setStatus
  });

  useEffect(() => {
    let active = true;
    void loadStoredApiUrl()
      .then((stored) => {
        if (active && stored) {
          setApiUrl(stored);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleApiUrlChange = (value: string): void => {
    setApiUrl(value);
    void saveStoredApiUrl(value).catch(() => undefined);
  };

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb();
      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
    };

    bootstrap().catch((error) => surveySync.setStatus(`Init error: ${(error as Error).message}`));
  }, []);

  const handleOpenCreateSurvey = (): void => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autosaveSignatureRef.current = '';
    setEditingSurveyId(null);
    setFormMode('create');
    closeSurveyDetailSelection();
    surveyForm.resetSurveyForm();
    surveySync.setStatus('Create survey view opened. Initializing local draft...');

    if (createDraftBootstrappingRef.current) {
      return;
    }
    createDraftBootstrappingRef.current = true;

    const initialDraftInput = {
      site_name: 'Unnamed site',
      region_version: DEFAULT_SURVEY_FORM.regionVersion,
      vegetation_stage: DEFAULT_SURVEY_FORM.vegetationStage,
      parcel_ids: [],
      factors: {}
    };

    void (async () => {
      try {
        const created = await createLocalDraft(initialDraftInput);
        await surveyList.refreshLocalSurveys();
        await surveyList.refreshLocalAttachments();
        autosaveSignatureRef.current = JSON.stringify(initialDraftInput);
        setEditingSurveyId(created.id);
        surveyList.setSelectedSurveyId(created.id);
        surveySync.setStatus(`Draft ${created.id} initialized.`);
      } catch (error) {
        surveySync.setStatus(`Draft bootstrap error: ${(error as Error).message}`);
      } finally {
        createDraftBootstrappingRef.current = false;
      }
    })();
  };

  const handleCreateDraft = async (): Promise<boolean> => {
    try {
      const draftInput = surveyForm.buildDraftInput();
      if (editingSurveyId) {
        const current = surveyList.surveys.find((survey) => survey.id === editingSurveyId);
        await updateLocalDraft({
          survey_id: editingSurveyId,
          ...draftInput,
          visibility: current?.visibility ?? 'private'
        });

        await surveyList.refreshLocalSurveys();
        await surveyList.refreshLocalAttachments();
        autosaveSignatureRef.current = '';
        setEditingSurveyId(null);
        setFormMode('create');
        surveyList.setSelectedSurveyId(editingSurveyId);
        surveySync.setStatus(`Local IBP draft ${editingSurveyId} saved`);
        return true;
      }

      const created = await createLocalDraft(draftInput);
      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
      setEditingSurveyId(null);
      setFormMode('create');
      surveyList.setSelectedSurveyId(created.id);
      surveySync.setStatus('Local IBP draft created with raw observations');
      return true;
    } catch (error) {
      surveySync.setStatus(`Draft error: ${(error as Error).message}`);
      return false;
    }
  };

  const handleStartEditSurvey = async (surveyId: string): Promise<boolean> => {
    const current = surveyList.surveys.find((survey) => survey.id === surveyId);
    if (current?.status === 'submitted') {
      surveySync.setStatus(`Survey ${surveyId} is submitted and read-only`);
      return false;
    }

    try {
      const draft = await getLocalSurveyDraft(surveyId);
      if (!draft) {
        surveySync.setStatus(`Survey not found locally: ${surveyId}`);
        return false;
      }
      autosaveSignatureRef.current = JSON.stringify({
        site_name: draft.site_name ?? '',
        region_version: draft.region_version ?? 'ACA',
        vegetation_stage: draft.vegetation_stage ?? '',
        parcel_ids: Array.isArray(draft.parcel_ids) ? draft.parcel_ids : [],
        factors: draft.factors ?? {}
      });
      surveyForm.applyDraftToForm(draft);
      setEditingSurveyId(surveyId);
      setFormMode('edit');
      surveyList.setSelectedSurveyId(surveyId);
      surveySync.setStatus(`Editing survey ${surveyId}`);
      return true;
    } catch (error) {
      surveySync.setStatus(`Edit load error: ${(error as Error).message}`);
      return false;
    }
  };

  const handleSaveSurveyEdits = async (): Promise<boolean> => {
    if (!editingSurveyId) {
      surveySync.setStatus('No survey selected for editing');
      return false;
    }

    try {
      const current = surveyList.surveys.find((survey) => survey.id === editingSurveyId);
      const draftInput = surveyForm.buildDraftInput();
      await updateLocalDraft({
        survey_id: editingSurveyId,
        ...draftInput,
        visibility: current?.visibility ?? 'private'
      });

      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
      autosaveSignatureRef.current = '';
      setEditingSurveyId(null);
      setFormMode('create');
      surveySync.setStatus(`Local survey ${editingSurveyId} updated and queued for sync`);
      return true;
    } catch (error) {
      surveySync.setStatus(`Edit save error: ${(error as Error).message}`);
      return false;
    }
  };

  type DirectDraftPatchInput = {
    site_name: string;
    region_version: RegionVersion;
    vegetation_stage: VegetationStage;
    parcel_ids: string[];
    factors: Record<string, unknown>;
  };

  const patchSurveyDraftDirectly = async (
    surveyId: string,
    mutator: (draft: DirectDraftPatchInput) => DirectDraftPatchInput,
    successMessage: string
  ): Promise<boolean> => {
    const current = surveyList.surveys.find((survey) => survey.id === surveyId);
    if (current?.status === 'submitted') {
      surveySync.setStatus(`Survey ${surveyId} is submitted and read-only`);
      return false;
    }

    try {
      const draft = await getLocalSurveyDraft(surveyId);
      if (!draft) {
        surveySync.setStatus(`Survey not found locally: ${surveyId}`);
        return false;
      }

      const baseRegion: RegionVersion = draft.region_version === 'M' ? 'M' : 'ACA';
      const baseStage = normalizeVegetationStageForRegion(
        baseRegion,
        typeof draft.vegetation_stage === 'string' ? draft.vegetation_stage : DEFAULT_SURVEY_FORM.vegetationStage
      );
      const base: DirectDraftPatchInput = {
        site_name: typeof draft.site_name === 'string' && draft.site_name.trim().length > 0 ? draft.site_name : 'Unnamed site',
        region_version: baseRegion,
        vegetation_stage: baseStage,
        parcel_ids: Array.isArray(draft.parcel_ids)
          ? draft.parcel_ids.filter((value): value is string => typeof value === 'string')
          : [],
        factors: asRecord(draft.factors)
      };
      const next = mutator(base);

      await updateLocalDraft({
        survey_id: surveyId,
        site_name: next.site_name,
        region_version: next.region_version,
        vegetation_stage: next.vegetation_stage,
        parcel_ids: next.parcel_ids,
        factors: next.factors,
        visibility: current?.visibility ?? 'private'
      });

      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
      surveySync.setStatus(successMessage);
      return true;
    } catch (error) {
      surveySync.setStatus(`Direct update error: ${(error as Error).message}`);
      return false;
    }
  };

  useEffect(() => {
    if (!editingSurveyId) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    const draftSignature = JSON.stringify(surveyForm.draftInput);
    if (autosaveSignatureRef.current === draftSignature) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (autosaveInFlightRef.current) {
        return;
      }
      autosaveInFlightRef.current = true;

      void (async () => {
        try {
          await updateLocalDraft({
            survey_id: editingSurveyId,
            ...surveyForm.draftInput,
            visibility: editingSurveyVisibility
          });
          await surveyList.refreshLocalSurveys();
          autosaveSignatureRef.current = draftSignature;
        } catch (error) {
          surveySync.setStatus(`Autosave error: ${(error as Error).message}`);
        } finally {
          autosaveInFlightRef.current = false;
        }
      })();
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [editingSurveyId, editingSurveyVisibility, surveyForm.draftInput]);

  const handleOpenSurvey = (surveyId: string): void => {
    surveyList.openSurvey(surveyId);
    setSurveyDetailTab('summary');
    surveySync.setStatus(`Survey ${surveyId} opened`);
  };

  const handleRenameSurvey = async (surveyId: string, nextSiteName: string): Promise<void> => {
    await patchSurveyDraftDirectly(
      surveyId,
      (draft) => ({
        ...draft,
        site_name: nextSiteName.trim() || 'Unnamed site'
      }),
      `Survey name updated for ${surveyId}`
    );
  };

  const handleUpdateSurveyRegionVersion = async (surveyId: string, region: RegionVersion): Promise<void> => {
    await patchSurveyDraftDirectly(
      surveyId,
      (draft) => ({
        ...draft,
        region_version: region,
        vegetation_stage: normalizeVegetationStageForRegion(region, draft.vegetation_stage)
      }),
      `Region updated for ${surveyId}`
    );
  };

  const handleUpdateSurveyVegetationStage = async (surveyId: string, stage: VegetationStage): Promise<void> => {
    await patchSurveyDraftDirectly(
      surveyId,
      (draft) => ({
        ...draft,
        vegetation_stage: normalizeVegetationStageForRegion(draft.region_version, stage)
      }),
      `Vegetation stage updated for ${surveyId}`
    );
  };

  const handleCaptureGpsLocation = async (): Promise<void> => {
    try {
      surveySync.setStatus('Requesting GPS permission...');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        surveySync.setStatus('Location permission denied');
        Alert.alert('Location disabled', 'Allow location access to center the map and find nearby parcels.');
        return;
      }

      surveySync.setStatus('Capturing GPS location...');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      surveyForm.applyGpsLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        collected_at: new Date(position.timestamp).toISOString()
      });
      surveySync.setStatus('GPS location captured');
    } catch (error) {
      surveySync.setStatus(`GPS error: ${(error as Error).message}`);
      Alert.alert('GPS unavailable', 'The device could not provide a GPS position.');
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={surveySync.isAuthenticated ? ['top', 'left', 'right'] : ['left', 'right']}>
        <View style={styles.appLayout}>
          {!surveySync.isAuthenticated ? (
            <AuthGateScreen
              apiUrl={apiUrl}
              onApiUrlChange={handleApiUrlChange}
              email={email}
              onEmailChange={setEmail}
              password={password}
              onPasswordChange={setPassword}
              displayName={displayName}
              onDisplayNameChange={setDisplayName}
              onLogin={surveySync.handleLogin}
              onRegister={surveySync.handleRegister}
              logoSource={require('./assets/logo-etats-sauvages-cropped.png')}
              heroMartenSource={require('./assets/auth/marten.png')}
              status={surveySync.sessionRestoring ? 'Restoring session...' : surveySync.status}
            />
          ) : (
            <AuthenticatedAppNavigation
              apiUrl={apiUrl}
              formMode={formMode}
              editingSurveyId={editingSurveyId}
              surveyDetailTab={surveyDetailTab}
              setSurveyDetailTab={setSurveyDetailTab}
              surveyForm={surveyForm}
              surveyList={surveyList}
              surveySync={surveySync}
              publicMapExplorer={publicMapExplorer}
              ownSurveyIds={ownSurveyIds}
              onOpenCreateSurvey={handleOpenCreateSurvey}
              onOpenSurvey={handleOpenSurvey}
              onStartEditSurvey={handleStartEditSurvey}
              onRenameSurvey={handleRenameSurvey}
              onUpdateRegionVersion={handleUpdateSurveyRegionVersion}
              onUpdateVegetationStage={handleUpdateSurveyVegetationStage}
              onSaveSurveyEdits={handleSaveSurveyEdits}
              onCreateDraft={handleCreateDraft}
              onCaptureGpsLocation={handleCaptureGpsLocation}
              onApiUrlChange={handleApiUrlChange}
              onCloseSurveyDetailSelection={closeSurveyDetailSelection}
            />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
