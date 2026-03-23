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
  label?: string
  variant?: AppButtonVariant
  size?: AppButtonSize
  leadingIcon?: keyof typeof Ionicons.glyphMap
  iconOnly?: boolean
  accessibilityLabel?: string
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
  iconOnly = false,
  accessibilityLabel,
  disabled = false,
  onPress,
  testID,
  style,
  labelStyle,
}: AppButtonProps) {
  const hasLabel = Boolean(label?.trim().length)
  const iconColor =
    variant === "secondary" ? brandComponentTokens.button.secondaryBorder : brandColors.white
  const iconSize = size === "lg" ? 18 : size === "sm" ? 15 : 16

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? "Action"}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        iconOnly ? styles.iconOnlyBase : styles[size],
        iconOnly
          ? size === "lg"
            ? styles.iconOnlyLg
            : size === "sm"
              ? styles.iconOnlySm
              : styles.iconOnlyMd
          : null,
        styles[variant],
        disabled ? styles.disabled : null,
        style,
      ]}
      testID={testID}
    >
      {leadingIcon ? <Ionicons name={leadingIcon} size={iconSize} color={iconColor} /> : null}
      {hasLabel && !iconOnly ? (
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
      ) : null}
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
  iconOnlyBase: {
    paddingHorizontal: 0,
    borderRadius: brandRadius.pill,
  },
  iconOnlySm: {
    width: brandComponentTokens.button.iconOnlySizeSmall,
    height: brandComponentTokens.button.iconOnlySizeSmall,
  },
  iconOnlyMd: {
    width: brandComponentTokens.button.iconOnlySize,
    height: brandComponentTokens.button.iconOnlySize,
  },
  iconOnlyLg: {
    width: brandComponentTokens.button.iconOnlySizeLarge,
    height: brandComponentTokens.button.iconOnlySizeLarge,
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
