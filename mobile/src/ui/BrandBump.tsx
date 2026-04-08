/**
 * BrandBump — signature bump curve from the Etats Sauvages brand charter.
 * "Always placed at the bottom of a visual/container, never centered,
 *  min 40% width." Renders as an upward-arch SVG path.
 */
import { Path, Svg } from "react-native-svg"

type BrandBumpProps = {
  width: number
  /** Height of the bump arc. Default 20. */
  height?: number
  color?: string
  opacity?: number
}

export function BrandBump({ width, height = 20, color = "#89A33A", opacity = 0.18 }: BrandBumpProps) {
  // Bump occupies right 60% of the container, never centered — per charter
  const startX = width * 0.38
  const endX = width
  const midX = (startX + endX) / 2

  return (
    <Svg width={width} height={height} style={{ position: "absolute", bottom: 0, left: 0 }}>
      <Path
        d={`M${startX} ${height} Q${midX} 0 ${endX} ${height} Z`}
        fill={color}
        opacity={opacity}
      />
    </Svg>
  )
}
