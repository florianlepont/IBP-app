import { StyleSheet } from "react-native"
import { brandColors, brandRadius, brandShadow, brandTypography } from "../../app/brand-tokens"

export const styles = StyleSheet.create({
  detailMetadataCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  detailParcelsEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryItem: {
    color: brandColors.forest,
    backgroundColor: brandColors.panelMuted,
  },
  summaryItemLabel: {
    color: brandColors.forest,
  },
  scoreHeroCard: {
    borderRadius: 24,
    backgroundColor: brandColors.successSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  scoreHeroLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary,
  },
  scoreHeroValue: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    color: brandColors.forest,
  },
  scoreHeroMeta: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  factorTilesCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  factorTotalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  factorTotalPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  factorTotalText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  factorTilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  factorTile: {
    width: "31%",
    minWidth: 98,
    flexGrow: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  factorTileCompleted: {
    borderColor: "#B8CFA4",
    backgroundColor: brandColors.successSoft,
  },
  factorTilePending: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
  },
  factorTileEditable: {
    borderColor: brandColors.divider,
  },
  factorTileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  factorTileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  factorBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.forest,
  },
  factorBadgeText: {
    ...brandTypography.label,
    fontSize: 12,
    lineHeight: 14,
    color: brandColors.white,
  },
  factorTileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  factorTileIconWrapCompleted: {
    backgroundColor: brandColors.panelMuted,
  },
  factorTileIconWrapPending: {
    backgroundColor: brandColors.panelMuted,
  },
  factorTileClass: {
    ...brandTypography.label,
    fontSize: 13,
    lineHeight: 16,
    color: brandColors.textPrimary,
  },
  factorTileCode: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  factorTileClassCompleted: {
    color: brandColors.forest,
  },
  factorTileClassPending: {
    color: brandColors.textSecondary,
  },
  factorTileStatusPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  factorTileStatusPillCompleted: {
    backgroundColor: "#DCE7C4",
  },
  factorTileStatusPillPending: {
    backgroundColor: brandColors.panelMuted,
  },
  factorTileWarning: {
    ...brandTypography.meta,
    color: brandColors.terracotta,
  },
  actionPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  actionButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  submittedReadonlyBanner: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#BBD09B",
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 8,
  },
  deadlineCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 6,
  },
  deadlineCardWarning: {
    borderColor: "#E7C281",
    backgroundColor: "#FDF2DF",
  },
  deadlineLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary,
  },
  deadlineValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
    color: brandColors.forest,
  },
  deadlineValueWarning: {
    color: brandColors.ochre,
  },
})
