import { memo, useEffect, useLayoutEffect, useRef } from "react"
import { Platform } from "react-native"
import type { SearchBarCommands } from "react-native-screens"
import { brandColors } from "../../app/brand-tokens"
import { SurveyListScreen } from "../../screens/SurveyListScreen"
import { useSurveys } from "../../state/surveys-context"
import { useSyncActions } from "../../state/sync-actions-context"
import { useLatestCallback } from "../../state/useLatestCallback"
import type { SurveyListRouteProps } from "../types"

type SurveyListRouteConfig = {
  /** The surveys stack runs inside the native (iOS) tab bar. */
  useNativeNav?: boolean
  /** This stack is the dedicated iOS "Recherche" tab. */
  searchEntry?: boolean
}

/**
 * Survey list route (phase 01.9-18, D-01): the surveys context and the sync
 * actions. It also owns the native header search bar (options and text sync),
 * so the surveys stack navigator does not subscribe to the surveys context.
 * The two booleans are static navigator configuration, not data.
 */
export const SurveyListRoute = memo(function SurveyListRoute({
  navigation,
  useNativeNav = false,
  searchEntry = false,
}: SurveyListRouteProps & SurveyListRouteConfig) {
  const { state, actions } = useSurveys()
  const syncActions = useSyncActions()

  const nativeSearchEnabled = useNativeNav && Platform.OS === "ios" && searchEntry
  const hasDedicatedSearchTab = useNativeNav && Platform.OS === "ios"
  const searchBarRef = useRef<SearchBarCommands>(null!)

  useLayoutEffect(() => {
    if (!nativeSearchEnabled) return
    navigation.setOptions({
      headerSearchBarOptions: {
        ref: searchBarRef,
        placeholder: "Rechercher des relevés",
        placement: "automatic",
        hideWhenScrolling: false,
        obscureBackground: false,
        autoCapitalize: "none",
        tintColor: brandColors.forest,
        onChangeText: (event) => {
          actions.setSurveyQuery(event.nativeEvent.text)
        },
        onCancelButtonPress: () => {
          actions.setSurveyQuery("")
        },
      },
    })
  }, [actions, nativeSearchEnabled, navigation])

  useEffect(() => {
    if (!nativeSearchEnabled) return
    if (state.surveyQuery.trim().length === 0) {
      searchBarRef.current?.clearText()
      return
    }

    searchBarRef.current?.setText(state.surveyQuery)
  }, [nativeSearchEnabled, state.surveyQuery])

  const onOpenCreateSurvey = useLatestCallback(() => {
    actions.openCreateSurvey()
    navigation.navigate("surveyForm")
  })
  const onOpenSurvey = useLatestCallback((surveyId: string) => {
    actions.openSurvey(surveyId)
    navigation.navigate("surveyDetail")
  })

  return (
    <SurveyListScreen
      surveys={state.surveys}
      visibleSurveys={hasDedicatedSearchTab && !searchEntry ? state.surveys : state.visibleSurveys}
      selectedSurveyId={state.selectedSurveyId}
      attachmentsBySurvey={state.attachmentsBySurvey}
      surveyQuery={state.surveyQuery}
      setSurveyQuery={actions.setSurveyQuery}
      surveyFromDate={state.surveyFromDate}
      setSurveyFromDate={actions.setSurveyFromDate}
      surveyToDate={state.surveyToDate}
      setSurveyToDate={actions.setSurveyToDate}
      statusFilter={state.statusFilter}
      setStatusFilter={actions.setStatusFilter}
      visibilityFilter={state.visibilityFilter}
      setVisibilityFilter={actions.setVisibilityFilter}
      syncFilter={state.syncFilter}
      setSyncFilter={actions.setSyncFilter}
      blockedFilter={state.blockedFilter}
      setBlockedFilter={actions.setBlockedFilter}
      attachmentFilter={state.attachmentFilter}
      setAttachmentFilter={actions.setAttachmentFilter}
      sortMode={state.sortMode}
      setSortMode={actions.setSortMode}
      resetFilters={actions.resetFilters}
      useNativeSearchUI={nativeSearchEnabled}
      showInlineSearch={!hasDedicatedSearchTab}
      onRefresh={syncActions.handlePullChanges}
      onDeleteSurvey={actions.confirmDeleteSurvey}
      onOpenCreateSurvey={onOpenCreateSurvey}
      onOpenSurvey={onOpenSurvey}
      onEnsureAttachmentPreviews={syncActions.handleEnsureAttachmentPreviews}
    />
  )
})
