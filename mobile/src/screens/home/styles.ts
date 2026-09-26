import { Platform, StyleSheet } from "react-native"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandSpacing,
  brandTypography,
} from "../../app/brand-tokens"

const PAGE_H = 20

export const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  content: {
    gap: 0,
  },

  // Greeting
  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: PAGE_H,
    marginBottom: 16,
  },
  greetingTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: brandColors.forest,
    lineHeight: 32,
  },
  greetingDate: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    marginTop: 2,
    textTransform: "capitalize",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.panelMuted,
    alignItems: "center",
    justifyContent: "center",
  },

  // Notice
  notice: {
    marginHorizontal: PAGE_H,
    marginBottom: 16,
  },

  // Hero CTA
  heroCta: {
    marginHorizontal: PAGE_H,
    backgroundColor: brandColors.forest,
    borderRadius: brandRadius.card,
    padding: 24,
    paddingBottom: 28,
    gap: 8,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
    }),
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: brandColors.moss,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: brandColors.canvas,
    lineHeight: 30,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    color: brandSemanticColors.heroBodyOnDark,
    marginBottom: 4,
  },
  heroButton: {
    backgroundColor: brandColors.moss,
    marginTop: 4,
  },
  heroButtonLabel: {
    color: brandColors.canvas,
  },

  // Sections
  section: {
    marginTop: brandSpacing.xl + 4,
  },
  sectionHeader: {
    paddingHorizontal: PAGE_H,
    marginBottom: 14,
  },
  trailingLink: {
    ...brandTypography.label,
    color: brandColors.moss,
  },

  // Drafts
  draftsScroll: {
    paddingHorizontal: PAGE_H,
    gap: 12,
  },

  // Parcels
  parcelsList: {
    paddingHorizontal: PAGE_H,
    gap: 10,
  },
  loadingRow: {
    paddingHorizontal: PAGE_H,
    gap: 10,
  },
  skeletonCard: {
    height: 72,
    borderRadius: brandRadius.card,
    backgroundColor: brandColors.panelMuted,
  },

  // Sector score card
  sectorCard: {
    backgroundColor: brandSemanticColors.surfaceSoft,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  sectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectorLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: brandColors.forest,
    textTransform: "uppercase",
    flex: 1,
  },
  sectorScore: {
    fontSize: 22,
    fontWeight: "900",
    color: brandColors.forest,
  },
  scoreDotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  scoreDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  sectorMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
})
