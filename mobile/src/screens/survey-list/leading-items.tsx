import { useMemo } from "react"
import type { ReactElement } from "react"
import type { LocalSurvey } from "../../storage"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { fr } from "../../i18n"
import { AttentionSection } from "./AttentionSection"
import { CreateSurveyCard } from "./CreateSurveyCard"
import { styles } from "./styles"

// A non-survey item at the top of the list (create card, "À faire" card, section header).
export type LeadingListItem = { kind: "leading"; key: string; element: ReactElement }
export type SurveyListItem = LeadingListItem | LocalSurvey

export function isLeadingListItem(item: SurveyListItem): item is LeadingListItem {
  return "kind" in item && item.kind === "leading"
}

export const keyExtractor = (item: SurveyListItem): string =>
  isLeadingListItem(item) ? `leading:${item.key}` : item.id

type LeadingItemsInput = {
  showFeatured: boolean
  useNativeSearchUI: boolean
  surveyCount: number
  visibleCount: number
  mainListCount: number
  visibleSurveySummary: string
  attentionSurveys: LocalSurvey[]
  continueDraftSurvey: LocalSurvey | null
  onOpenCreateSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
}

// The create card, the "À faire" card and the section header scroll under the
// sticky filters bar, so they are list items rather than part of the header.
// Each element is memoised so renderItem returns the same element (D-03).
export function useLeadingItems({
  showFeatured,
  useNativeSearchUI,
  surveyCount,
  visibleCount,
  mainListCount,
  visibleSurveySummary,
  attentionSurveys,
  continueDraftSurvey,
  onOpenCreateSurvey,
  onOpenSurvey,
}: LeadingItemsInput): LeadingListItem[] {
  const firstSurvey = surveyCount === 0

  const createCardElement = useMemo(
    () =>
      showFeatured ? (
        <CreateSurveyCard firstSurvey={firstSurvey} onOpenCreateSurvey={onOpenCreateSurvey} />
      ) : null,
    [firstSurvey, onOpenCreateSurvey, showFeatured],
  )

  const todoCardElement = useMemo(
    () =>
      showFeatured && (attentionSurveys.length > 0 || continueDraftSurvey) ? (
        <AttentionSection
          attentionSurveys={attentionSurveys}
          continueDraftSurvey={continueDraftSurvey}
          onOpenSurvey={onOpenSurvey}
        />
      ) : null,
    [attentionSurveys, continueDraftSurvey, onOpenSurvey, showFeatured],
  )

  const sectionHeaderElement = useMemo(
    () =>
      mainListCount > 0 || (useNativeSearchUI && surveyCount > 0) ? (
        <AppSectionHeader
          title={showFeatured ? fr.surveyList.section.mine : fr.surveyList.section.results}
          subtitle={
            showFeatured && mainListCount < visibleCount
              ? fr.surveyList.section.others(mainListCount)
              : visibleSurveySummary
          }
          titleStyle={styles.homeSectionTitle}
          subtitleStyle={styles.homeSectionSubtitle}
          style={styles.listSectionHeader}
        />
      ) : null,
    [
      mainListCount,
      showFeatured,
      surveyCount,
      useNativeSearchUI,
      visibleSurveySummary,
      visibleCount,
    ],
  )

  return useMemo(() => {
    const items: LeadingListItem[] = []
    if (createCardElement)
      items.push({ kind: "leading", key: "create", element: createCardElement })
    if (todoCardElement) items.push({ kind: "leading", key: "todo", element: todoCardElement })
    if (sectionHeaderElement)
      items.push({ kind: "leading", key: "section", element: sectionHeaderElement })
    return items
  }, [createCardElement, sectionHeaderElement, todoCardElement])
}
