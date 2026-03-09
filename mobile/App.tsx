import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_API_URL } from './src/app/constants';
import { styles } from './src/app/styles';
import { FactorKey, PublicMapItem, SurveyDetailTab } from './src/app/types';
import { verifyManualLocation } from './src/app/verify-manual-location';
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
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const SurveysStack = createNativeStackNavigator<SurveysStackParamList>();

type FormMode = 'create' | 'edit';

export default function App() {
  const [apiUrl, setApiUrl] = useState(() => process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL);
  const [email, setEmail] = useState('demo@ibp.local');
  const [password, setPassword] = useState('demo123');
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [surveyDetailTab, setSurveyDetailTab] = useState<SurveyDetailTab>('summary');
  const [publicMapItems, setPublicMapItems] = useState<PublicMapItem[]>([]);
  const [publicMapLoading, setPublicMapLoading] = useState(false);
  const [publicMapFromDate, setPublicMapFromDate] = useState('');
  const [publicMapToDate, setPublicMapToDate] = useState('');
  const [publicMapRegion, setPublicMapRegion] = useState('');

  const navigationRef = useRef<NavigationContainerRef<RootTabParamList> | null>(null);

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
    onStopEditing: () => {
      setEditingSurveyId(null);
      setFormMode('create');
    }
  });

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      await initLocalDb();
      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
    };

    bootstrap().catch((error) => surveySync.setStatus(`Init error: ${(error as Error).message}`));
  }, []);

  const navigateToTab = (tab: keyof RootTabParamList): void => {
    navigationRef.current?.navigate(tab as never);
  };

  const handleOpenCreateSurvey = (): void => {
    setEditingSurveyId(null);
    setFormMode('create');
    closeSurveyDetailSelection();
    surveyForm.resetSurveyForm();
    surveySync.setStatus('Create survey view opened');
  };

  const handleCreateDraft = async (): Promise<boolean> => {
    try {
      const draftInput = await verifyManualLocation(surveyForm.buildDraftInput(), { setStatus: surveySync.setStatus });
      if (!draftInput) return false;
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
      const draftInput = await verifyManualLocation(surveyForm.buildDraftInput(), { setStatus: surveySync.setStatus });
      if (!draftInput) return false;
      await updateLocalDraft({
        survey_id: editingSurveyId,
        ...draftInput,
        visibility: current?.visibility ?? 'private'
      });

      await surveyList.refreshLocalSurveys();
      await surveyList.refreshLocalAttachments();
      setEditingSurveyId(null);
      setFormMode('create');
      surveySync.setStatus(`Local survey ${editingSurveyId} updated and queued for sync`);
      return true;
    } catch (error) {
      surveySync.setStatus(`Edit save error: ${(error as Error).message}`);
      return false;
    }
  };

  const handleOpenSurvey = (surveyId: string): void => {
    surveyList.openSurvey(surveyId);
    setSurveyDetailTab('summary');
    surveySync.setStatus(`Survey ${surveyId} opened`);
  };

  const handleCaptureGpsLocation = async (): Promise<void> => {
    const promptManualLocationFallback = (reason: string): void => {
      Alert.alert('GPS unavailable', `${reason}\n\nSwitch to manual address entry?`, [
        {
          text: 'Keep GPS',
          style: 'cancel'
        },
        {
          text: 'Use manual address',
          onPress: () => {
            surveyForm.setLocationSource('manual');
            surveySync.setStatus('GPS unavailable. Enter a manual address before submit.');
          }
        }
      ]);
    };

    try {
      const Location = await import('expo-location');

      surveySync.setStatus('Requesting GPS permission...');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        surveySync.setStatus('Location permission denied');
        promptManualLocationFallback('Location permission was denied.');
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
      promptManualLocationFallback('The device could not provide a GPS position.');
    }
  };

  const handleLoadPublicMap = async (): Promise<void> => {
    try {
      setPublicMapLoading(true);
      const baseUrl = apiUrl.replace(/\/+$/, '');
      const queryParts: string[] = [];
      if (publicMapFromDate.trim()) {
        queryParts.push(`from=${encodeURIComponent(publicMapFromDate.trim())}`);
      }
      if (publicMapToDate.trim()) {
        queryParts.push(`to=${encodeURIComponent(publicMapToDate.trim())}`);
      }
      if (publicMapRegion.trim()) {
        queryParts.push(`region=${encodeURIComponent(publicMapRegion.trim().toUpperCase())}`);
      }

      const suffix = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const response = await fetch(`${baseUrl}/public/map-items${suffix}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        surveySync.setStatus(`Public map load failed: HTTP ${response.status}`);
        return;
      }

      const payload = (await response.json()) as { items?: PublicMapItem[] };
      const items = Array.isArray(payload.items) ? payload.items : [];
      setPublicMapItems(items);
      surveySync.setStatus(`Public map loaded: ${items.length} item(s)`);
    } catch (error) {
      surveySync.setStatus(`Public map load error: ${(error as Error).message}`);
    } finally {
      setPublicMapLoading(false);
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
          color: '#12304f'
        },
        headerStyle: {
          backgroundColor: '#f2f5fa'
        },
        headerShadowVisible: false,
        headerTintColor: '#12304f'
      }}
    >
      <SurveysStack.Screen
        name="surveysHome"
        options={{
          title: 'Surveys'
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
                selectedSurvey={surveyList.selectedSurvey}
                selectedSurveyAttachments={surveyList.selectedSurveyAttachments}
                surveyDetailTab={surveyDetailTab}
                setSurveyDetailTab={setSurveyDetailTab}
                editingSurveyId={editingSurveyId}
                surveyDetails={surveySync.surveyDetails}
                detailsLoadingSurveyId={surveySync.detailsLoadingSurveyId}
                surveyEvents={surveySync.surveyEvents}
                eventsLoadingSurveyId={surveySync.eventsLoadingSurveyId}
                onLoadCanonicalDetails={surveySync.handleLoadCanonicalDetails}
                onLoadSurveyEvents={surveySync.handleLoadSurveyEvents}
                onEditSurvey={async (surveyId) => {
                  const loaded = await handleStartEditSurvey(surveyId);
                  if (loaded) {
                    navigation.navigate('surveyForm');
                  }
                }}
                onTakePhoto={surveySync.handleQueueAttachmentFromCamera}
                onPickPhoto={surveySync.handleQueueAttachmentFromLibrary}
                onDeleteAttachment={surveySync.handleDeleteAttachment}
                onDeleteSurvey={surveySync.confirmDeleteSurvey}
                onSubmitSurvey={surveySync.handleSubmitSurvey}
                onRetrySurvey={surveySync.handleRetrySurvey}
                onDiscardSurvey={surveySync.handleDiscardSurvey}
                onToggleVisibility={surveySync.handleToggleVisibility}
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
              screen={formMode === 'edit' ? 'edit' : 'create'}
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
            <FactorDetailScreen factor={route.params.factor} fields={surveyForm.factorSections[route.params.factor]} />
          </ScrollView>
        )}
      </SurveysStack.Screen>
    </SurveysStack.Navigator>
  );

  const PublicMapTab = () => (
    <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
      <PublicMapScreen
        items={publicMapItems}
        loading={publicMapLoading}
        fromDate={publicMapFromDate}
        toDate={publicMapToDate}
        region={publicMapRegion}
        onChangeFromDate={setPublicMapFromDate}
        onChangeToDate={setPublicMapToDate}
        onChangeRegion={setPublicMapRegion}
        onLoad={handleLoadPublicMap}
        onBack={() => navigateToTab('surveys')}
      />
    </ScrollView>
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
              onApiUrlChange={setApiUrl}
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
    <SafeAreaView style={styles.container}>
      <View style={styles.appLayout}>
        {!surveySync.isAuthenticated ? (
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content}>
            <AuthGateScreen
              apiUrl={apiUrl}
              onApiUrlChange={setApiUrl}
              email={email}
              onEmailChange={setEmail}
              password={password}
              onPasswordChange={setPassword}
              onLogin={surveySync.handleLogin}
              status={surveySync.sessionRestoring ? 'Restoring session...' : surveySync.status}
            />
          </ScrollView>
        ) : (
          <NavigationContainer ref={navigationRef}>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: true,
                headerTitleAlign: 'left',
                headerTitleStyle: {
                  fontSize: 30,
                  fontWeight: '800',
                  color: '#12304f'
                },
                headerStyle: {
                  backgroundColor: '#f2f5fa'
                },
                headerShadowVisible: false,
                tabBarActiveTintColor: '#1d4f84',
                tabBarInactiveTintColor: '#6b859f',
                tabBarStyle: {
                  backgroundColor: '#ffffff'
                },
                tabBarLabel: route.name === 'publicMap' ? 'Map' : route.name === 'surveys' ? 'Surveys' : 'Account',
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
                  tabBarLabel: 'Surveys',
                  headerShown: false
                }}
              >
                {() => SurveysTab()}
              </Tab.Screen>
              <Tab.Screen
                name="publicMap"
                options={{
                  title: 'Map'
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
