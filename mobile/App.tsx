import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { loadStoredApiUrl, saveStoredApiUrl } from './src/app/api-url-storage';
import { DEFAULT_API_URL, DEFAULT_SURVEY_FORM, normalizeVegetationStageForRegion } from './src/app/constants';
import { fetchPublicMapItems, fetchPublicParcelStatuses } from './src/api/ibp-api';
import { styles } from './src/app/styles';
import { FactorKey, PublicMapItem, PublicParcelStatusItem, RegionVersion, SurveyDetailTab, VegetationStage } from './src/app/types';
import { SurveyFormScreen } from './src/screens/SurveyFormScreen';
import { SurveyListScreen } from './src/screens/SurveyListScreen';
import { initLocalDb, createLocalDraft, getLocalSurveyDraft, updateLocalDraft } from './src/storage';
import { useSurveyForm } from './src/hooks/useSurveyForm';
import { useSurveyList } from './src/hooks/useSurveyList';
import { useSurveySync } from './src/hooks/useSurveySync';
import { SurveyDetailScreen } from './src/screens/SurveyDetailScreen';
import { PublicMapScreen } from './src/screens/PublicMapScreen';
import { AuthGateScreen } from './src/screens/AuthGateScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { FactorDetailScreen } from './src/screens/FactorDetailScreen';
import { SurveyParcelSelectionScreen } from './src/screens/SurveyParcelSelectionScreen';

type RootTabParamList = {
  surveys: undefined;
  publicMap: undefined;
  account: undefined;
};

type AccountStackParamList = {
  accountHome: undefined;
  settings: undefined;
};

type SurveysStackParamList = {
  surveysHome: undefined;
  surveyDetail: undefined;
  surveyForm: undefined;
  surveyFactorDetail: { factor: FactorKey };
  surveyParcels: { surveyId: string };
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const SurveysStack = createNativeStackNavigator<SurveysStackParamList>();

type FormMode = 'create' | 'edit';

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
  const [publicMapItems, setPublicMapItems] = useState<PublicMapItem[]>([]);
  const [publicMapLoading, setPublicMapLoading] = useState(false);
  const [publicMapFromDate, setPublicMapFromDate] = useState('');
  const [publicMapToDate, setPublicMapToDate] = useState('');
  const [publicMapRegion, setPublicMapRegion] = useState('');
  const [publicParcelStatuses, setPublicParcelStatuses] = useState<PublicParcelStatusItem[]>([]);
  const [publicParcelsLoading, setPublicParcelsLoading] = useState(false);

  const navigationRef = useRef<NavigationContainerRef<RootTabParamList> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosaveSignatureRef = useRef('');
  const createDraftBootstrappingRef = useRef(false);
  const publicParcelsRequestRef = useRef(0);

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

  const handleLoadPublicMap = async (): Promise<void> => {
    try {
      setPublicMapLoading(true);
      const payload = await fetchPublicMapItems(apiUrl, {
        from: publicMapFromDate,
        to: publicMapToDate,
        region: publicMapRegion
      });
      const items = Array.isArray(payload.items) ? payload.items : [];
      setPublicMapItems(items);
      surveySync.setStatus(`Public map loaded: ${items.length} item(s)`);
    } catch (error) {
      surveySync.setStatus(`Public map load error: ${(error as Error).message}`);
    } finally {
      setPublicMapLoading(false);
    }
  };

  const handleLoadPublicParcels = async (input: { bbox: string; zoom: number }): Promise<void> => {
    if (!input.bbox || input.bbox.trim().length === 0) {
      return;
    }

    const requestId = publicParcelsRequestRef.current + 1;
    publicParcelsRequestRef.current = requestId;
    setPublicParcelsLoading(true);

    try {
      const payload = await fetchPublicParcelStatuses(apiUrl, {
        bbox: input.bbox,
        zoom: input.zoom,
        year: new Date().getFullYear()
      });

      if (publicParcelsRequestRef.current !== requestId) {
        return;
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      setPublicParcelStatuses(items);
    } catch (error) {
      if (publicParcelsRequestRef.current === requestId) {
        surveySync.setStatus(`Public parcel layer load error: ${(error as Error).message}`);
      }
    } finally {
      if (publicParcelsRequestRef.current === requestId) {
        setPublicParcelsLoading(false);
      }
    }
  };

  const SurveysTab = () => (
    <SurveysStack.Navigator
      screenOptions={{
        headerShown: true,
        headerLargeTitle: false,
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontSize: 30,
          fontWeight: '800',
          color: '#1d4f3a'
        },
        headerStyle: {
          backgroundColor: '#e8eee7'
        },
        headerShadowVisible: false,
        headerTintColor: '#1d4f3a'
      }}
    >
      <SurveysStack.Screen
        name="surveysHome"
        options={{
          title: 'My Surveys'
        }}
      >
        {({ navigation }) => (
          <View style={styles.tabScreenContainer}>
            <SurveyListScreen
              surveys={surveyList.surveys}
              visibleSurveys={surveyList.visibleSurveys}
              selectedSurveyId={surveyList.selectedSurveyId}
              attachmentsBySurvey={surveyList.attachmentsBySurvey}
              surveyQuery={surveyList.surveyQuery}
              setSurveyQuery={surveyList.setSurveyQuery}
              surveyFromDate={surveyList.surveyFromDate}
              setSurveyFromDate={surveyList.setSurveyFromDate}
              surveyToDate={surveyList.surveyToDate}
              setSurveyToDate={surveyList.setSurveyToDate}
              statusFilter={surveyList.statusFilter}
              setStatusFilter={surveyList.setStatusFilter}
              visibilityFilter={surveyList.visibilityFilter}
              setVisibilityFilter={surveyList.setVisibilityFilter}
              syncFilter={surveyList.syncFilter}
              setSyncFilter={surveyList.setSyncFilter}
              blockedFilter={surveyList.blockedFilter}
              setBlockedFilter={surveyList.setBlockedFilter}
              attachmentFilter={surveyList.attachmentFilter}
              setAttachmentFilter={surveyList.setAttachmentFilter}
              sortMode={surveyList.sortMode}
              setSortMode={surveyList.setSortMode}
              resetFilters={surveyList.resetFilters}
              onOpenSurvey={(surveyId) => {
                handleOpenSurvey(surveyId);
                navigation.navigate('surveyDetail');
              }}
            />
            <Pressable
              style={styles.fabButton}
              onPress={() => {
                handleOpenCreateSurvey();
                navigation.navigate('surveyForm');
              }}
            >
              <Ionicons name="add" size={30} color="#ffffff" />
            </Pressable>
          </View>
        )}
      </SurveysStack.Screen>
      <SurveysStack.Screen
        name="surveyDetail"
        options={{
          title: 'Detail',
          headerLargeTitle: false
        }}
        listeners={{
          beforeRemove: () => {
            closeSurveyDetailSelection();
          }
        }}
      >
        {({ navigation }) => (
          <>
            {surveyList.selectedSurvey ? (
              <SurveyDetailScreen
                apiUrl={apiUrl}
                selectedSurvey={surveyList.selectedSurvey}
                selectedSurveyAttachments={surveyList.selectedSurveyAttachments}
                surveyDetailTab={surveyDetailTab}
                setSurveyDetailTab={setSurveyDetailTab}
                surveyDetails={surveySync.surveyDetails}
                detailsLoadingSurveyId={surveySync.detailsLoadingSurveyId}
                surveyEvents={surveySync.surveyEvents}
                eventsLoadingSurveyId={surveySync.eventsLoadingSurveyId}
                onLoadSurveyEvents={surveySync.handleLoadSurveyEvents}
                onTakePhoto={surveySync.handleQueueAttachmentFromCamera}
                onPickPhoto={surveySync.handleQueueAttachmentFromLibrary}
                onDeleteAttachment={surveySync.handleDeleteAttachment}
                onDeleteSurvey={surveySync.confirmDeleteSurvey}
                onSubmitSurvey={surveySync.handleSubmitSurvey}
                onRetrySurvey={surveySync.handleRetrySurvey}
                onDiscardSurvey={surveySync.handleDiscardSurvey}
                onToggleVisibility={surveySync.handleToggleVisibility}
                onOpenFactor={async (surveyId, factor) => {
                  const loaded = await handleStartEditSurvey(surveyId);
                  if (loaded) {
                    navigation.navigate('surveyFactorDetail', { factor });
                  }
                }}
                onRenameSurvey={async (surveyId, nextSiteName) => {
                  await patchSurveyDraftDirectly(
                    surveyId,
                    (draft) => ({
                      ...draft,
                      site_name: nextSiteName.trim() || 'Unnamed site'
                    }),
                    `Survey name updated for ${surveyId}`
                  );
                }}
                onUpdateRegionVersion={async (surveyId, region) => {
                  await patchSurveyDraftDirectly(
                    surveyId,
                    (draft) => ({
                      ...draft,
                      region_version: region,
                      vegetation_stage: normalizeVegetationStageForRegion(region, draft.vegetation_stage)
                    }),
                    `Region updated for ${surveyId}`
                  );
                }}
                onUpdateVegetationStage={async (surveyId, stage) => {
                  await patchSurveyDraftDirectly(
                    surveyId,
                    (draft) => ({
                      ...draft,
                      vegetation_stage: normalizeVegetationStageForRegion(draft.region_version, stage)
                    }),
                    `Vegetation stage updated for ${surveyId}`
                  );
                }}
                onOpenParcels={async (surveyId) => {
                  const loaded = await handleStartEditSurvey(surveyId);
                  if (loaded) {
                    navigation.navigate('surveyParcels', { surveyId });
                  }
                }}
              />
            ) : null}
          </>
        )}
      </SurveysStack.Screen>
      <SurveysStack.Screen
        name="surveyForm"
        options={{
          title: formMode === 'edit' ? 'Edit survey' : 'Create a new survey',
          headerLargeTitle: false
        }}
      >
        {({ navigation }) => (
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
            <SurveyFormScreen
              apiUrl={apiUrl}
              screen={formMode === 'edit' ? 'edit' : 'create'}
              editingSurveyId={editingSurveyId}
              siteName={surveyForm.siteName}
              setSiteName={surveyForm.setSiteName}
              regionVersion={surveyForm.regionVersion}
              vegetationStage={surveyForm.vegetationStage}
              setVegetationStage={surveyForm.setVegetationStage}
              onRegionChange={surveyForm.handleRegionChange}
              gpsLocation={surveyForm.gpsLocation}
              selectedParcelIds={surveyForm.selectedParcelIds}
              onToggleParcelSelection={surveyForm.toggleParcelSelection}
              onCaptureGpsLocation={handleCaptureGpsLocation}
              factorSections={surveyForm.factorSections}
              factorRetainedScores={surveyForm.factorRetainedScores}
              formErrors={surveyForm.formErrors}
              onOpenFactor={(factor) => navigation.navigate('surveyFactorDetail', { factor })}
              onSaveSurveyEdits={async () => {
                const saved = await handleSaveSurveyEdits();
                if (saved) {
                  navigation.goBack();
                }
              }}
              onCreateDraft={async () => {
                const created = await handleCreateDraft();
                if (created) {
                  navigation.goBack();
                }
              }}
              status={surveySync.status}
            />
          </ScrollView>
        )}
      </SurveysStack.Screen>
      <SurveysStack.Screen
        name="surveyFactorDetail"
        options={({ route }) => ({
          title: `Factor ${route.params.factor}`,
          headerLargeTitle: false
        })}
      >
        {({ route }) => (
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
            <FactorDetailScreen
              factor={route.params.factor}
              fields={surveyForm.factorSections[route.params.factor]}
              retainedScore={surveyForm.factorRetainedScores[route.params.factor]}
            />
          </ScrollView>
        )}
      </SurveysStack.Screen>
      <SurveysStack.Screen
        name="surveyParcels"
        options={{
          title: 'Edit parcels',
          headerLargeTitle: false
        }}
      >
        {({ navigation }) => (
          <SurveyParcelSelectionScreen
            apiUrl={apiUrl}
            siteName={surveyForm.siteName}
            gpsLocation={surveyForm.gpsLocation}
            selectedParcelIds={surveyForm.selectedParcelIds}
            onToggleParcelSelection={surveyForm.toggleParcelSelection}
            onCaptureGpsLocation={handleCaptureGpsLocation}
            onSave={async () => {
              const saved = await handleSaveSurveyEdits();
              if (saved) {
                navigation.goBack();
              }
            }}
          />
        )}
      </SurveysStack.Screen>
    </SurveysStack.Navigator>
  );

  const PublicMapTab = () => (
    <View style={styles.tabScreenContainer}>
      <PublicMapScreen
        items={publicMapItems}
        parcelStatuses={publicParcelStatuses}
        ownSurveyIds={ownSurveyIds}
        loading={publicMapLoading}
        parcelsLoading={publicParcelsLoading}
        fromDate={publicMapFromDate}
        toDate={publicMapToDate}
        region={publicMapRegion}
        onChangeFromDate={setPublicMapFromDate}
        onChangeToDate={setPublicMapToDate}
        onChangeRegion={setPublicMapRegion}
        onLoad={handleLoadPublicMap}
        onLoadParcels={handleLoadPublicParcels}
        onReportSurvey={surveySync.handleReportSurvey}
      />
    </View>
  );

  const AccountTab = () => (
    <AccountStack.Navigator screenOptions={{ headerShown: false }}>
      <AccountStack.Screen name="accountHome">
        {({ navigation }) => (
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
            <AccountScreen
              accessToken={surveySync.accessToken}
              currentUser={surveySync.currentUser}
              profile={surveySync.profile}
              profileUpdating={surveySync.profileUpdating}
              status={surveySync.status}
              apiUrl={apiUrl}
              onOpenSettings={() => navigation.navigate('settings')}
              onSaveProfile={(input) => surveySync.handleUpdateProfile(input)}
              onPickProfilePictureFromLibrary={surveySync.handlePickProfilePictureFromLibrary}
              onTakeProfilePictureFromCamera={surveySync.handleTakeProfilePictureFromCamera}
              onRemoveProfilePicture={surveySync.handleRemoveProfilePicture}
              onConfirmEmailChange={surveySync.handleConfirmEmailChange}
              onLogout={surveySync.handleLogout}
            />
          </ScrollView>
        )}
      </AccountStack.Screen>
      <AccountStack.Screen name="settings">
        {({ navigation }) => (
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
            <SettingsScreen
              apiUrl={apiUrl}
              onApiUrlChange={handleApiUrlChange}
              onSync={surveySync.handleSync}
              onPullChanges={surveySync.handlePullChanges}
              onRefreshLocalList={surveyList.refreshLocalSurveys}
              onRefreshLocalAttachments={surveyList.refreshLocalAttachments}
              onDebugResetIbpData={surveySync.handleDebugResetIbpData}
              onDebugResetUserData={surveySync.handleDebugResetUserData}
              onBack={() => navigation.goBack()}
              status={surveySync.status}
            />
          </ScrollView>
        )}
      </AccountStack.Screen>
    </AccountStack.Navigator>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
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
            logoSource={require('./assets/logo-etats-sauvages.png')}
            heroForegroundLeftSource={require('./assets/auth/fern.png')}
            heroForegroundRightSource={require('./assets/auth/marten.png')}
            status={surveySync.sessionRestoring ? 'Restoring session...' : surveySync.status}
          />
        ) : (
          <NavigationContainer ref={navigationRef}>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: true,
                headerTitleAlign: 'left',
                headerTitleStyle: {
                  fontSize: 30,
                  fontWeight: '800',
                  color: '#1d4f3a'
                },
                headerStyle: {
                  backgroundColor: '#e8eee7'
                },
                headerShadowVisible: false,
                tabBarActiveTintColor: '#1f6b49',
                tabBarInactiveTintColor: '#6d8576',
                tabBarStyle: {
                  backgroundColor: '#f7faf5',
                  borderTopColor: '#d1ddcf',
                  borderTopWidth: 1,
                  height: Platform.select({ ios: 84, default: 68 }),
                  paddingBottom: Platform.select({ ios: 22, default: 10 }),
                  paddingTop: Platform.select({ ios: 8, default: 6 })
                },
                tabBarLabelStyle: {
                  fontSize: 13,
                  fontWeight: '600'
                },
                tabBarLabel: route.name === 'publicMap' ? 'Explore' : route.name === 'surveys' ? 'My Surveys' : 'Account',
                tabBarIcon: ({ color, size }) => {
                  const iconName =
                    route.name === 'surveys'
                      ? 'list-outline'
                      : route.name === 'publicMap'
                        ? 'map-outline'
                        : 'person-outline';
                  return <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
                }
              })}
            >
              <Tab.Screen
                name="surveys"
                options={{
                  tabBarLabel: 'My Surveys',
                  headerShown: false
                }}
                listeners={{
                  tabPress: () => {
                    if (surveySync.isAuthenticated) {
                      void surveySync.handlePullChanges();
                    }
                  }
                }}
              >
                {() => SurveysTab()}
              </Tab.Screen>
              <Tab.Screen
                name="publicMap"
                options={{
                  title: 'Explore',
                  headerShown: false
                }}
                listeners={{
                  tabPress: () => {
                    closeSurveyDetailSelection();
                    void handleLoadPublicMap();
                  }
                }}
              >
                {() => PublicMapTab()}
              </Tab.Screen>
              <Tab.Screen
                name="account"
                options={{
                  title: 'Account'
                }}
                listeners={{
                  tabPress: () => {
                    closeSurveyDetailSelection();
                    if (surveySync.isAuthenticated) {
                      void surveySync.handleLoadMyProfile({ silent: true });
                    }
                  }
                }}
              >
                {() => AccountTab()}
              </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>
        )}
      </View>
    </SafeAreaView>
  );
}
