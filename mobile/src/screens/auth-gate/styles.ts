import { StyleSheet } from "react-native"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../../app/brand-tokens"

// Hero layout, shared by the hero and the panel that overlaps it.
export const HERO_MIN_HEIGHT_RATIO = 0.44
export const HERO_MIN_HEIGHT_PX = 260
const HERO_LOGO_SIZE = 54
const HERO_MARTEN_WIDTH = 92
const HERO_MARTEN_HEIGHT = 207
const HERO_MARTEN_RIGHT = 34
const HERO_MARTEN_BOTTOM = 28
const HERO_FERNS_WIDTH = 485
const HERO_FERNS_HEIGHT = 400
const HERO_FERNS_RIGHT = HERO_MARTEN_RIGHT + HERO_MARTEN_WIDTH / 2 - HERO_FERNS_WIDTH / 2
const HERO_FERNS_BOTTOM = -Math.round(HERO_FERNS_HEIGHT * 0.3)
export const PANEL_OVERLAP = 30

export const authStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  hero: {
    width: "100%",
  },
  heroBackground: {
    flex: 1,
    backgroundColor: brandColors.forest,
    overflow: "hidden",
    paddingHorizontal: brandSpacing.lg,
  },
  heroContentWrapper: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  logoBlobContainer: {
    width: HERO_LOGO_SIZE,
    height: HERO_LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
  },
  heroBlob: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0E2210",
  },
  heroBlob1: {
    borderTopLeftRadius: 55,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 60,
  },
  heroBlob2: {
    borderTopLeftRadius: 38,
    borderTopRightRadius: 62,
    borderBottomLeftRadius: 58,
    borderBottomRightRadius: 36,
  },
  heroBlob3: {
    borderTopLeftRadius: 48,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 66,
    borderBottomRightRadius: 52,
  },
  heroContent: {
    zIndex: 2,
    alignItems: "flex-start",
    gap: 8,
    marginTop: 24,
  },
  heroLogo: {
    width: HERO_LOGO_SIZE,
    height: HERO_LOGO_SIZE,
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    fontSize: 28,
    lineHeight: 33,
    color: brandSemanticColors.heroBodyOnDark,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    fontSize: 14,
    lineHeight: 20,
    color: brandSemanticColors.heroMetaOnDark,
  },
  heroFerns: {
    position: "absolute",
    right: HERO_FERNS_RIGHT,
    bottom: HERO_FERNS_BOTTOM,
    width: HERO_FERNS_WIDTH,
    height: HERO_FERNS_HEIGHT,
    opacity: 0.52,
    zIndex: 0,
  },
  heroMarten: {
    position: "absolute",
    right: HERO_MARTEN_RIGHT,
    bottom: HERO_MARTEN_BOTTOM,
    width: HERO_MARTEN_WIDTH,
    height: HERO_MARTEN_HEIGHT,
    zIndex: 1,
  },
  panelWrap: {
    ...brandShadow.card,
    flex: 1,
    marginTop: -PANEL_OVERLAP,
    borderTopLeftRadius: brandRadius.panel,
    borderTopRightRadius: brandRadius.panel,
    backgroundColor: brandColors.panel,
    zIndex: 2,
  },
  panelScroll: {
    flex: 1,
  },
  panelContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 44,
    gap: 16,
  },
  panelMain: {
    gap: 14,
  },
  panelHeader: {
    gap: 18,
    marginBottom: 18,
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 25,
    lineHeight: 30,
    color: brandColors.textPrimary,
  },
  panelSubtitle: {
    ...brandTypography.sectionBody,
    fontSize: 14,
    lineHeight: 21,
    color: brandColors.textSecondary,
  },
  actionsGroup: {
    gap: 14,
  },
  primaryButton: {
    marginTop: 2,
    minHeight: 50,
  },
  secondaryButton: {
    minHeight: 44,
  },
  errorBanner: {
    backgroundColor: brandSemanticColors.errorSurface,
    borderRadius: brandRadius.card,
    paddingHorizontal: brandSpacing.md,
    paddingVertical: brandSpacing.sm,
  },
  errorBannerText: {
    ...brandTypography.meta,
    color: brandColors.terracotta,
    lineHeight: 17,
  },
  forgotPasswordLink: {
    alignSelf: "center",
    paddingTop: 0,
    marginTop: -6,
    paddingBottom: 6,
  },
  forgotPasswordText: {
    ...brandTypography.button,
    fontSize: 13,
    lineHeight: 17,
    color: brandColors.forest,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalContainer: {
    alignItems: "center",
    paddingHorizontal: brandSpacing.sm,
    paddingVertical: 6,
    gap: 14,
  },
  legalText: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 16,
    color: brandColors.textSecondary,
    textAlign: "center",
    opacity: 0.9,
  },
  legalLink: {
    fontSize: 11,
    color: brandColors.forest,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  panelFooterGroup: {
    gap: 18,
    marginTop: "auto",
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: brandColors.divider,
  },
})

export const devModalStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: brandSpacing.lg,
    paddingTop: 32,
    backgroundColor: brandColors.canvas,
    gap: brandSpacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: brandSpacing.sm,
  },
  title: {
    ...brandTypography.sectionTitle,
    fontSize: 18,
    color: brandColors.textPrimary,
  },
  hint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
})
