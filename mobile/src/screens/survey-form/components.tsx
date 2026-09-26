import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors } from "../../app/brand-tokens"
import { FactorKey } from "../../app/types"
import { AppChoiceChip } from "../../ui/AppChoiceChip"
import { headerStyles } from "./header.styles"

export type WizardStep = "identity" | "parcels" | "factors"

export const WIZARD_STEPS: WizardStep[] = ["identity", "parcels", "factors"]

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
        headerStyles.stepButton,
        active ? headerStyles.stepButtonActive : null,
        complete && !active ? headerStyles.stepButtonComplete : null,
        disabled ? headerStyles.stepButtonDisabled : null,
      ]}
    >
      <View style={headerStyles.stepButtonTopRow}>
        <View
          style={[headerStyles.stepIndexPill, active ? headerStyles.stepIndexPillActive : null]}
        >
          <Text
            style={[headerStyles.stepIndexText, active ? headerStyles.stepIndexTextActive : null]}
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
        style={[headerStyles.stepButtonTitle, active ? headerStyles.stepButtonTitleActive : null]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[headerStyles.stepButtonMeta, active ? headerStyles.stepButtonMetaActive : null]}
      >
        {meta}
      </Text>
      <Text
        numberOfLines={1}
        style={[headerStyles.stepButtonHint, active ? headerStyles.stepButtonHintActive : null]}
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
