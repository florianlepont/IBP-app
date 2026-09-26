import { StyleSheet } from "react-native"
import { brandColors, brandRadius, brandShadow, brandTypography } from "../../app/brand-tokens"

export const formStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 108,
    gap: 10,
  },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 16,
    gap: 10,
    ...brandShadow.card,
  },
  identityStepContent: {
    gap: 10,
  },
  panelHeaderCompact: {
    flex: 1,
    gap: 3,
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 19,
    lineHeight: 22,
    color: brandColors.forest,
  },
  panelBody: {
    ...brandTypography.sectionBody,
    fontSize: 12,
    lineHeight: 17,
    color: brandColors.textSecondary,
  },
  label: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    borderRadius: brandRadius.field,
    backgroundColor: brandColors.inputFill,
    color: brandColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.input,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    minWidth: 104,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.panel,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    ...brandTypography.button,
    color: brandColors.forest,
  },
  primaryButton: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    ...brandShadow.card,
  },
  primaryButtonWide: {
    flex: 1,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    ...brandShadow.card,
  },
})
