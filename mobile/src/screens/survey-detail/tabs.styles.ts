import { StyleSheet } from "react-native"
import { brandColors, brandShadow, brandTypography } from "../../app/brand-tokens"

export const styles = StyleSheet.create({
  eventsCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  eventRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
    paddingTop: 12,
  },
  eventTitle: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  eventPayload: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  debugCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 6,
    ...brandShadow.card,
  },
  debugAttachmentBlock: {
    gap: 10,
  },
  debugAttachmentCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 14,
    gap: 6,
  },
  debugAttachmentPreview: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    backgroundColor: brandColors.panelMuted,
  },
  debugAttachmentPreviewPlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
})
