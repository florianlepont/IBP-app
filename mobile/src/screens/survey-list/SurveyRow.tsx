import { memo, useCallback, useRef } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { Image as ExpoImage } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import Swipeable from "react-native-gesture-handler/Swipeable"
import { brandColors } from "../../app/brand-tokens"
import { formatShortDateTime, formatSyncErrorForUser } from "../../app/formatters"
import { formatSurveyUiStatusLabel, resolveSurveyUiStatus } from "../../app/survey-logic"
import { fr } from "../../i18n"
import type { LocalSurvey } from "../../storage/types"
import { AppStatusChip } from "../../ui/AppStatusChip"
import type { AttachmentPreview } from "../survey-screen-helpers"
import { triggerHaptic } from "./haptics"
import { rowStyles as styles } from "./row-styles"

type SurveyRowTone = "neutral" | "success" | "warning" | "danger"

/** First photo preview of a survey, with the attachment id used as image recycling key. */
export type SurveyRowPreview = AttachmentPreview & { attachmentId: string }

export type SurveyRowProps = {
  survey: LocalSurvey
  preview: SurveyRowPreview | null
  selected: boolean
  onOpen: (surveyId: string) => void
  onDelete: (surveyId: string) => void
}

const t = fr.surveyList

function resolveSurveyRowTone(uiStatus: ReturnType<typeof resolveSurveyUiStatus>): SurveyRowTone {
  if (uiStatus === "sync_error" || uiStatus === "sync_blocked" || uiStatus === "expired")
    return "danger"
  if (uiStatus === "submitted") return "success"
  if (uiStatus === "sync_pending") return "warning"
  return "neutral"
}

const ACCENT_STYLE_BY_TONE = {
  success: styles.surveyCardAccentSuccess,
  warning: styles.surveyCardAccentWarning,
  danger: styles.surveyCardAccentDanger,
  neutral: styles.surveyCardAccentNeutral,
} as const

function previewEqual(left: SurveyRowPreview | null, right: SurveyRowPreview | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.attachmentId !== right.attachmentId || left.kind !== right.kind) return false
  if (left.kind === "image" && right.kind === "image") return left.uri === right.uri
  return true
}

function RowPreview({ preview }: { preview: SurveyRowPreview }) {
  if (preview.kind === "image") {
    return (
      <View style={styles.surveyCardMedia}>
        <ExpoImage
          source={{ uri: preview.uri }}
          style={styles.surveyCardPreview}
          contentFit="cover"
          cachePolicy="memory"
          recyclingKey={preview.attachmentId}
        />
      </View>
    )
  }
  return (
    <View style={styles.surveyCardMedia}>
      <View style={[styles.surveyCardPreview, styles.surveyCardPreviewPlaceholder]}>
        {preview.kind === "loading" ? (
          <ActivityIndicator size="small" color={brandColors.textSecondary} />
        ) : (
          <Ionicons
            name={preview.kind === "missing" ? "warning-outline" : "image-outline"}
            size={18}
            color={brandColors.textSecondary}
          />
        )}
      </View>
    </View>
  )
}

/**
 * One survey list row (01.9-22, D-03). Memoised: it re-renders only when its own
 * survey object, preview, selection or callbacks change. Callbacks take the
 * survey id, so the list passes the same two functions to every row.
 */
function SurveyRowComponent({ survey, preview, selected, onOpen, onDelete }: SurveyRowProps) {
  const swipeableRef = useRef<Swipeable>(null)
  const surveyId = survey.id
  const uiStatus = resolveSurveyUiStatus(survey)
  const uiStatusLabel = formatSurveyUiStatusLabel(uiStatus)
  const rowTone = resolveSurveyRowTone(uiStatus)
  const updatedAt = formatShortDateTime(survey.updated_at)
  const supportText = formatSyncErrorForUser(survey.last_sync_error, survey.last_sync_error_code)

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close()
    onDelete(surveyId)
  }, [onDelete, surveyId])

  const handleOpen = useCallback(() => {
    triggerHaptic()
    onOpen(surveyId)
  }, [onOpen, surveyId])

  const renderLeftActions = useCallback(
    () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.a11y.deleteSurvey(survey.site_name)}
        onPress={handleDelete}
        style={({ pressed }) => [
          styles.surveyDeleteAction,
          pressed && styles.surveyDeleteActionPressed,
        ]}
      >
        <Ionicons name="trash-outline" size={18} color={brandColors.white} />
        <Text style={styles.surveyDeleteActionText}>{t.row.deleteAction}</Text>
      </Pressable>
    ),
    [handleDelete, survey.site_name],
  )

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={56}
      dragOffsetFromLeftEdge={22}
      containerStyle={styles.surveySwipeable}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={t.a11y.openSurvey({
          name: survey.site_name,
          status: uiStatusLabel,
          updatedAt,
        })}
        style={({ pressed }) => [
          styles.surveyCard,
          selected ? styles.surveyCardSelected : null,
          pressed && styles.surveyCardPressed,
        ]}
        onPress={handleOpen}
      >
        {/* Accent bar — transparent for neutral (N-06) */}
        <View style={[styles.surveyCardAccent, ACCENT_STYLE_BY_TONE[rowTone]]} />

        {/* P2-COMPACT-01: thumbnail only when photo exists */}
        {preview ? <RowPreview preview={preview} /> : null}

        <View style={styles.surveyCardContent}>
          <View style={styles.surveyCardHeader}>
            <Text numberOfLines={2} style={styles.surveyCardTitle}>
              {survey.site_name}
            </Text>
            {selected ? (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={brandColors.forest}
                style={styles.surveyCardSelectedIcon}
              />
            ) : null}
          </View>

          <View style={styles.surveyCardStatusRow}>
            <AppStatusChip
              label={uiStatusLabel}
              tone={rowTone}
              labelStyle={rowTone === "danger" ? styles.badgeTextDanger : undefined}
            />
            <Text numberOfLines={1} style={styles.surveyCardMeta}>
              {t.row.updatedMeta(updatedAt)}
            </Text>
          </View>

          {supportText ? (
            <Text numberOfLines={2} style={styles.surveyCardSupport}>
              {supportText}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Swipeable>
  )
}

export const SurveyRow = memo(
  SurveyRowComponent,
  (previous, next) =>
    previous.survey === next.survey &&
    previous.selected === next.selected &&
    previous.onOpen === next.onOpen &&
    previous.onDelete === next.onDelete &&
    previewEqual(previous.preview, next.preview),
)
