import { StyleSheet } from "react-native"
import { brandColors, brandTypography } from "../../app/brand-tokens"

export const PAGE_CONTENT_GAP = 10

// Screen-level styles and the few keys several survey list parts share.
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: PAGE_CONTENT_GAP, // P3-COMPACT-03: 14 → 10
  },
  pageContentNativeSearch: {
    paddingTop: 8,
  },

  // ── Section headers ───────────────────────────────────────────────────────
  homeSectionTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 24,
    lineHeight: 28,
  },
  homeSectionSubtitle: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  listSectionHeader: {
    paddingHorizontal: 2,
  },

  // ── Shared interaction ────────────────────────────────────────────────────
  rowPressed: {
    opacity: 0.88,
  },
  resetButton: {
    alignSelf: "flex-start",
  },
})
