import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandRadius, brandTypography } from "../../app/brand-tokens"
import { formatShortDateTime, formatSyncErrorForUser } from "../../app/formatters"
import { formatSurveyUiStatusLabel, resolveSurveyUiStatus } from "../../app/survey-logic"
import { fr } from "../../i18n"
import type { LocalSurvey } from "../../storage"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { ContinueDraftCard } from "./ContinueDraftCard"
import { triggerHaptic } from "./haptics"
import { styles as sharedStyles } from "./styles"

type UiStatus = ReturnType<typeof resolveSurveyUiStatus>

// At most 3 surveys needing attention; 2 shown inline, the rest counted.
const MAX_ATTENTION = 3
const MAX_VISIBLE_ATTENTION = 2

function parseSurveyDate(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function resolveAttentionPriority(uiStatus: UiStatus): number {
  if (uiStatus === "sync_blocked") return 0
  if (uiStatus === "sync_error") return 1
  if (uiStatus === "expired") return 2
  return 3
}

function resolveAttentionStyle(uiStatus: UiStatus): {
  bg: string
  iconName: keyof typeof Ionicons.glyphMap
  iconColor: string
} {
  if (uiStatus === "sync_blocked" || uiStatus === "sync_error") {
    return {
      bg: brandColors.errorSoft,
      iconName: "alert-circle",
      iconColor: brandColors.terracotta,
    }
  }
  if (uiStatus === "expired") {
    return { bg: brandColors.warningSoft, iconName: "time", iconColor: brandColors.ochre }
  }
  return {
    bg: brandColors.panel,
    iconName: "information-circle",
    iconColor: brandColors.textSecondary,
  }
}

/** The most recently updated survey still in progress (not submitted, not expired). */
export function pickContinueDraft(surveys: LocalSurvey[]): LocalSurvey | null {
  const candidates = surveys.filter(
    (survey) => survey.status !== "submitted" && survey.status !== "expired",
  )
  candidates.sort((a, b) => parseSurveyDate(b.updated_at) - parseSurveyDate(a.updated_at))
  return candidates[0] ?? null
}

/** Blocked, failed and expired surveys, worst first, without the draft card's survey. */
export function pickAttentionSurveys(
  surveys: LocalSurvey[],
  excludedId: string | undefined,
): LocalSurvey[] {
  const items = surveys
    .filter((survey) => {
      const uiStatus = resolveSurveyUiStatus(survey)
      return uiStatus === "sync_blocked" || uiStatus === "sync_error" || uiStatus === "expired"
    })
    .filter((survey) => survey.id !== excludedId)

  items.sort((left, right) => {
    const priorityDelta =
      resolveAttentionPriority(resolveSurveyUiStatus(left)) -
      resolveAttentionPriority(resolveSurveyUiStatus(right))
    if (priorityDelta !== 0) return priorityDelta
    return parseSurveyDate(right.updated_at) - parseSurveyDate(left.updated_at)
  })

  return items.slice(0, MAX_ATTENTION)
}

const t = fr.surveyList.attention

type AttentionSectionProps = {
  attentionSurveys: LocalSurvey[]
  continueDraftSurvey: LocalSurvey | null
  onOpenSurvey: (surveyId: string) => void
}

// The "À faire" card (P1-GLANCE-02): attention rows, then the draft to continue.
export function AttentionSection({
  attentionSurveys,
  continueDraftSurvey,
  onOpenSurvey,
}: AttentionSectionProps) {
  const visible = attentionSurveys.slice(0, MAX_VISIBLE_ATTENTION)
  const hiddenCount = attentionSurveys.length - visible.length
  const count = attentionSurveys.length

  return (
    <AppCard variant="surface" padding={14} style={styles.todoCard}>
      <AppSectionHeader
        title={t.title}
        subtitle={
          count > 0 && continueDraftSurvey
            ? t.problemsAndDraft(count)
            : count > 0
              ? t.toReview(count)
              : t.draftOnly
        }
        titleStyle={sharedStyles.homeSectionTitle}
        subtitleStyle={sharedStyles.homeSectionSubtitle}
      />

      {/* Attention rows — max 2 visible */}
      {visible.map((survey) => {
        const uiStatus = resolveSurveyUiStatus(survey)
        const { bg, iconName, iconColor } = resolveAttentionStyle(uiStatus)

        return (
          <Pressable
            key={survey.id}
            accessibilityRole="button"
            accessibilityLabel={t.rowA11y({
              name: survey.site_name,
              status: formatSurveyUiStatusLabel(uiStatus),
            })}
            onPress={() => {
              triggerHaptic()
              onOpenSurvey(survey.id)
            }}
            style={({ pressed }) => [
              styles.attentionRow,
              { backgroundColor: bg },
              pressed && sharedStyles.rowPressed,
            ]}
          >
            <Ionicons name={iconName} size={18} color={iconColor} style={styles.attentionRowIcon} />
            <View style={styles.attentionRowCopy}>
              <Text numberOfLines={1} style={styles.attentionRowTitle}>
                {survey.site_name}
              </Text>
              <Text numberOfLines={1} style={styles.attentionRowMeta}>
                {formatSyncErrorForUser(survey.last_sync_error) ??
                  t.updated(formatShortDateTime(survey.updated_at))}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
          </Pressable>
        )
      })}

      {/* "Voir N autres" if more than 2 */}
      {hiddenCount > 0 ? <Text style={styles.seeMoreText}>{t.more(hiddenCount)}</Text> : null}

      {/* Divider between attention rows and draft */}
      {count > 0 && continueDraftSurvey ? <View style={styles.todoDivider} /> : null}

      {continueDraftSurvey ? (
        <ContinueDraftCard survey={continueDraftSurvey} onOpenSurvey={onOpenSurvey} />
      ) : null}
    </AppCard>
  )
}

const styles = StyleSheet.create({
  todoCard: {
    gap: 10,
  },
  // Attention rows — P3-TOUCH-01: minHeight 44 for touch target
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44, // P3-TOUCH-01
    borderRadius: brandRadius.field,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attentionRowIcon: {
    flexShrink: 0,
  },
  attentionRowCopy: {
    flex: 1,
    gap: 3,
  },
  attentionRowTitle: {
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: brandColors.textPrimary,
  },
  attentionRowMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  seeMoreText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    paddingLeft: 2,
  },
  todoDivider: {
    height: 1,
    backgroundColor: brandColors.divider,
  },
})
