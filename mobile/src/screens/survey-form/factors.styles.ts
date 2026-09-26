import { StyleSheet } from "react-native"
import { brandColors, brandShadow, brandTypography } from "../../app/brand-tokens"

export const factorStyles = StyleSheet.create({
  scoreHeroCard: {
    borderRadius: 28,
    backgroundColor: brandColors.white,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 4,
    ...brandShadow.card,
  },
  scoreHeroLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary,
  },
  scoreHeroValue: {
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "900",
    color: brandColors.forest,
  },
  scoreHeroMeta: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  factorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  factorTile: {
    width: "30.5%",
    minWidth: 92,
    flexGrow: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    borderWidth: 1,
  },
  factorTilePending: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
  },
  factorTileComplete: {
    borderColor: brandColors.moss,
    backgroundColor: brandColors.successSoft,
  },
  factorTileWarning: {
    borderColor: brandColors.terracotta,
    backgroundColor: "#F9E5DF",
  },
  factorTileTopRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
    alignItems: "center",
  },
  factorTileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  factorBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.forest,
  },
  factorBadgeText: {
    ...brandTypography.label,
    fontSize: 11,
    lineHeight: 12,
    color: brandColors.white,
  },
  factorIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  factorTileTitle: {
    ...brandTypography.label,
    fontSize: 11,
    lineHeight: 13,
    color: brandColors.textPrimary,
  },
  factorTileMeta: {
    ...brandTypography.meta,
    fontSize: 10,
    lineHeight: 12,
    color: brandColors.textSecondary,
  },
  factorTileState: {
    ...brandTypography.meta,
    fontSize: 10,
    lineHeight: 12,
    color: brandColors.forest,
  },
})
