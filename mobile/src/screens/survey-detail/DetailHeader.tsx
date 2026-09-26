import { useEffect, useState } from "react"
import { Alert, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../../app/brand-tokens"
import { formatDateTime } from "../../app/formatters"
import {
  formatSurveySyncDisplayLabel,
  formatSurveyWorkflowStatusLabel,
  resolveSurveySyncDisplay,
  resolveSurveyWorkflowStatus,
} from "../../app/survey-logic"
import { fr } from "../../i18n"
import { LocalSurvey } from "../../storage"
import { AppButton } from "../../ui/AppButton"
import { AppField } from "../../ui/AppField"
import { AppStatusChip, AppStatusChipTone } from "../../ui/AppStatusChip"
import { HeroMetric, HeroSubmitState, resolveHeroSubmitCopy } from "./hero-state"
import { styles } from "./header.styles"

type DetailHeaderProps = {
  survey: LocalSurvey
  activeSiteName: string
  canEditSurvey: boolean
  isHeroCompressed: boolean
  metric: HeroMetric
  submitState: HeroSubmitState
  remainingTime: string
  attachmentCount: number
  onRenameSurvey: (surveyId: string, nextSiteName: string) => Promise<void> | void
  onSubmitSurvey: (surveyId: string) => Promise<void>
}

const h = fr.surveyDetail.header
const a11y = fr.surveyDetail.a11y
const alerts = fr.surveyDetail.alerts

const resolveSyncTone = (
  syncDisplay: ReturnType<typeof resolveSurveySyncDisplay>,
): AppStatusChipTone => {
  if (syncDisplay === "sync") return "success"
  if (syncDisplay === "sync_error" || syncDisplay === "sync_blocked") return "danger"
  return "neutral"
}

export function DetailHeader({
  survey,
  activeSiteName,
  canEditSurvey,
  isHeroCompressed,
  metric,
  submitState,
  remainingTime,
  attachmentCount,
  onRenameSurvey,
  onSubmitSurvey,
}: DetailHeaderProps) {
  const [isRenamingSite, setIsRenamingSite] = useState(false)
  const [siteNameInput, setSiteNameInput] = useState("")

  useEffect(() => {
    setIsRenamingSite(false)
    setSiteNameInput(activeSiteName)
  }, [survey.id, activeSiteName])

  const handleSaveSiteRename = (): void => {
    const nextName = siteNameInput.trim()
    if (!canEditSurvey) {
      return
    }
    if (!nextName) {
      Alert.alert(alerts.invalidNameTitle, alerts.invalidNameMessage)
      return
    }
    void onRenameSurvey(survey.id, nextName)
    setIsRenamingSite(false)
  }
  const startRename = (): void => {
    if (!canEditSurvey) return
    setIsRenamingSite(true)
  }

  const workflowStatusLabel = formatSurveyWorkflowStatusLabel(resolveSurveyWorkflowStatus(survey))
  const syncDisplay = resolveSurveySyncDisplay(survey)
  const syncDisplayLabel = formatSurveySyncDisplayLabel(syncDisplay)
  const completionRate = Math.max(0, Math.min(survey.completion_rate, 100))
  const compressed = isHeroCompressed && !isRenamingSite
  const compactHeroSummary = h.compactSummary({
    workflow: workflowStatusLabel,
    sync: syncDisplayLabel,
  })
  const submitCopy = resolveHeroSubmitCopy(submitState)
  const isSubmitReady = submitState === "ready"

  return (
    <View style={styles.detailHeroStickyWrap}>
      <View style={[styles.detailHeroCard, compressed ? styles.detailHeroCardCompressed : null]}>
        <View style={styles.detailHeroAccentOrb} />
        {isRenamingSite ? (
          <View style={styles.detailRenameRow}>
            <AppField
              label={h.renameLabel}
              value={siteNameInput}
              onChangeText={setSiteNameInput}
              autoFocus
              placeholder={h.renamePlaceholder}
              placeholderTextColor="#D7E3C0"
              containerStyle={styles.detailRenameField}
              labelStyle={styles.detailRenameLabel}
              inputStyle={styles.detailRenameInput}
            />
            <AppButton
              label={fr.common.actions.save}
              size="sm"
              onPress={handleSaveSiteRename}
              style={styles.detailRenameSaveButton}
              labelStyle={styles.detailRenameSaveButtonText}
            />
            <AppButton
              label={fr.common.actions.cancel}
              variant="secondary"
              size="sm"
              onPress={() => {
                setIsRenamingSite(false)
                setSiteNameInput(activeSiteName)
              }}
              style={styles.detailRenameCancelButton}
              labelStyle={styles.detailRenameCancelButtonText}
            />
          </View>
        ) : compressed ? (
          <View style={styles.detailHeroCompactHeader}>
            <Pressable
              style={styles.detailHeroCompactCopy}
              onPress={startRename}
              accessibilityRole="button"
              accessibilityLabel={a11y.renameSurvey(activeSiteName)}
              accessibilityState={{ disabled: !canEditSurvey }}
            >
              <Text numberOfLines={1} style={styles.detailHeroCompactTitle}>
                {activeSiteName}
              </Text>
              <Text numberOfLines={1} style={styles.detailHeroCompactMeta}>
                {compactHeroSummary}
              </Text>
            </Pressable>

            <View style={styles.detailHeroCompactMetricPill}>
              <Text style={styles.detailHeroCompactMetricLabel}>{metric.caption}</Text>
              <Text style={styles.detailHeroCompactMetricValue}>{metric.value}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.detailHeader}>
            <Pressable
              style={styles.detailHeroCopy}
              onPress={startRename}
              accessibilityRole="button"
              accessibilityLabel={a11y.renameSurvey(activeSiteName)}
              accessibilityState={{ disabled: !canEditSurvey }}
            >
              <Text style={styles.detailHeroEyebrow}>{h.eyebrow}</Text>
              <Text style={styles.detailSurveyTitle}>{activeSiteName}</Text>
              <View style={styles.detailHeroStatusRow}>
                <AppStatusChip
                  label={workflowStatusLabel}
                  style={[styles.detailHeroStatusPill, styles.detailHeroStatusPillNeutral]}
                  labelStyle={styles.detailHeroStatusPillText}
                />
                <AppStatusChip
                  label={syncDisplayLabel}
                  tone={resolveSyncTone(syncDisplay)}
                  style={[
                    styles.detailHeroStatusPill,
                    syncDisplay === "sync"
                      ? styles.detailHeroStatusPillSuccess
                      : syncDisplay === "sync_error" || syncDisplay === "sync_blocked"
                        ? styles.detailHeroStatusPillDanger
                        : styles.detailHeroStatusPillNeutral,
                  ]}
                  labelStyle={styles.detailHeroStatusPillText}
                />
                <AppStatusChip
                  label={survey.visibility === "public" ? h.visibilityPublic : h.visibilityPrivate}
                  style={[styles.detailHeroStatusPill, styles.detailHeroStatusPillNeutral]}
                  labelStyle={styles.detailHeroStatusPillText}
                />
              </View>
            </Pressable>

            <View style={styles.detailHeroMetricCard}>
              <Text style={styles.detailHeroMetricLabel}>{metric.caption}</Text>
              <Text style={styles.detailHeroMetricValue}>{metric.value}</Text>
              <Text style={styles.detailHeroMetricMeta}>{metric.meta}</Text>
            </View>
          </View>
        )}

        {submitState !== "ready" ? (
          <View
            style={[
              styles.detailHeroProgressCard,
              compressed ? styles.detailHeroProgressCardCompact : null,
            ]}
          >
            <View style={styles.detailHeroProgressHeader}>
              <Text style={styles.detailHeroProgressLabel}>{h.completionRate}</Text>
              <Text style={styles.detailHeroProgressValue}>{h.percent(completionRate)}</Text>
            </View>
            <View style={styles.detailHeroProgressTrack}>
              <View
                style={[
                  styles.detailHeroProgressFill,
                  { width: completionRate === 0 ? 0 : `${completionRate}%` },
                ]}
              />
            </View>
            {!compressed ? (
              <View style={styles.detailHeroProgressFooter}>
                <View style={styles.heroMetaPill}>
                  <Ionicons name="time-outline" size={13} color="#D7E3C0" />
                  <Text style={styles.heroMetaText}>
                    {h.updatedAt(formatDateTime(survey.updated_at))}
                  </Text>
                </View>
                <View style={styles.heroMetaPill}>
                  <Ionicons name="images-outline" size={13} color="#D7E3C0" />
                  <Text style={styles.heroMetaText}>{h.photoCount(attachmentCount)}</Text>
                </View>
                {survey.status !== "submitted" ? (
                  <View style={styles.heroMetaPill}>
                    <Ionicons name="hourglass-outline" size={13} color="#D7E3C0" />
                    <Text style={styles.heroMetaText}>{remainingTime}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {survey.status !== "submitted" ? (
          isSubmitReady && compressed ? (
            <Pressable
              style={styles.detailHeroSubmitButtonCompact}
              onPress={() => void onSubmitSurvey(survey.id)}
              accessibilityRole="button"
              accessibilityLabel={a11y.submitSurvey(activeSiteName)}
            >
              <Ionicons name="paper-plane-outline" size={15} color={brandColors.forest} />
              <Text style={styles.detailHeroSubmitButtonText}>{h.submitSurvey}</Text>
            </Pressable>
          ) : (
            <View
              style={[
                styles.detailHeroSubmitCard,
                compressed ? styles.detailHeroSubmitCardCompact : null,
                submitState === "ready"
                  ? styles.detailHeroSubmitCardReady
                  : submitState === "blocked"
                    ? styles.detailHeroSubmitCardBlocked
                    : submitState === "pending_sync"
                      ? styles.detailHeroSubmitCardPendingSync
                      : null,
              ]}
            >
              <View style={styles.detailHeroSubmitHeader}>
                <View style={styles.detailHeroSubmitHeaderCopy}>
                  <Text style={styles.detailHeroSubmitTitle}>{submitCopy.heading}</Text>
                  {!compressed ? (
                    <Text style={styles.detailHeroSubmitBody}>{submitCopy.body}</Text>
                  ) : null}
                </View>
                {isSubmitReady ? (
                  <Pressable
                    style={styles.detailHeroSubmitButtonInline}
                    onPress={() => void onSubmitSurvey(survey.id)}
                    accessibilityRole="button"
                    accessibilityLabel={a11y.submitSurvey(activeSiteName)}
                  >
                    <Ionicons name="paper-plane-outline" size={15} color={brandColors.forest} />
                    <Text style={styles.detailHeroSubmitButtonText}>{h.submit}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.detailHeroSubmitPill}>
                    <Text style={styles.detailHeroSubmitPillText}>{submitCopy.pill}</Text>
                  </View>
                )}
              </View>
            </View>
          )
        ) : null}
      </View>
    </View>
  )
}
