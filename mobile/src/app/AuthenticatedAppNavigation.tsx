import { useEffect, useRef, type ElementType } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { NavigationContainer, getFocusedRouteNameFromRoute } from "@react-navigation/native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import Constants, { ExecutionEnvironment } from "expo-constants"
import { BlurView } from "expo-blur"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors } from "./brand-tokens"
import { useAppBottomTabBarHeight } from "./useAppBottomTabBarHeight"
import { styles } from "./styles"
import {
  FactorKey,
  GpsCaptureResult,
  RegionVersion,
  SurveyDetailTab,
  VegetationStage,
} from "./types"
import { SurveyFormScreen } from "../screens/SurveyFormScreen"
import { SurveyListScreen } from "../screens/SurveyListScreen"
import { SurveyDetailScreen } from "../screens/SurveyDetailScreen"
import { PublicMapScreen } from "../screens/PublicMapScreen"
import { AccountScreen } from "../screens/AccountScreen"
import { SettingsScreen } from "../screens/SettingsScreen"
import { FactorDetailScreen } from "../screens/FactorDetailScreen"
import { SurveyParcelSelectionScreen } from "../screens/SurveyParcelSelectionScreen"
import { useSurveyForm } from "../hooks/useSurveyForm"
import { useSurveyList } from "../hooks/useSurveyList"
import { useSurveySync } from "../hooks/useSurveySync"
import { usePublicMapExplorer } from "../hooks/usePublicMapExplorer"

export type RootTabParamList = {
  surveys: undefined
  publicMap: undefined
  account: undefined
}

type AccountStackParamList = {
  accountHome: undefined
  settings: undefined
}

type SurveysStackParamList = {
  surveysHome: undefined
  surveyDetail: undefined
  surveyForm: undefined
  surveyFactorDetail: { factor: FactorKey }
  surveyParcels: { surveyId: string; mode: "wizard" | "edit" }
}

type PublicMapStackParamList = {
  publicMapHome: undefined
}

export type FormMode = "create" | "edit"

type SurveyFormController = ReturnType<typeof useSurveyForm>
type SurveyListController = ReturnType<typeof useSurveyList>
type SurveySyncController = ReturnType<typeof useSurveySync>
type PublicMapExplorerController = ReturnType<typeof usePublicMapExplorer>

type AuthenticatedAppNavigationProps = {
  apiUrl: string
  formMode: FormMode
  editingSurveyId: string | null
  surveyDetailTab: SurveyDetailTab
  setSurveyDetailTab: (tab: SurveyDetailTab) => void
  surveyForm: SurveyFormController
  surveyList: SurveyListController
  surveySync: SurveySyncController
  publicMapExplorer: PublicMapExplorerController
  ownSurveyIds: string[]
  onOpenCreateSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
  onStartEditSurvey: (surveyId: string) => Promise<boolean>
  onRenameSurvey: (surveyId: string, nextSiteName: string) => Promise<void>
  onUpdateRegionVersion: (surveyId: string, region: RegionVersion) => Promise<void>
  onUpdateVegetationStage: (surveyId: string, stage: VegetationStage) => Promise<void>
  onSaveSurveyEdits: () => Promise<boolean>
  onCreateDraft: () => Promise<boolean>
  onCaptureGpsLocation: () => Promise<GpsCaptureResult | null>
  onApiUrlChange: (value: string) => void
  onCloseSurveyDetailSelection: () => void
}

// ─── Navigators ──────────────────────────────────────────────────────────────

const JsTab = createBottomTabNavigator<RootTabParamList>()
const AccountStack = createNativeStackNavigator<AccountStackParamList>()
const SurveysStack = createNativeStackNavigator<SurveysStackParamList>()
const PublicMapStack = createNativeStackNavigator<PublicMapStackParamList>()

type TabNavigatorLike = {
  Navigator: ElementType
  Screen: ElementType
}

// ─── Native availability detection ───────────────────────────────────────────

function isNativeBottomTabViewAvailable(): boolean {
  if (Platform.OS === "web") return false
  // Opt-out via env var (set EXPO_PUBLIC_ENABLE_NATIVE_TABS=false to force JS tabs)
  if (process.env.EXPO_PUBLIC_ENABLE_NATIVE_TABS === "false") return false
  return (
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    Constants.appOwnership !== "expo"
  )
}

function getNativeTabNavigator(): TabNavigatorLike {
  // Keep the native tabs package out of module initialization so unsupported
  // runtimes can still boot and fall back cleanly.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nativeBottomTabsModule = require("@bottom-tabs/react-navigation") as typeof import(
    "@bottom-tabs/react-navigation"
  )
  return nativeBottomTabsModule.createNativeBottomTabNavigator<RootTabParamList>() as TabNavigatorLike
}

// ─── Shared stack screen options ─────────────────────────────────────────────

const baseStackScreenOptions = {
  headerBackButtonDisplayMode: "minimal" as const,
  contentStyle: { backgroundColor: brandColors.canvas },
  ...(Platform.OS === "ios"
    ? {
        headerTransparent: true,
        headerBlurEffect: "systemMaterial" as const,
      }
    : {
        headerStyle: { backgroundColor: brandColors.canvas },
        headerShadowVisible: false,
        headerTintColor: brandColors.forest,
        headerTitleStyle: {
          color: brandColors.forest,
          fontSize: 18,
          fontWeight: "800" as const,
        },
      }),
}

// ─── Native tab icons ─────────────────────────────────────────────────────────

const IOS_TAB_ICONS = {
  surveys: {
    focused: { sfSymbol: "doc.text.fill" },
    unfocused: { sfSymbol: "doc.text" },
  },
  publicMap: {
    focused: { sfSymbol: "map.fill" },
    unfocused: { sfSymbol: "map" },
  },
  account: {
    focused: { sfSymbol: "person.crop.circle.fill" },
    unfocused: { sfSymbol: "person.crop.circle" },
  },
} as const

const ANDROID_TAB_ICONS = {
  surveys: require("../../assets/tabs/surveys.png"),
  publicMap: require("../../assets/tabs/public-map.png"),
  account: require("../../assets/tabs/account.png"),
} as const

const TAB_TITLES: Record<keyof RootTabParamList, string> = {
  surveys: "My Surveys",
  publicMap: "Explore",
  account: "Account",
}

const JS_TAB_ICONS: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  surveys: "list-outline",
  publicMap: "map-outline",
  account: "person-outline",
}

// ─── Native tab screen options ────────────────────────────────────────────────

const nativeTabScreenOptions = ({ route }: { route: { name: keyof RootTabParamList } }) => ({
  title: TAB_TITLES[route.name],
  tabBarActiveTintColor: brandColors.forest,
  tabBarIcon: ({ focused }: { focused: boolean }) => {
    if (Platform.OS === "ios") {
      return focused ? IOS_TAB_ICONS[route.name].focused : IOS_TAB_ICONS[route.name].unfocused
    }
    return ANDROID_TAB_ICONS[route.name]
  },
})

// ─── JS tab screen options (Expo Go fallback) ─────────────────────────────────

const jsTabScreenOptions = ({ route }: { route: { name: keyof RootTabParamList } }) => ({
  headerShown: false,
  title: TAB_TITLES[route.name],
  tabBarLabel: TAB_TITLES[route.name],
  tabBarActiveTintColor: brandColors.forest,
  tabBarInactiveTintColor: brandColors.textSecondary,
  tabBarStyle: {
    backgroundColor: brandColors.panel,
    borderTopColor: brandColors.divider,
    borderTopWidth: 1,
    height: Platform.select({ ios: 84, default: 68 }),
    paddingBottom: Platform.select({ ios: 22, default: 10 }),
    paddingTop: Platform.select({ ios: 8, default: 6 }),
  },
  tabBarLabelStyle: { fontSize: 12, fontWeight: "600" as const },
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={JS_TAB_ICONS[route.name]} size={size} color={color} />
  ),
})

// ─── Shared tab listeners ─────────────────────────────────────────────────────

function makeSurveysTabListeners(surveySync: SurveySyncController) {
  return {
    tabPress: () => {
      if (surveySync.isAuthenticated) {
        void surveySync.handlePullChanges()
      }
    },
  }
}

function makePublicMapTabListeners(
  publicMapExplorer: PublicMapExplorerController,
  onCloseSurveyDetailSelection: () => void,
) {
  return {
    tabPress: () => {
      onCloseSurveyDetailSelection()
      void publicMapExplorer.loadPublicMap()
    },
  }
}

function makeAccountTabListeners(
  surveySync: SurveySyncController,
  onCloseSurveyDetailSelection: () => void,
) {
  return {
    tabPress: () => {
      onCloseSurveyDetailSelection()
      if (surveySync.isAuthenticated) {
        void surveySync.handleLoadMyProfile({ silent: true })
      }
    },
  }
}

function CreateSurveyFloatingButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight(Platform.select({ ios: 84, default: 68 }) ?? 68)
  const buttonSize = 58
  const bottomOffset = Math.max(insets.bottom + 4, (tabBarHeight - buttonSize) / 2)

  return (
    <View pointerEvents="box-none" style={[floatingActionStyles.shell, { bottom: bottomOffset }]}>
      <Pressable onPress={onPress} style={floatingActionStyles.button}>
        <BlurView intensity={68} tint="systemMaterial" style={floatingActionStyles.blur}>
          <View style={floatingActionStyles.inner}>
            <Ionicons name="add" size={28} color={brandColors.forest} />
          </View>
        </BlurView>
      </Pressable>
    </View>
  )
}

const floatingActionStyles = StyleSheet.create({
  shell: {
    position: "absolute",
    right: 16,
    zIndex: 6,
  },
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  blur: {
    flex: 1,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    overflow: "hidden",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
})

// ─── Surveys stack ────────────────────────────────────────────────────────────

type SurveysTabNavigatorProps = Omit<
  AuthenticatedAppNavigationProps,
  "publicMapExplorer" | "ownSurveyIds" | "onApiUrlChange"
> & { useNativeNav?: boolean }

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
  onCloseSurveyDetailSelection,
  useNativeNav = false,
}: SurveysTabNavigatorProps) {
  return (
    <SurveysStack.Navigator
      screenOptions={{
        ...baseStackScreenOptions,
        headerLargeTitle: false,
        ...(useNativeNav
          ? {}
          : {
              headerShown: true,
              headerTitleAlign: "left",
              headerTitleStyle: {
                fontSize: 30,
                fontWeight: "900" as const,
                color: brandColors.forest,
              },
              headerStyle: { backgroundColor: brandColors.canvas },
              headerShadowVisible: false,
              headerTintColor: brandColors.forest,
            }),
      }}
    >
      <SurveysStack.Screen
        name="surveysHome"
        options={{
          title: "My Surveys",
          headerLargeTitle: false,
          headerShown: false,
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
                onOpenSurvey(surveyId)
                navigation.navigate("surveyDetail")
              }}
            />
            <CreateSurveyFloatingButton
              onPress={() => {
                onOpenCreateSurvey()
                navigation.navigate("surveyForm")
              }}
            />
          </View>
        )}
      </SurveysStack.Screen>
      <SurveysStack.Screen
        name="surveyDetail"
        options={{
          title: "Detail",
          headerLargeTitle: false,
        }}
        listeners={{
          beforeRemove: () => {
            onCloseSurveyDetailSelection()
          },
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
                  const loaded = await onStartEditSurvey(surveyId)
                  if (loaded) {
                    navigation.navigate("surveyFactorDetail", { factor })
                  }
                }}
                onRenameSurvey={onRenameSurvey}
                onUpdateRegionVersion={onUpdateRegionVersion}
                onUpdateVegetationStage={onUpdateVegetationStage}
                onOpenParcels={async (surveyId) => {
                  const loaded = await onStartEditSurvey(surveyId)
                  if (loaded) {
                    navigation.navigate("surveyParcels", { surveyId, mode: "edit" })
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
          title: formMode === "edit" ? "Edit survey" : "New survey",
          headerLargeTitle: false,
        }}
      >
        {({ navigation }) => (
          <SurveyFormScreen
            apiUrl={apiUrl}
            screen={formMode === "edit" ? "edit" : "create"}
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
            onOpenFactor={(factor) => navigation.navigate("surveyFactorDetail", { factor })}
            onOpenParcelFullscreen={() =>
              navigation.navigate("surveyParcels", {
                surveyId: editingSurveyId ?? "draft",
                mode: "wizard",
              })
            }
            onSaveSurveyEdits={async () => {
              const saved = await onSaveSurveyEdits()
              if (saved) navigation.goBack()
            }}
            onCreateDraft={async () => {
              const created = await onCreateDraft()
              if (created) navigation.goBack()
            }}
            status={surveySync.status}
          />
        )}
      </SurveysStack.Screen>
      <SurveysStack.Screen
        name="surveyFactorDetail"
        options={({ route }) => ({
          title: `Factor ${route.params.factor}`,
          headerLargeTitle: false,
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
          title: "Parcels",
          headerLargeTitle: false,
          headerStyle: { backgroundColor: "#132434" },
          headerShadowVisible: false,
          headerTintColor: brandColors.white,
          headerTitleStyle: {
            color: brandColors.white,
            fontSize: 18,
            fontWeight: "800" as const,
          },
          contentStyle: { backgroundColor: "#132434" },
        }}
      >
        {({ route, navigation }) => (
          <SurveyParcelSelectionScreen
            apiUrl={apiUrl}
            gpsLocation={surveyForm.gpsLocation}
            selectedParcelIds={surveyForm.selectedParcelIds}
            onToggleParcelSelection={surveyForm.toggleParcelSelection}
            onCaptureGpsLocation={onCaptureGpsLocation}
            hideDoneAction={route.params.mode === "wizard"}
            onSave={async () => {
              const saved = await onSaveSurveyEdits()
              if (saved) navigation.goBack()
            }}
          />
        )}
      </SurveysStack.Screen>
    </SurveysStack.Navigator>
  )
}

// ─── Public map ───────────────────────────────────────────────────────────────

type PublicMapTabProps = {
  publicMapExplorer: PublicMapExplorerController
  ownSurveyIds: string[]
  onReportSurvey: SurveySyncController["handleReportSurvey"]
}

function PublicMapTab({ publicMapExplorer, ownSurveyIds, onReportSurvey }: PublicMapTabProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.tabScreenContainer, { marginTop: -insets.top }]}>
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
  )
}

function PublicMapTabNavigator({ publicMapExplorer, ownSurveyIds, onReportSurvey }: PublicMapTabProps) {
  return (
    <PublicMapStack.Navigator
      screenOptions={{ ...baseStackScreenOptions, headerShown: false }}
    >
      <PublicMapStack.Screen name="publicMapHome">
        {() => (
          <PublicMapTab
            publicMapExplorer={publicMapExplorer}
            ownSurveyIds={ownSurveyIds}
            onReportSurvey={onReportSurvey}
          />
        )}
      </PublicMapStack.Screen>
    </PublicMapStack.Navigator>
  )
}

// ─── Account stack ────────────────────────────────────────────────────────────

type AccountTabNavigatorProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  surveyList: SurveyListController
  surveySync: SurveySyncController
}

function HeaderIconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name={icon} size={22} color={brandColors.forest} />
    </Pressable>
  )
}

function AccountTabNavigator({ apiUrl, onApiUrlChange, surveyList, surveySync }: AccountTabNavigatorProps) {
  return (
    <AccountStack.Navigator
      screenOptions={{
        ...baseStackScreenOptions,
        headerLargeTitle: false,
      }}
    >
      <AccountStack.Screen
        name="accountHome"
        options={({ navigation }) => ({
          title: "Account",
          headerLargeTitle: false,
          headerRight: () => (
            <HeaderIconButton
              icon="settings-outline"
              onPress={() => navigation.navigate("settings")}
            />
          ),
        })}
      >
        {() => (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.accountScreenWrap}
          >
            <AccountScreen
              accessToken={surveySync.accessToken}
              currentUser={surveySync.currentUser}
              profile={surveySync.profile}
              profileUpdating={surveySync.profileUpdating}
              apiUrl={apiUrl}
              onSaveProfile={(input) => surveySync.handleUpdateProfile(input)}
              onChangeEmail={(email) => surveySync.handleChangeEmail(email)}
              onPasswordReset={() => surveySync.handlePasswordReset()}
              onPickProfilePictureFromLibrary={surveySync.handlePickProfilePictureFromLibrary}
              onTakeProfilePictureFromCamera={surveySync.handleTakeProfilePictureFromCamera}
              onRemoveProfilePicture={surveySync.handleRemoveProfilePicture}
              onLogout={surveySync.handleLogout}
            />
          </KeyboardAvoidingView>
        )}
      </AccountStack.Screen>
      <AccountStack.Screen name="settings" options={{ title: "Settings" }}>
        {() => (
          <SettingsScreen
            apiUrl={apiUrl}
            onApiUrlChange={onApiUrlChange}
            onSync={surveySync.handleSync}
            onPullChanges={surveySync.handlePullChanges}
            onRefreshLocalList={surveyList.refreshLocalSurveys}
            onRefreshLocalAttachments={surveyList.refreshLocalAttachments}
            onDeleteAccount={surveySync.handleDeleteAccount}
            onDebugResetIbpData={surveySync.handleDebugResetIbpData}
            onDebugResetUserData={surveySync.handleDebugResetUserData}
            status={surveySync.status}
          />
        )}
      </AccountStack.Screen>
    </AccountStack.Navigator>
  )
}

// ─── Root tab navigators ──────────────────────────────────────────────────────

function NativeRootTabs({
  publicMapExplorer,
  ownSurveyIds,
  onApiUrlChange,
  ...surveysProps
}: AuthenticatedAppNavigationProps) {
  const { surveySync, onCloseSurveyDetailSelection } = surveysProps
  const nativeTabRef = useRef<TabNavigatorLike | null>(null)

  if (nativeTabRef.current == null) {
    nativeTabRef.current = getNativeTabNavigator()
  }

  const NativeTab = nativeTabRef.current

  return (
    <NativeTab.Navigator screenOptions={nativeTabScreenOptions}>
      <NativeTab.Screen name="surveys" listeners={makeSurveysTabListeners(surveySync)}>
        {() => <SurveysTabNavigator {...surveysProps} useNativeNav />}
      </NativeTab.Screen>
      <NativeTab.Screen
        name="publicMap"
        listeners={makePublicMapTabListeners(publicMapExplorer, onCloseSurveyDetailSelection)}
      >
        {() => (
          <PublicMapTabNavigator
            publicMapExplorer={publicMapExplorer}
            ownSurveyIds={ownSurveyIds}
            onReportSurvey={surveySync.handleReportSurvey}
          />
        )}
      </NativeTab.Screen>
      <NativeTab.Screen
        name="account"
        listeners={makeAccountTabListeners(surveySync, onCloseSurveyDetailSelection)}
      >
        {() => (
          <AccountTabNavigator
            apiUrl={surveysProps.apiUrl}
            onApiUrlChange={onApiUrlChange}
            surveyList={surveysProps.surveyList}
            surveySync={surveySync}
          />
        )}
      </NativeTab.Screen>
    </NativeTab.Navigator>
  )
}

function JsRootTabs({
  publicMapExplorer,
  ownSurveyIds,
  onApiUrlChange,
  ...surveysProps
}: AuthenticatedAppNavigationProps) {
  const { surveySync, onCloseSurveyDetailSelection } = surveysProps

  return (
    <JsTab.Navigator screenOptions={jsTabScreenOptions}>
      <JsTab.Screen
        name="surveys"
        options={({ route }) => ({
          tabBarLabel: "My Surveys",
          headerShown: false,
          tabBarStyle:
            getFocusedRouteNameFromRoute(route) === "surveyParcels"
              ? { display: "none" }
              : undefined,
        })}
        listeners={makeSurveysTabListeners(surveySync)}
      >
        {() => <SurveysTabNavigator {...surveysProps} />}
      </JsTab.Screen>
      <JsTab.Screen
        name="publicMap"
        options={{ headerShown: false }}
        listeners={makePublicMapTabListeners(publicMapExplorer, onCloseSurveyDetailSelection)}
      >
        {() => (
          <PublicMapTab
            publicMapExplorer={publicMapExplorer}
            ownSurveyIds={ownSurveyIds}
            onReportSurvey={surveySync.handleReportSurvey}
          />
        )}
      </JsTab.Screen>
      <JsTab.Screen
        name="account"
        options={{ headerShown: false }}
        listeners={makeAccountTabListeners(surveySync, onCloseSurveyDetailSelection)}
      >
        {() => (
          <AccountTabNavigator
            apiUrl={surveysProps.apiUrl}
            onApiUrlChange={onApiUrlChange}
            surveyList={surveysProps.surveyList}
            surveySync={surveySync}
          />
        )}
      </JsTab.Screen>
    </JsTab.Navigator>
  )
}

// ─── Root (single NavigationContainer) ───────────────────────────────────────

function AppTabs(props: AuthenticatedAppNavigationProps) {
  const nativeBottomTabsAvailable = isNativeBottomTabViewAvailable()

  useEffect(() => {
    if (!nativeBottomTabsAvailable) {
      console.warn(
        "RNCTabView unavailable — falling back to JS tabs (Expo Go or native binary not built yet).",
      )
    }
  }, [nativeBottomTabsAvailable])

  return nativeBottomTabsAvailable ? <NativeRootTabs {...props} /> : <JsRootTabs {...props} />
}

export function AuthenticatedAppNavigation(props: AuthenticatedAppNavigationProps) {
  return (
    <NavigationContainer>
      <AppTabs {...props} />
    </NavigationContainer>
  )
}
