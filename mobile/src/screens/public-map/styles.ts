import { StyleSheet } from "react-native"
import { brandColors, brandShadow, brandTypography } from "../../app/brand-tokens"

// Pin colours of the public map markers.
export const markerColors = {
  survey: "#2a7a52",
  selected: brandColors.terracotta,
  currentPosition: "#245f96",
} as const

export const markerStyles = StyleSheet.create({
  clusterBubble: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: brandColors.white,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    ...brandShadow.card,
  },
  clusterText: {
    ...brandTypography.label,
    color: brandColors.white,
  },
})
