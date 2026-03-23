import { ReactNode } from "react"
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native"
import { brandColors, brandSpacing, brandTypography } from "../app/brand-tokens"

type AppSectionHeaderProps = {
  title: string
  subtitle?: string
  trailing?: ReactNode
  style?: StyleProp<ViewStyle>
  copyStyle?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
  subtitleStyle?: StyleProp<TextStyle>
}

export function AppSectionHeader({
  title,
  subtitle,
  trailing,
  style,
  copyStyle,
  titleStyle,
  subtitleStyle,
}: AppSectionHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={[styles.copy, copyStyle]}>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: brandSpacing.md - 4,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...brandTypography.sectionTitle,
    color: brandColors.forest,
  },
  subtitle: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
})
