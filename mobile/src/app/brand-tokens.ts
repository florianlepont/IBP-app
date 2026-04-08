export const brandColors = {
  terracotta: "#CD5833",
  moss: "#89A33A",
  forest: "#334E2B",
  sage: "#B0C78E",
  mauve: "#9494B0",
  ochre: "#CC701F",
  salmon: "#DA8D77",
  black: "#000000",
  white: "#FFFFFF",
  canvas: "#EEF1E8",
  panel: "#F7F6F0",
  surfaceSoft: "#F0EEE4",
  panelMuted: "#E8E5D9",
  warningSoft: "#F7E6CA",
  inputFill: "#F2F0E8",
  inputBorder: "#D6D1C3",
  divider: "#D3D7C8",
  textPrimary: "#24311F",
  textSecondary: "#51604B",
  successSoft: "#E6ECCE",
  errorSoft: "#F3D3C8",
} as const

// The official charter typography is documented here even though the custom
// font files are not loaded in the app yet. Runtime styles still rely on
// system fonts until the assets are added and wired through Expo.
export const brandFontFamilies = {
  title: {
    preferred: "Mazzard H",
    fallback: "Avenir Next / system-ui",
  },
  body: {
    preferred: "Mazzard H",
    fallback: "Avenir Next / system-ui",
  },
  meta: {
    preferred: "Futura",
    fallback: "Avenir Next / system-ui",
  },
  accent: {
    preferred: "HeadTurn Smooth",
    fallback: "Mazzard H Bold",
  },
} as const

// These typography tokens keep the intended hierarchy while relying on
// the current platform font stack.
export const brandTypography = {
  heroEyebrow: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800" as const,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900" as const,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500" as const,
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "900" as const,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500" as const,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800" as const,
    letterSpacing: 0.2,
  },
  input: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600" as const,
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800" as const,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
  },
} as const

export const brandRadius = {
  panel: 30,
  card: 24,
  field: 18,
  avatar: 20,
  pill: 999,
} as const

export const brandSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
} as const

export const brandShadow = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const

export const brandSemanticColors = {
  backgroundCanvas: brandColors.canvas,
  surfaceBase: brandColors.panel,
  surfaceElevated: brandColors.white,
  surfaceSoft: brandColors.surfaceSoft,
  textPrimary: brandColors.textPrimary,
  textSecondary: brandColors.textSecondary,
  textStrong: brandColors.forest,
  ctaPrimary: brandColors.forest,
  ctaAccent: brandColors.moss,
  ctaSecondaryOutline: brandColors.forest,
  ctaDanger: brandColors.terracotta,
  successSurface: brandColors.successSoft,
  errorSurface: brandColors.errorSoft,
  warningSurface: brandColors.warningSoft,
  // Warm off-white for body text on dark (forest) backgrounds — reduces glare vs pure white
  heroBodyOnDark: "#E8ECD9",
} as const

export const brandComponentTokens = {
  button: {
    minHeight: 44,
    minHeightSmall: 36,
    minHeightLarge: 50,
    horizontalPaddingSmall: 10,
    horizontalPadding: 16,
    horizontalPaddingLarge: 14,
    iconOnlySizeSmall: 34,
    iconOnlySize: 40,
    iconOnlySizeLarge: 46,
    primaryBackground: brandSemanticColors.ctaPrimary,
    secondaryBackground: brandSemanticColors.surfaceElevated,
    secondaryBorder: brandSemanticColors.ctaSecondaryOutline,
    dangerBackground: brandSemanticColors.ctaDanger,
  },
  card: {
    defaultPadding: brandSpacing.md,
    compactPadding: 12,
    surfaceBorder: brandColors.panelMuted,
    softSurface: brandSemanticColors.surfaceSoft,
    panelBorder: brandColors.divider,
  },
  field: {
    minHeight: 48,
    horizontalPadding: brandSpacing.md,
    verticalPadding: 10,
    gap: brandSpacing.sm - 2,
    background: brandColors.inputFill,
    border: brandColors.inputBorder,
    borderError: brandColors.terracotta,
  },
  statusChip: {
    neutralBorder: brandColors.divider,
    neutralBackground: brandColors.panelMuted,
    successBorder: "#BBD09B",
    successBackground: brandColors.successSoft,
    warningBorder: "#E7C281",
    warningBackground: brandColors.warningSoft,
    dangerBorder: "#E4A595",
    dangerBackground: brandColors.errorSoft,
    textColor: brandColors.forest,
  },
  choiceChip: {
    border: brandColors.inputBorder,
    background: brandColors.panelMuted,
    interactiveBorder: brandColors.forest,
    interactiveBackground: brandColors.white,
    activeBorder: brandColors.forest,
    activeBackground: brandColors.forest,
    text: brandColors.forest,
    activeText: brandColors.white,
    staticText: brandColors.textSecondary,
    successBackground: brandColors.successSoft,
    warningBackground: brandColors.warningSoft,
    dangerBackground: brandColors.errorSoft,
  },
  notice: {
    infoBackground: brandColors.panelMuted,
    infoBorder: brandColors.divider,
    successBackground: brandColors.successSoft,
    successBorder: "#BBD09B",
    warningBackground: brandColors.warningSoft,
    warningBorder: "#E7C281",
    dangerBackground: brandColors.errorSoft,
    dangerBorder: "#E4A595",
    title: brandColors.textPrimary,
    text: brandColors.textSecondary,
    warningText: brandColors.ochre,
    dangerText: brandColors.terracotta,
    successText: brandColors.forest,
  },
} as const
