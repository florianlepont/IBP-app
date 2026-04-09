import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native"
import { brandComponentTokens, brandRadius, brandTypography } from "../app/brand-tokens"

export type AppStatusChipTone = "neutral" | "success" | "warning" | "danger" | "onDark"

type AppStatusChipProps = {
  label: string
  tone?: AppStatusChipTone
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
}

export function AppStatusChip({ label, tone = "neutral", style, labelStyle }: AppStatusChipProps) {
  return (
    <View style={[styles.base, styles[tone], style]}>
      <Text style={[styles.label, tone === "onDark" && styles.labelOnDark, labelStyle]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  neutral: {
    borderColor: brandComponentTokens.statusChip.neutralBorder,
    backgroundColor: brandComponentTokens.statusChip.neutralBackground,
  },
  success: {
    borderColor: brandComponentTokens.statusChip.successBorder,
    backgroundColor: brandComponentTokens.statusChip.successBackground,
  },
  warning: {
    borderColor: brandComponentTokens.statusChip.warningBorder,
    backgroundColor: brandComponentTokens.statusChip.warningBackground,
  },
  danger: {
    borderColor: brandComponentTokens.statusChip.dangerBorder,
    backgroundColor: brandComponentTokens.statusChip.dangerBackground,
  },
  onDark: {
    borderColor: brandComponentTokens.statusChip.onDarkBorder,
    backgroundColor: brandComponentTokens.statusChip.onDarkBackground,
  },
  label: {
    ...brandTypography.meta,
    color: brandComponentTokens.statusChip.textColor,
  },
  labelOnDark: {
    color: brandComponentTokens.statusChip.onDarkTextColor,
  },
})
