import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandTypography,
} from "../app/brand-tokens"

type AppButtonVariant = "primary" | "secondary" | "danger"
type AppButtonSize = "sm" | "md" | "lg"

type AppButtonProps = {
  label: string
  variant?: AppButtonVariant
  size?: AppButtonSize
  leadingIcon?: keyof typeof Ionicons.glyphMap
  disabled?: boolean
  onPress: () => void
  testID?: string
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
}

export function AppButton({
  label,
  variant = "primary",
  size = "md",
  leadingIcon,
  disabled = false,
  onPress,
  testID,
  style,
  labelStyle,
}: AppButtonProps) {
  const iconColor =
    variant === "secondary" ? brandComponentTokens.button.secondaryBorder : brandColors.white

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        styles[size],
        styles[variant],
        disabled ? styles.disabled : null,
        style,
      ]}
      testID={testID}
    >
      {leadingIcon ? <Ionicons name={leadingIcon} size={size === "lg" ? 18 : 16} color={iconColor} /> : null}
      <Text
        style={[
          styles.label,
          size === "sm" ? styles.labelSmall : null,
          variant === "secondary" ? styles.labelSecondary : null,
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
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sm: {
    minHeight: brandComponentTokens.button.minHeightSmall,
    paddingHorizontal: brandComponentTokens.button.horizontalPaddingSmall,
  },
  md: {
    minHeight: brandComponentTokens.button.minHeight,
    paddingHorizontal: brandComponentTokens.button.horizontalPadding,
  },
  lg: {
    minHeight: brandComponentTokens.button.minHeightLarge,
    paddingHorizontal: brandComponentTokens.button.horizontalPaddingLarge,
  },
  primary: {
    backgroundColor: brandComponentTokens.button.primaryBackground,
  },
  secondary: {
    backgroundColor: brandComponentTokens.button.secondaryBackground,
    borderWidth: 1,
    borderColor: brandComponentTokens.button.secondaryBorder,
  },
  danger: {
    backgroundColor: brandComponentTokens.button.dangerBackground,
  },
  disabled: {
    opacity: 0.7,
  },
  label: {
    ...brandTypography.button,
    color: brandColors.white,
    textAlign: "center",
  },
  labelSmall: {
    ...brandTypography.meta,
  },
  labelSecondary: {
    color: brandComponentTokens.button.secondaryBorder,
  },
})
