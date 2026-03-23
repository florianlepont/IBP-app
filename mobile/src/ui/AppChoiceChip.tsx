import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from "react-native"
import { brandComponentTokens, brandRadius, brandTypography } from "../app/brand-tokens"

export type AppChoiceChipTone = "neutral" | "success" | "warning" | "danger"

type AppChoiceChipProps = {
  label: string
  active?: boolean
  tone?: AppChoiceChipTone
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
}

export function AppChoiceChip({
  label,
  active = false,
  tone = "neutral",
  onPress,
  style,
  labelStyle,
}: AppChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.base,
        styles[tone],
        active ? styles.active : null,
        !onPress ? styles.static : null,
        style,
      ]}
    >
      <Text style={[styles.label, active ? styles.labelActive : null, labelStyle]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandComponentTokens.choiceChip.border,
    backgroundColor: brandComponentTokens.choiceChip.background,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  neutral: {},
  success: {
    backgroundColor: brandComponentTokens.choiceChip.successBackground,
  },
  warning: {
    backgroundColor: brandComponentTokens.choiceChip.warningBackground,
  },
  danger: {
    backgroundColor: brandComponentTokens.choiceChip.dangerBackground,
  },
  active: {
    borderColor: brandComponentTokens.choiceChip.activeBorder,
    backgroundColor: brandComponentTokens.choiceChip.activeBackground,
  },
  static: {
    opacity: 0.92,
  },
  label: {
    ...brandTypography.meta,
    color: brandComponentTokens.choiceChip.text,
  },
  labelActive: {
    color: brandComponentTokens.choiceChip.activeText,
  },
})
