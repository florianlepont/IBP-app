import { StyleSheet } from "react-native"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandSpacing,
  brandTypography,
} from "../../app/brand-tokens"

export const accountStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.canvas,
  },
  // ACC-N02 : gap inter-sections avec brandSpacing.md pour une meilleure respiration
  content: {
    gap: brandSpacing.md,
    paddingBottom: brandSpacing.xl,
  },
  // ACC-10 : Logout en bas, style discret
  logoutButton: {
    marginTop: brandSpacing.xs,
  },
})

export const identityStyles = StyleSheet.create({
  identityCard: {
    gap: 0,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: brandSpacing.sm + 2,
  },
  avatarButton: {
    width: 72,
    height: 72,
    borderRadius: brandRadius.avatar,
    overflow: "visible",
    flexShrink: 0,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: brandRadius.avatar,
    borderWidth: 2,
    borderColor: brandColors.canvas,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: brandRadius.avatar,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
    borderWidth: 2,
    borderColor: brandColors.canvas,
  },
  avatarFallbackText: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: brandColors.forest,
  },
  // ACC-C01 : badge caméra agrandi à 28pt pour une meilleure cible tactile visuelle
  avatarEditBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: brandColors.forest,
    borderWidth: 2,
    borderColor: brandColors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  identityCopy: {
    flex: 1,
    gap: 3,
  },
  identityName: {
    ...brandTypography.sectionTitle,
    fontSize: 18,
    lineHeight: 22,
    // ACC-14 : texte clair sur fond hero forest
    color: brandColors.canvas,
  },
  identityMeta: {
    ...brandTypography.meta,
    // ACC-14 : texte secondaire sur fond forest
    color: brandSemanticColors.heroBodyOnDark,
  },
  identityFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
})

export const profileStyles = StyleSheet.create({
  panel: {
    gap: brandSpacing.xs + 2,
  },
  panelHeader: {
    marginBottom: brandSpacing.xs - 2,
  },
  panelTitle: {
    fontSize: 17,
    lineHeight: 20,
  },
  twoColumnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: brandSpacing.sm,
  },
  halfField: {
    flex: 1,
    minWidth: 120,
  },
  // ACC-12 : styles de champ directement sur AppField (sans wrapper ProfileField)
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  fieldInput: {
    paddingHorizontal: 14,
    paddingVertical: brandSpacing.sm,
  },
  emailEditBlock: {
    gap: brandSpacing.xs + 2,
  },
  emailEditActions: {
    flexDirection: "row",
    gap: brandSpacing.xs + 2,
    justifyContent: "flex-end",
  },
})
