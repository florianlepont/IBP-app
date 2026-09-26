import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../../app/brand-tokens"
import { FACTOR_TITLES } from "../../app/constants"
import { computeIbpTotalsFromRetainedScores } from "../../app/ibp-scoring"
import { FactorField, FactorKey, FactorRetainedScore } from "../../app/types"
import { AppCard } from "../../ui/AppCard"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { FACTOR_ICONS, FACTOR_ORDER } from "./components"
import { factorStyles } from "./factors.styles"
import { formStyles } from "./styles"
import { fr } from "../../i18n"

export type FactorProgress = { complete: boolean; filled: number; total: number; invalid: number }

export function computeFactorProgress(
  factorSections: Record<FactorKey, FactorField[]>,
): Record<FactorKey, FactorProgress> {
  return FACTOR_ORDER.reduce<Record<FactorKey, FactorProgress>>(
    (acc, factor) => {
      const fields = factorSections[factor]
      const total = fields.length
      const filled = fields.filter((field) => field.value.trim().length > 0).length
      const invalid = fields.filter((field) => Boolean(field.error)).length
      acc[factor] = {
        complete: total > 0 && filled === total && invalid === 0,
        filled,
        total,
        invalid,
      }
      return acc
    },
    {} as Record<FactorKey, FactorProgress>,
  )
}

export function FactorTile({
  factor,
  factorIcon,
  title,
  progress,
  retainedScore,
  onPress,
}: {
  factor: FactorKey
  factorIcon: keyof typeof Ionicons.glyphMap
  title: string
  progress: FactorProgress
  retainedScore: FactorRetainedScore | null
  onPress: () => void
}) {
  const toneStyle = progress.complete
    ? factorStyles.factorTileComplete
    : progress.invalid > 0
      ? factorStyles.factorTileWarning
      : factorStyles.factorTilePending
  const iconName = progress.complete
    ? "checkmark-circle"
    : progress.invalid > 0
      ? "alert-circle"
      : "ellipse-outline"
  const iconColor = progress.complete
    ? brandColors.forest
    : progress.invalid > 0
      ? brandColors.terracotta
      : brandColors.textSecondary

  const stateText = retainedScore
    ? fr.surveyForm.factors.retainedScore({
        selectedClass: retainedScore.selected_class,
        score: retainedScore.score,
      })
    : progress.complete
      ? fr.surveyForm.factors.ready
      : fr.surveyForm.factors.pending

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fr.surveyForm.a11y.factorTile({ factor, title, state: stateText })}
      onPress={onPress}
      style={[factorStyles.factorTile, toneStyle]}
    >
      <View style={factorStyles.factorTileTopRow}>
        <View style={factorStyles.factorTileIdentity}>
          <View style={factorStyles.factorBadge}>
            <Text style={factorStyles.factorBadgeText}>{factor}</Text>
          </View>
          <View style={factorStyles.factorIconWrap}>
            <Ionicons name={factorIcon} size={16} color={brandColors.forest} />
          </View>
        </View>
        <Ionicons name={iconName} size={16} color={iconColor} />
      </View>
      <Text numberOfLines={2} style={factorStyles.factorTileTitle}>
        {title}
      </Text>
      <Text style={factorStyles.factorTileMeta}>
        {fr.surveyForm.factors.fieldsProgress({ filled: progress.filled, total: progress.total })}
      </Text>
      <Text style={factorStyles.factorTileState}>{stateText}</Text>
    </Pressable>
  )
}

// Step 3 of the wizard: live IBP total and one tile per factor A-J.
export function FactorsList({
  factorProgress,
  factorRetainedScores,
  scoreTotals,
  onOpenFactor,
}: {
  factorProgress: Record<FactorKey, FactorProgress>
  factorRetainedScores: Record<FactorKey, FactorRetainedScore | null>
  scoreTotals: ReturnType<typeof computeIbpTotalsFromRetainedScores>
  onOpenFactor: (factor: FactorKey) => void
}) {
  return (
    <>
      <View style={factorStyles.scoreHeroCard}>
        <Text style={factorStyles.scoreHeroLabel}>{fr.surveyForm.factors.scoreLabel}</Text>
        <Text style={factorStyles.scoreHeroValue}>{scoreTotals.ibp_total}</Text>
        <Text style={factorStyles.scoreHeroMeta}>
          {fr.surveyForm.factors.scoreBreakdown({
            stand: scoreTotals.ibp_peuplement_gestion,
            context: scoreTotals.ibp_contexte,
          })}
        </Text>
        <Text style={factorStyles.scoreHeroMeta}>
          {fr.surveyForm.factors.scoreableCount({ count: scoreTotals.completed_factors })}
        </Text>
      </View>

      <AppCard variant="panelElevated" style={formStyles.panel}>
        <AppSectionHeader
          title={fr.surveyForm.factors.sectionTitle}
          subtitle={fr.surveyForm.factors.sectionSubtitle}
          titleStyle={formStyles.panelTitle}
          subtitleStyle={formStyles.panelBody}
        />

        <View style={factorStyles.factorGrid}>
          {FACTOR_ORDER.map((factor) => (
            <FactorTile
              key={factor}
              factor={factor}
              factorIcon={FACTOR_ICONS[factor]}
              title={FACTOR_TITLES[factor]}
              progress={factorProgress[factor]}
              retainedScore={factorRetainedScores[factor]}
              onPress={() => onOpenFactor(factor)}
            />
          ))}
        </View>
      </AppCard>
    </>
  )
}
