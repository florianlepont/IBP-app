import { ReactNode } from "react"
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native"
import { brandColors, brandComponentTokens, brandRadius, brandShadow } from "../app/brand-tokens"

type AppCardVariant = "panel" | "panelElevated" | "surface" | "soft" | "hero"

type AppCardProps = {
  children: ReactNode
  variant?: AppCardVariant
  padding?: number
  style?: StyleProp<ViewStyle>
}

export function AppCard({
  children,
  variant = "panel",
  padding = brandComponentTokens.card.defaultPadding,
  style,
}: AppCardProps) {
  return <View style={[styles.base, styles[variant], { padding }, style]}>{children}</View>
}

const styles = StyleSheet.create({
  base: {
    borderRadius: brandRadius.card,
  },
  panel: {
    backgroundColor: brandColors.panel,
  },
  panelElevated: {
    backgroundColor: brandColors.panel,
    borderWidth: 1,
    borderColor: brandComponentTokens.card.panelBorder,
    ...brandShadow.card,
  },
  surface: {
    backgroundColor: brandColors.white,
    borderWidth: 1,
    borderColor: brandComponentTokens.card.surfaceBorder,
    ...brandShadow.card,
  },
  soft: {
    backgroundColor: brandComponentTokens.card.softSurface,
    borderWidth: 1,
    borderColor: brandComponentTokens.card.surfaceBorder,
  },
  // Dark premium surface — for identity/hero cards on dark brand background
  hero: {
    backgroundColor: brandColors.forest,
    ...brandShadow.card,
  },
})
