import { memo, useCallback } from "react"
import { Marker, type LatLng } from "react-native-maps"
import { fr } from "../../i18n"
import { markerColors } from "./styles"

export type SurveyMarkerProps = {
  id: string
  coordinate: LatLng
  ibpTotal: number
  selected: boolean
  onSelect: (id: string) => void
}

function SurveyMarkerBase({ id, coordinate, ibpTotal, selected, onSelect }: SurveyMarkerProps) {
  const handlePress = useCallback(() => onSelect(id), [id, onSelect])
  return (
    <Marker
      coordinate={coordinate}
      onPress={handlePress}
      pinColor={selected ? markerColors.selected : markerColors.survey}
      accessibilityLabel={fr.publicMap.a11y.surveyMarker(ibpTotal)}
      zIndex={selected ? 3 : 2}
    />
  )
}

/** Equal props, with the coordinate compared by value: the cluster list rebuilds it per region. */
function sameMarkerProps(prev: SurveyMarkerProps, next: SurveyMarkerProps): boolean {
  return (
    prev.id === next.id &&
    prev.ibpTotal === next.ibpTotal &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect &&
    prev.coordinate.latitude === next.coordinate.latitude &&
    prev.coordinate.longitude === next.coordinate.longitude
  )
}

/** One public survey on the map (D-05): memoised, and the press reports the id. */
export const SurveyMarker = memo(SurveyMarkerBase, sameMarkerProps)
