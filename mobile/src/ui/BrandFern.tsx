/**
 * BrandFern — decorative fern motif from the Etats Sauvages brand charter.
 * Renders a stylized botanical fern in tone-on-tone (moss/sage on dark, or
 * sage/forest on light backgrounds). Non-interactive, purely decorative.
 */
import { G, Path, Svg } from "react-native-svg"

type BrandFernProps = {
  /** Overall size (viewBox is square). Default 120. */
  size?: number
  /** Fill color for the fronds. Default: moss at low opacity. */
  color?: string
  /** Opacity applied to the whole fern. Default 0.22. */
  opacity?: number
}

export function BrandFern({ size = 120, color = "#89A33A", opacity = 0.22 }: BrandFernProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" opacity={opacity}>
      <G fill={color}>
        {/* Central stem */}
        <Path d="M60 110 Q58 80 56 50 Q57 45 60 42 Q63 45 64 50 Q62 80 60 110Z" />

        {/* Frond pair 1 — large, near base */}
        <Path d="M60 95 Q40 88 28 74 Q32 70 38 72 Q48 78 58 88Z" />
        <Path d="M60 95 Q80 88 92 74 Q88 70 82 72 Q72 78 62 88Z" />

        {/* Frond pair 2 */}
        <Path d="M59 80 Q38 72 26 56 Q31 53 37 56 Q48 64 57 74Z" />
        <Path d="M61 80 Q82 72 94 56 Q89 53 83 56 Q72 64 63 74Z" />

        {/* Frond pair 3 */}
        <Path d="M58 65 Q40 57 30 42 Q35 39 41 43 Q50 52 56 61Z" />
        <Path d="M62 65 Q80 57 90 42 Q85 39 79 43 Q70 52 64 61Z" />

        {/* Frond pair 4 — smaller, near tip */}
        <Path d="M58 52 Q44 44 38 32 Q43 30 47 34 Q53 43 57 49Z" />
        <Path d="M62 52 Q76 44 82 32 Q77 30 73 34 Q67 43 63 49Z" />

        {/* Tip fronds */}
        <Path d="M59 42 Q50 34 48 24 Q53 23 56 28 Q58 35 60 40Z" />
        <Path d="M61 42 Q70 34 72 24 Q67 23 64 28 Q62 35 60 40Z" />
      </G>
    </Svg>
  )
}
