import { Pressable, StyleSheet, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandRadius, brandTypography } from "../../app/brand-tokens"
import { AppCard } from "../../ui/AppCard"
import { triggerHaptic } from "./haptics"

type CreateSurveyCardProps = {
  firstSurvey: boolean
  onOpenCreateSurvey: () => void
}

// The "create a survey" call to action at the top of the list.
export function CreateSurveyCard({ firstSurvey, onOpenCreateSurvey }: CreateSurveyCardProps) {
  const copy = firstSurvey
    ? {
        badge: "Premier relevé",
        title: "Créez votre premier relevé",
        body: "Commencez votre carnet de terrain IBP en quelques étapes.",
        actionLabel: "Commencer",
        accessibilityLabel: "Créer votre premier relevé",
      }
    : {
        badge: "Nouveau relevé",
        title: "Créer un nouveau relevé",
        body: "Ajoutez un relevé IBP à votre carnet de terrain.",
        actionLabel: "Créer",
        accessibilityLabel: "Créer un nouveau relevé",
      }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.accessibilityLabel}
      onPress={() => {
        triggerHaptic()
        onOpenCreateSurvey()
      }}
      style={({ pressed }) => [pressed && styles.createSurveyCardPressed]}
    >
      <AppCard variant="panelElevated" padding={16} style={styles.createSurveyCard}>
        <View pointerEvents="none" style={styles.createSurveyAccentOrb} />
        <View pointerEvents="none" style={styles.createSurveyAccentRail} />

        <View style={styles.createSurveyHeader}>
          <View style={styles.createSurveyBadge}>
            <Ionicons name="leaf-outline" size={14} color={brandColors.forest} />
            <Text style={styles.createSurveyBadgeText}>{copy.badge}</Text>
          </View>

          <View style={styles.createSurveyActionPill}>
            <Text style={styles.createSurveyActionText}>{copy.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={brandColors.white} />
          </View>
        </View>

        <Text style={styles.createSurveyTitle}>{copy.title}</Text>
        <Text style={styles.createSurveyBody}>{copy.body}</Text>
      </AppCard>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  createSurveyCard: {
    position: "relative",
    overflow: "hidden",
    borderColor: "rgba(51, 78, 43, 0.18)",
    backgroundColor: brandColors.panel,
    gap: 10,
  },
  createSurveyAccentOrb: {
    position: "absolute",
    top: -20,
    right: -8,
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: "rgba(137,163,58,0.12)",
  },
  createSurveyAccentRail: {
    position: "absolute",
    top: 16,
    bottom: 16,
    left: 0,
    width: 5,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: brandColors.moss,
  },
  createSurveyHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  createSurveyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(176, 199, 142, 0.24)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  createSurveyBadgeText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  createSurveyActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createSurveyActionText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  createSurveyTitle: {
    ...brandTypography.input,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    color: brandColors.forest,
  },
  createSurveyBody: {
    ...brandTypography.sectionBody,
    maxWidth: "88%",
    color: brandColors.textSecondary,
  },
  createSurveyCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
})
