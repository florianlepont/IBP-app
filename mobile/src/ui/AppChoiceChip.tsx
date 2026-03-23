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
  const isInteractive = typeof onPress === "function"

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!isInteractive}
      onPress={onPress}
      style={[
        styles.base,
        isInteractive ? styles.interactive : styles.static,
        styles[tone],
        active ? styles.active : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          !isInteractive ? styles.labelStatic : null,
          active ? styles.labelActive : null,
          labelStyle,
        ]}
      >
        {label}
      </Text>
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
  interactive: {
    borderColor: brandComponentTokens.choiceChip.interactiveBorder,
    backgroundColor: brandComponentTokens.choiceChip.interactiveBackground,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    opacity: 0.76,
  },
  label: {
    ...brandTypography.meta,
    color: brandComponentTokens.choiceChip.text,
  },
  labelStatic: {
    color: brandComponentTokens.choiceChip.staticText,
  },
  labelActive: {
    color: brandComponentTokens.choiceChip.activeText,
  },
})
