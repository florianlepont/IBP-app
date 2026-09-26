import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandShadow,
  brandTypography,
} from "../../app/brand-tokens"
import { fr } from "../../i18n"
import type { LocalSurvey } from "../../storage/types"

type DraftCardProps = {
  survey: LocalSurvey
  onPress: () => void
}

// completion_rate is an integer percentage, 0-100 (01.9 D-03).
function clampRate(rate: number): number {
  return Math.max(0, Math.min(100, Math.round(rate)))
}

function getAccentColor(survey: LocalSurvey, rate: number): string {
  if (survey.sync_blocked) return brandColors.terracotta
  if (rate >= 100) return brandColors.moss
  return brandColors.ochre
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return fr.common.justNow
  if (hours < 24) return fr.components.draftCard.hoursAgo({ count: hours })
  const days = Math.floor(hours / 24)
  if (days === 1) return fr.components.draftCard.yesterday
  return fr.components.draftCard.daysAgo({ count: days })
}

export function DraftCard({ survey, onPress }: DraftCardProps) {
  const rate = clampRate(survey.completion_rate)
  const accent = getAccentColor(survey, rate)
  const completedFactors = Math.round(rate / 10)
  const progressWidth = `${rate}%` as const

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {survey.site_name || fr.common.untitledSurvey}
        </Text>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{fr.components.draftCard.progressLabel}</Text>
          <Text style={styles.progressCount}>
            {fr.components.draftCard.factorCount({ count: completedFactors })}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth, backgroundColor: accent }]} />
        </View>

        <View style={styles.divider} />

        <View style={styles.meta}>
          <Text style={styles.metaText}>{formatRelativeTime(survey.updated_at)}</Text>
          {survey.sync_blocked ? (
            <View style={styles.syncWarning}>
              <Ionicons name="warning-outline" size={12} color={brandColors.terracotta} />
              <Text style={styles.syncWarningText}>{fr.components.draftCard.syncBlocked}</Text>
            </View>
          ) : survey.sync_state === "pending" ? (
            <View style={styles.syncPending}>
              <Ionicons name="cloud-upload-outline" size={12} color={brandColors.textSecondary} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: brandColors.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: brandComponentTokens.card.panelBorder,
    flexDirection: "row",
    overflow: "hidden",
    ...brandShadow.card,
  },
  accent: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  title: {
    ...brandTypography.input,
    color: brandColors.textPrimary,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: brandColors.textSecondary,
  },
  progressCount: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  progressTrack: {
    height: 4,
    backgroundColor: brandColors.divider,
    borderRadius: brandRadius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: brandRadius.pill,
  },
  divider: {
    height: 1,
    backgroundColor: brandColors.divider,
    marginVertical: 2,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  syncWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  syncWarningText: {
    fontSize: 10,
    fontWeight: "600",
    color: brandColors.terracotta,
  },
  syncPending: {
    opacity: 0.6,
  },
})
