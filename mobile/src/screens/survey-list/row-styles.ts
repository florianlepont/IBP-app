import { StyleSheet } from "react-native"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandShadow,
  brandTypography,
} from "../../app/brand-tokens"

// Survey list row styles (01.9-22), moved from SurveyListScreen.
export const rowStyles = StyleSheet.create({
  surveyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    padding: 10, // P2-COMPACT-01: 12 → 10
    ...brandShadow.card,
  },
  surveySwipeable: {
    overflow: "visible",
  },
  surveyDeleteAction: {
    width: 124,
    alignSelf: "stretch",
    marginRight: 8,
    borderRadius: brandRadius.card,
    backgroundColor: brandColors.terracotta,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  surveyDeleteActionPressed: {
    opacity: 0.88,
  },
  surveyDeleteActionText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  surveyCardSelected: {
    borderColor: brandComponentTokens.surveyList.cardSelectedBorder,
    backgroundColor: brandComponentTokens.surveyList.cardSelectedBackground,
  },
  surveyCardAccent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: brandComponentTokens.surveyList.cardAccentNeutral,
  },
  surveyCardAccentSuccess: {
    backgroundColor: brandComponentTokens.surveyList.cardAccentSuccess,
  },
  surveyCardAccentWarning: {
    backgroundColor: brandComponentTokens.surveyList.cardAccentWarning,
  },
  surveyCardAccentDanger: {
    backgroundColor: brandComponentTokens.surveyList.cardAccentDanger,
  },
  surveyCardAccentNeutral: {
    backgroundColor: "transparent",
  },
  // P2-COMPACT-01: reduced thumbnail size
  surveyCardMedia: {
    width: 56,
    height: 72,
  },
  surveyCardPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: brandColors.panelMuted,
  },
  surveyCardPreviewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  surveyCardContent: {
    flex: 1,
    gap: 5,
  },
  surveyCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  surveyCardTitle: {
    flex: 1,
    ...brandTypography.input,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "800",
    color: brandColors.textPrimary,
  },
  surveyCardSelectedIcon: {
    marginTop: 2,
  },
  // Status + date on same row
  surveyCardStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  surveyCardMeta: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 14,
    color: brandColors.textSecondary,
  },
  surveyCardSupport: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 14,
    color: brandComponentTokens.surveyList.supportDangerText,
  },
  surveyCardPressed: {
    backgroundColor: brandColors.surfaceSoft,
  },
  badgeTextDanger: {
    color: brandComponentTokens.surveyList.badgeDangerText,
  },
})
