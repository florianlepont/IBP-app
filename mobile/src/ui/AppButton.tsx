import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from "react-native"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandTypography,
} from "../app/brand-tokens"

type AppButtonVariant = "primary" | "secondary" | "danger"

type AppButtonProps = {
  label: string
  variant?: AppButtonVariant
  disabled?: boolean
  onPress: () => void
  testID?: string
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
}

export function AppButton({
  label,
  variant = "primary",
  disabled = false,
  onPress,
  testID,
  style,
  labelStyle,
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, styles[variant], disabled ? styles.disabled : null, style]}
      testID={testID}
    >
      <Text
        style={[
          styles.label,
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
    minHeight: brandComponentTokens.button.minHeight,
    paddingHorizontal: brandComponentTokens.button.horizontalPadding,
    borderRadius: brandRadius.pill,
    alignItems: "center",
    justifyContent: "center",
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
  labelSecondary: {
    color: brandComponentTokens.button.secondaryBorder,
  },
})
