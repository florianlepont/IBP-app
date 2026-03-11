import { Platform, Pressable, ScrollView, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './styles';
import { FactorKey, RegionVersion, SurveyDetailTab, VegetationStage } from './types';
import { SurveyFormScreen } from '../screens/SurveyFormScreen';
import { SurveyListScreen } from '../screens/SurveyListScreen';
import { SurveyDetailScreen } from '../screens/SurveyDetailScreen';
import { PublicMapScreen } from '../screens/PublicMapScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { FactorDetailScreen } from '../screens/FactorDetailScreen';
import { SurveyParcelSelectionScreen } from '../screens/SurveyParcelSelectionScreen';
import { useSurveyForm } from '../hooks/useSurveyForm';
import { useSurveyList } from '../hooks/useSurveyList';
import { useSurveySync } from '../hooks/useSurveySync';
import { usePublicMapExplorer } from '../hooks/usePublicMapExplorer';

export type RootTabParamList = {
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

export type FormMode = 'create' | 'edit';

type SurveyFormController = ReturnType<typeof useSurveyForm>;
type SurveyListController = ReturnType<typeof useSurveyList>;
type SurveySyncController = ReturnType<typeof useSurveySync>;
type PublicMapExplorerController = ReturnType<typeof usePublicMapExplorer>;

type AuthenticatedAppNavigationProps = {
  apiUrl: string;
  formMode: FormMode;
  editingSurveyId: string | null;
  surveyDetailTab: SurveyDetailTab;
  setSurveyDetailTab: (tab: SurveyDetailTab) => void;
  surveyForm: SurveyFormController;
  surveyList: SurveyListController;
  surveySync: SurveySyncController;
  publicMapExplorer: PublicMapExplorerController;
  ownSurveyIds: string[];
  onOpenCreateSurvey: () => void;
  onOpenSurvey: (surveyId: string) => void;
  onStartEditSurvey: (surveyId: string) => Promise<boolean>;
  onRenameSurvey: (surveyId: string, nextSiteName: string) => Promise<void>;
  onUpdateRegionVersion: (surveyId: string, region: RegionVersion) => Promise<void>;
  onUpdateVegetationStage: (surveyId: string, stage: VegetationStage) => Promise<void>;
  onSaveSurveyEdits: () => Promise<boolean>;
  onCreateDraft: () => Promise<boolean>;
  onCaptureGpsLocation: () => Promise<void>;
  onApiUrlChange: (value: string) => void;
  onCloseSurveyDetailSelection: () => void;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const SurveysStack = createNativeStackNavigator<SurveysStackParamList>();

const tabScreenOptions = ({ route }: { route: { name: keyof RootTabParamList } }) => ({
  headerShown: true,
  headerTitleAlign: 'left' as const,
  headerTitleStyle: {
    fontSize: 30,
    fontWeight: '800' as const,
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
    fontWeight: '600' as const
  },
  tabBarLabel: route.name === 'publicMap' ? 'Explore' : route.name === 'surveys' ? 'My Surveys' : 'Account',
  tabBarIcon: ({ color, size }: { color: string; size: number }) => {
    const iconName =
      route.name === 'surveys' ? 'list-outline' : route.name === 'publicMap' ? 'map-outline' : 'person-outline';
    return <Ionicons name={iconName as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
  }
});

function SurveysTabNavigator({
  apiUrl,
  formMode,
  editingSurveyId,
  surveyDetailTab,
  setSurveyDetailTab,
  surveyForm,
  surveyList,
  surveySync,
  onOpenCreateSurvey,
  onOpenSurvey,
  onStartEditSurvey,
  onRenameSurvey,
  onUpdateRegionVersion,
  onUpdateVegetationStage,
  onSaveSurveyEdits,
  onCreateDraft,
  onCaptureGpsLocation,
  onCloseSurveyDetailSelection
}: Omit<
  AuthenticatedAppNavigationProps,
  'publicMapExplorer' | 'ownSurveyIds' | 'onApiUrlChange'
>) {
  return (
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
          headerShown: false
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
                onOpenSurvey(surveyId);
                navigation.navigate('surveyDetail');
              }}
            />
            <Pressable
              style={styles.fabButton}
              onPress={() => {
                onOpenCreateSurvey();
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
            onCloseSurveyDetailSelection();
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
                  const loaded = await onStartEditSurvey(surveyId);
                  if (loaded) {
                    navigation.navigate('surveyFactorDetail', { factor });
                  }
                }}
                onRenameSurvey={onRenameSurvey}
                onUpdateRegionVersion={onUpdateRegionVersion}
                onUpdateVegetationStage={onUpdateVegetationStage}
                onOpenParcels={async (surveyId) => {
                  const loaded = await onStartEditSurvey(surveyId);
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
              onCaptureGpsLocation={onCaptureGpsLocation}
              factorSections={surveyForm.factorSections}
              factorRetainedScores={surveyForm.factorRetainedScores}
              formErrors={surveyForm.formErrors}
              onOpenFactor={(factor) => navigation.navigate('surveyFactorDetail', { factor })}
              onSaveSurveyEdits={async () => {
                const saved = await onSaveSurveyEdits();
                if (saved) {
                  navigation.goBack();
                }
              }}
              onCreateDraft={async () => {
                const created = await onCreateDraft();
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
            onCaptureGpsLocation={onCaptureGpsLocation}
            onSave={async () => {
              const saved = await onSaveSurveyEdits();
              if (saved) {
                navigation.goBack();
              }
            }}
          />
        )}
      </SurveysStack.Screen>
    </SurveysStack.Navigator>
  );
}

type PublicMapTabProps = {
  publicMapExplorer: PublicMapExplorerController;
  ownSurveyIds: string[];
  onReportSurvey: SurveySyncController['handleReportSurvey'];
};

function PublicMapTab({ publicMapExplorer, ownSurveyIds, onReportSurvey }: PublicMapTabProps) {
  return (
    <View style={styles.tabScreenContainer}>
      <PublicMapScreen
        items={publicMapExplorer.items}
        parcelStatuses={publicMapExplorer.parcelStatuses}
        ownSurveyIds={ownSurveyIds}
        loading={publicMapExplorer.loading}
        parcelsLoading={publicMapExplorer.parcelsLoading}
        fromDate={publicMapExplorer.fromDate}
        toDate={publicMapExplorer.toDate}
        region={publicMapExplorer.region}
        onChangeFromDate={publicMapExplorer.setFromDate}
        onChangeToDate={publicMapExplorer.setToDate}
        onChangeRegion={publicMapExplorer.setRegion}
        onLoad={publicMapExplorer.loadPublicMap}
        onLoadParcels={publicMapExplorer.loadPublicParcels}
        onReportSurvey={onReportSurvey}
      />
    </View>
  );
}

type AccountTabNavigatorProps = {
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  surveyList: SurveyListController;
  surveySync: SurveySyncController;
};

function AccountTabNavigator({ apiUrl, onApiUrlChange, surveyList, surveySync }: AccountTabNavigatorProps) {
  return (
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
              onApiUrlChange={onApiUrlChange}
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
}

export function AuthenticatedAppNavigation({
  apiUrl,
  formMode,
  editingSurveyId,
  surveyDetailTab,
  setSurveyDetailTab,
  surveyForm,
  surveyList,
  surveySync,
  publicMapExplorer,
  ownSurveyIds,
  onOpenCreateSurvey,
  onOpenSurvey,
  onStartEditSurvey,
  onRenameSurvey,
  onUpdateRegionVersion,
  onUpdateVegetationStage,
  onSaveSurveyEdits,
  onCreateDraft,
  onCaptureGpsLocation,
  onApiUrlChange,
  onCloseSurveyDetailSelection
}: AuthenticatedAppNavigationProps) {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={tabScreenOptions}>
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
          {() => (
            <SurveysTabNavigator
              apiUrl={apiUrl}
              formMode={formMode}
              editingSurveyId={editingSurveyId}
              surveyDetailTab={surveyDetailTab}
              setSurveyDetailTab={setSurveyDetailTab}
              surveyForm={surveyForm}
              surveyList={surveyList}
              surveySync={surveySync}
              onOpenCreateSurvey={onOpenCreateSurvey}
              onOpenSurvey={onOpenSurvey}
              onStartEditSurvey={onStartEditSurvey}
              onRenameSurvey={onRenameSurvey}
              onUpdateRegionVersion={onUpdateRegionVersion}
              onUpdateVegetationStage={onUpdateVegetationStage}
              onSaveSurveyEdits={onSaveSurveyEdits}
              onCreateDraft={onCreateDraft}
              onCaptureGpsLocation={onCaptureGpsLocation}
              onCloseSurveyDetailSelection={onCloseSurveyDetailSelection}
            />
          )}
        </Tab.Screen>
        <Tab.Screen
          name="publicMap"
          options={{
            title: 'Explore',
            headerShown: false
          }}
          listeners={{
            tabPress: () => {
              onCloseSurveyDetailSelection();
              void publicMapExplorer.loadPublicMap();
            }
          }}
        >
          {() => (
            <PublicMapTab
              publicMapExplorer={publicMapExplorer}
              ownSurveyIds={ownSurveyIds}
              onReportSurvey={surveySync.handleReportSurvey}
            />
          )}
        </Tab.Screen>
        <Tab.Screen
          name="account"
          options={{
            title: 'Account'
          }}
          listeners={{
            tabPress: () => {
              onCloseSurveyDetailSelection();
              if (surveySync.isAuthenticated) {
                void surveySync.handleLoadMyProfile({ silent: true });
              }
            }
          }}
        >
          {() => (
            <AccountTabNavigator
              apiUrl={apiUrl}
              onApiUrlChange={onApiUrlChange}
              surveyList={surveyList}
              surveySync={surveySync}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
