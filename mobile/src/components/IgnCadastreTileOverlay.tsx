import { UrlTile } from "react-native-maps"

type IgnCadastreTileOverlayProps = {
  enabled: boolean
  zIndex?: number
  opacity?: number
}

// Official IGN Geoplateforme cadastre tiles (same data family as Geoportail).
const IGN_CADASTRE_WMTS_URL_TEMPLATE =
  "https://data.geopf.fr/tms/1.0.0/CADASTRALPARCELS.PARCELS/{z}/{x}/{y}.png"

export function IgnCadastreTileOverlay({
  enabled,
  zIndex = 0,
  opacity = 0.9,
}: IgnCadastreTileOverlayProps) {
  if (!enabled) {
    return null
  }

  return (
    <UrlTile
      urlTemplate={IGN_CADASTRE_WMTS_URL_TEMPLATE}
      minimumZ={15}
      maximumZ={20}
      tileSize={256}
      zIndex={zIndex}
      opacity={opacity}
      flipY={false}
    />
  )
}
