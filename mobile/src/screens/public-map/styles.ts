import { StyleSheet } from "react-native"
import { brandColors, brandRadius, brandShadow, brandTypography } from "../../app/brand-tokens"

// Pin colours of the public map markers.
export const markerColors = {
  survey: "#2a7a52",
  selected: brandColors.terracotta,
  currentPosition: "#245f96",
} as const

const PANEL_BACKGROUND = "rgba(247, 246, 240, 0.96)"

const roundButton = {
  width: 42,
  height: 42,
  borderRadius: 21,
  borderWidth: 1,
  alignItems: "center",
  justifyContent: "center",
  ...brandShadow.card,
} as const

export const markerStyles = StyleSheet.create({
  clusterBubble: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: brandColors.white,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    ...brandShadow.card,
  },
  clusterText: {
    ...brandTypography.label,
    color: brandColors.white,
  },
})

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
})

export const controlStyles = StyleSheet.create({
  overlayShell: {
    position: "absolute",
    left: 12,
    right: 12,
    gap: 10,
  },
  topDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  topDockLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  topDockActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exploreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(247, 246, 240, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...brandShadow.card,
  },
  exploreBadgeText: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  countBadge: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(232, 229, 217, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countBadgeText: {
    ...brandTypography.meta,
    color: brandColors.textPrimary,
  },
  iconButton: {
    ...roundButton,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(247, 246, 240, 0.94)",
  },
  iconButtonPrimary: {
    ...roundButton,
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
  iconButtonDisabled: {
    ...roundButton,
    borderColor: brandColors.divider,
    backgroundColor: "#93A68A",
  },
  filtersPanel: {
    backgroundColor: PANEL_BACKGROUND,
    gap: 12,
  },
  filtersTitle: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  filtersMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  layerTogglePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  layerTogglePillOn: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
  layerTogglePillOff: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
  },
  layerTogglePillText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  layerTogglePillTextOn: {
    color: brandColors.white,
  },
  filtersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterFieldHalf: {
    flexGrow: 1,
    flexBasis: "48%",
    gap: 5,
  },
  filterFieldFull: {
    width: "100%",
    gap: 5,
  },
  inputLabel: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  input: {
    ...brandTypography.input,
  },
  refreshButton: {
    width: "100%",
  },
  refreshButtonDisabled: {
    backgroundColor: "#8FA188",
    borderColor: "#8FA188",
  },
  bottomDock: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  emptyDockBubble: {
    flex: 1,
    backgroundColor: PANEL_BACKGROUND,
  },
  emptyDockText: {
    ...brandTypography.meta,
    fontSize: 15,
    lineHeight: 18,
    color: brandColors.textPrimary,
  },
  locateButton: {
    ...roundButton,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
})

export const panelStyles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: "rgba(247, 246, 240, 0.98)",
    gap: 10,
  },
  title: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  meta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  reportOpenButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E4B99A",
    backgroundColor: "#F6E2D5",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reportOpenButtonText: {
    ...brandTypography.meta,
    color: brandColors.terracotta,
  },
  reportForm: {
    gap: 10,
  },
  reportField: {
    gap: 5,
  },
  reportInputLabel: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  reportInput: {
    minHeight: 72,
    textAlignVertical: "top",
    ...brandTypography.sectionBody,
  },
  reportActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  reportCancelButtonText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  reportSubmitButtonDisabled: {
    borderColor: "#A6ABA3",
    backgroundColor: "#A6ABA3",
  },
  reportSubmitButtonText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  clusterList: {
    maxHeight: 260,
  },
  clusterRow: {
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  clusterRowText: {
    ...brandTypography.meta,
    color: brandColors.textPrimary,
  },
})
