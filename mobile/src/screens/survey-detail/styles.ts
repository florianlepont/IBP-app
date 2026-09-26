import { StyleSheet } from "react-native"
import { brandColors, brandSpacing, brandTypography } from "../../app/brand-tokens"

export const styles = StyleSheet.create({
  mainScroll: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  detailScreenContent: {
    padding: brandSpacing.md,
    gap: brandSpacing.md,
    paddingBottom: 120,
  },
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailSection: {
    gap: 12,
  },
  rowMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  warningText: {
    ...brandTypography.meta,
    color: brandColors.ochre,
  },
})
