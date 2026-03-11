export const brandColors = {
  terracotta: '#CD5833',
  moss: '#89A33A',
  forest: '#334E2B',
  sage: '#B0C78E',
  mauve: '#9494B0',
  ochre: '#CC701F',
  salmon: '#DA8D77',
  black: '#000000',
  white: '#FFFFFF',
  canvas: '#EEF1E8',
  panel: '#F7F6F0',
  panelMuted: '#E8E5D9',
  inputFill: '#F2F0E8',
  inputBorder: '#D6D1C3',
  divider: '#D3D7C8',
  textPrimary: '#24311F',
  textSecondary: '#51604B',
  successSoft: '#E6ECCE',
  errorSoft: '#F3D3C8'
} as const;

// Custom fonts from the charter are not loaded in the app yet.
// These typography tokens keep the intended hierarchy while relying on
// the platform system font as the current fallback.
export const brandTypography = {
  heroEyebrow: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800' as const,
    letterSpacing: 1.2
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900' as const
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500' as const
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '900' as const
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.2
  },
  input: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const
  },
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800' as const
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const
  }
} as const;

export const brandRadius = {
  panel: 30,
  card: 24,
  field: 18,
  pill: 999
} as const;

export const brandSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28
} as const;

export const brandShadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  }
} as const;
