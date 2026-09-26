import { StyleSheet } from "react-native"
import { brandColors, brandRadius, brandShadow, brandTypography } from "../../app/brand-tokens"

export const styles = StyleSheet.create({
  detailHeroShell: {
    position: "relative",
    minHeight: 320,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "#132434",
    ...brandShadow.card,
  },
  detailHeroMain: {
    width: "100%",
    height: 320,
    backgroundColor: "#132434",
  },
  detailHeroMap: {
    width: "100%",
    height: "100%",
    backgroundColor: "#132434",
  },
  detailHeroPhotoCarousel: {
    width: "100%",
    height: "100%",
  },
  detailHeroPhotoSlide: {
    height: "100%",
  },
  detailHeroPhotoImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#132434",
  },
  detailHeroOverlayBadge: {
    position: "absolute",
    left: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(8, 13, 19, 0.72)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailHeroOverlayBadgeText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  detailHeroSwitchThumb: {
    position: "absolute",
    left: 14,
    top: 14,
    width: 78,
    height: 78,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "#132434",
  },
  detailHeroSwitchThumbImage: {
    width: "100%",
    height: "100%",
  },
  detailHeroSwitchThumbMap: {
    width: "100%",
    height: "100%",
  },
  detailHeroSwitchThumbLabel: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(8, 13, 19, 0.72)",
    paddingVertical: 4,
  },
  detailHeroSwitchThumbLabelText: {
    ...brandTypography.meta,
    color: brandColors.white,
    textAlign: "center",
  },
  detailHeroActions: {
    position: "absolute",
    top: 14,
    right: 14,
    gap: 8,
  },
  detailHeroActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(8, 13, 19, 0.72)",
  },
  detailHeroActionButtonDanger: {
    backgroundColor: "rgba(129, 31, 31, 0.84)",
    borderColor: "rgba(255, 210, 210, 0.42)",
  },
})
