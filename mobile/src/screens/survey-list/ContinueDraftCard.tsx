import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandTypography,
} from "../../app/brand-tokens"
import { fr } from "../../i18n"
import type { LocalSurvey } from "../../storage"
import { triggerHaptic } from "./haptics"
import { styles as sharedStyles } from "./styles"

const t = fr.surveyList.continueDraft

type ContinueDraftCardProps = {
  survey: LocalSurvey
  onOpenSurvey: (surveyId: string) => void
}

// P2-PERSON-03: draft row — sage-tinted, compact with progress bar
export function ContinueDraftCard({ survey, onOpenSurvey }: ContinueDraftCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.a11y(survey.site_name)}
      onPress={() => {
        triggerHaptic()
        onOpenSurvey(survey.id)
      }}
      style={({ pressed }) => [styles.draftRow, pressed && sharedStyles.rowPressed]}
    >
      <View style={styles.draftIconWrap}>
        <Ionicons name="document-text-outline" size={16} color={brandColors.forest} />
      </View>
      <View style={styles.draftContent}>
        <Text numberOfLines={1} style={styles.draftTitle}>
          {survey.site_name}
        </Text>
        {/* P2-UX-01: Visual progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(4, Math.min(100, survey.completion_rate))}%` },
            ]}
          />
        </View>
        <Text style={styles.draftMeta}>{t.completion(survey.completion_rate)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  draftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    borderRadius: brandRadius.field,
    backgroundColor: brandColors.successSoft, // sage-adjacent warm green
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  draftIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    flexShrink: 0,
  },
  draftContent: {
    flex: 1,
    gap: 4,
  },
  draftTitle: {
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: brandColors.textPrimary,
  },
  // P2-UX-01: progress bar
  progressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: brandComponentTokens.surveyList.progressTrack,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: brandColors.moss,
  },
  draftMeta: {
    ...brandTypography.meta,
    fontSize: 11,
    color: brandColors.textSecondary,
  },
})
