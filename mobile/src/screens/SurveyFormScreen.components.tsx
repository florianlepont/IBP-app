import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../app/brand-tokens"
import { FactorKey, FactorRetainedScore } from "../app/types"
import { AppChoiceChip } from "../ui/AppChoiceChip"
import { toAddressLabel } from "./survey-screen-helpers"
import { screenStyles } from "./SurveyFormScreen.styles"

export const FACTOR_ORDER: FactorKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
export const FACTOR_ICONS: Record<FactorKey, keyof typeof Ionicons.glyphMap> = {
  A: "leaf-outline",
  B: "layers-outline",
  C: "git-branch-outline",
  D: "reorder-three-outline",
  E: "resize-outline",
  F: "sparkles-outline",
  G: "flower-outline",
  H: "git-network-outline",
  I: "water-outline",
  J: "triangle-outline",
}

export function StepButton({
  index,
  label,
  meta,
  active,
  complete,
  disabled = false,
  onPress,
}: {
  index: string
  label: string
  meta: string
  active: boolean
  complete: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        screenStyles.stepButton,
        active ? screenStyles.stepButtonActive : null,
        complete && !active ? screenStyles.stepButtonComplete : null,
        disabled ? screenStyles.stepButtonDisabled : null,
      ]}
    >
      <View style={screenStyles.stepButtonTopRow}>
        <View
          style={[screenStyles.stepIndexPill, active ? screenStyles.stepIndexPillActive : null]}
        >
          <Text
            style={[screenStyles.stepIndexText, active ? screenStyles.stepIndexTextActive : null]}
          >
            {index}
          </Text>
        </View>
        <Ionicons
          name={
            active ? "radio-button-on" : complete ? "checkmark-circle" : "chevron-forward-circle"
          }
          size={18}
          color={
            active ? brandColors.white : complete ? brandColors.forest : brandColors.textSecondary
          }
        />
      </View>
      <Text
        numberOfLines={1}
        style={[screenStyles.stepButtonTitle, active ? screenStyles.stepButtonTitleActive : null]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[screenStyles.stepButtonMeta, active ? screenStyles.stepButtonMetaActive : null]}
      >
        {meta}
      </Text>
      <Text
        numberOfLines={1}
        style={[screenStyles.stepButtonHint, active ? screenStyles.stepButtonHintActive : null]}
      >
        {active ? "Current step" : disabled ? "Name required" : "Tap to open"}
      </Text>
    </Pressable>
  )
}

export function WizardChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return <AppChoiceChip label={label} active={active} onPress={onPress} />
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
  progress: { complete: boolean; filled: number; total: number; invalid: number }
  retainedScore: FactorRetainedScore | null
  onPress: () => void
}) {
  const toneStyle = progress.complete
    ? screenStyles.factorTileComplete
    : progress.invalid > 0
      ? screenStyles.factorTileWarning
      : screenStyles.factorTilePending
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

  return (
    <Pressable onPress={onPress} style={[screenStyles.factorTile, toneStyle]}>
      <View style={screenStyles.factorTileTopRow}>
        <View style={screenStyles.factorTileIdentity}>
          <View style={screenStyles.factorBadge}>
            <Text style={screenStyles.factorBadgeText}>{factor}</Text>
          </View>
          <View style={screenStyles.factorIconWrap}>
            <Ionicons name={factorIcon} size={16} color={brandColors.forest} />
          </View>
        </View>
        <Ionicons name={iconName} size={16} color={iconColor} />
      </View>
      <Text numberOfLines={2} style={screenStyles.factorTileTitle}>
        {title}
      </Text>
      <Text style={screenStyles.factorTileMeta}>
        {progress.filled}/{progress.total} fields
      </Text>
      <Text style={screenStyles.factorTileState}>
        {retainedScore
          ? `${retainedScore.selected_class} · ${retainedScore.score} pts`
          : progress.complete
            ? "Ready"
            : "Pending"}
      </Text>
    </Pressable>
  )
}

export { toAddressLabel }
