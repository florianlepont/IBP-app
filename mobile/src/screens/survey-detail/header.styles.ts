import { StyleSheet } from "react-native"
import { brandColors, brandRadius, brandShadow, brandTypography } from "../../app/brand-tokens"

export const styles = StyleSheet.create({
  detailHeroStickyWrap: {
    backgroundColor: brandColors.canvas,
  },
  detailHeroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: brandColors.forest,
    padding: 20,
    gap: 12,
    ...brandShadow.card,
  },
  detailHeroCardCompressed: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  detailHeroAccentOrb: {
    position: "absolute",
    top: -24,
    right: -18,
    width: 138,
    height: 138,
    borderRadius: 999,
    backgroundColor: "rgba(176, 199, 142, 0.22)",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  detailHeroCopy: {
    flex: 1,
    gap: 8,
  },
  detailHeroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  detailSurveyTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.white,
  },
  detailHeroMetricCard: {
    minWidth: 116,
    maxWidth: 144,
    borderRadius: 24,
    backgroundColor: "rgba(247, 246, 240, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  detailHeroMetricLabel: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  detailHeroMetricValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: brandColors.white,
  },
  detailHeroMetricMeta: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailHeroCompactCopy: {
    flex: 1,
    gap: 4,
  },
  detailHeroCompactTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 24,
    lineHeight: 27,
    color: brandColors.white,
  },
  detailHeroCompactMeta: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroCompactMetricPill: {
    minWidth: 92,
    borderRadius: brandRadius.card,
    backgroundColor: "rgba(247, 246, 240, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
    gap: 2,
  },
  detailHeroCompactMetricLabel: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroCompactMetricValue: {
    ...brandTypography.label,
    fontSize: 18,
    lineHeight: 21,
    color: brandColors.white,
  },
  detailRenameRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 8,
  },
  detailRenameField: {
    flex: 1,
    minWidth: 200,
  },
  detailRenameLabel: {
    color: "#D7E3C0",
  },
  detailRenameInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.12)",
    color: brandColors.white,
  },
  detailRenameSaveButton: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.sage,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailRenameSaveButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  detailRenameCancelButton: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailRenameCancelButtonText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  detailHeroStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  detailHeroStatusPill: {
    borderRadius: brandRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  detailHeroStatusPillNeutral: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(247, 246, 240, 0.1)",
  },
  detailHeroStatusPillSuccess: {
    borderColor: "rgba(187,208,155,0.28)",
    backgroundColor: "rgba(176,199,142,0.18)",
  },
  detailHeroStatusPillDanger: {
    borderColor: "rgba(228,165,149,0.28)",
    backgroundColor: "rgba(205,88,51,0.14)",
  },
  detailHeroStatusPillText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroMetaText: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroProgressCard: {
    gap: 8,
    borderRadius: 22,
    backgroundColor: "rgba(247, 246, 240, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailHeroProgressCardCompact: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailHeroProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailHeroProgressLabel: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  detailHeroProgressValue: {
    ...brandTypography.label,
    color: brandColors.white,
  },
  detailHeroProgressTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  detailHeroProgressFill: {
    height: "100%",
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.sage,
  },
  detailHeroProgressFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailHeroSubmitCard: {
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(247, 246, 240, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailHeroSubmitCardCompact: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailHeroSubmitCardReady: {
    borderColor: "rgba(208, 226, 182, 0.34)",
    backgroundColor: "rgba(176, 199, 142, 0.18)",
  },
  detailHeroSubmitCardPendingSync: {
    borderColor: "rgba(231, 194, 129, 0.34)",
    backgroundColor: "rgba(204, 112, 31, 0.12)",
  },
  detailHeroSubmitCardBlocked: {
    borderColor: "rgba(228, 165, 149, 0.34)",
    backgroundColor: "rgba(205, 88, 51, 0.12)",
  },
  detailHeroSubmitHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  detailHeroSubmitHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailHeroSubmitTitle: {
    ...brandTypography.label,
    color: brandColors.white,
  },
  detailHeroSubmitBody: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroSubmitPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailHeroSubmitPillText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  detailHeroSubmitButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  detailHeroSubmitButtonCompact: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailHeroSubmitButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
})
