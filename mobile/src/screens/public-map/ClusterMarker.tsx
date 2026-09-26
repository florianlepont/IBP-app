import { memo, useCallback } from "react"
import { Text, View } from "react-native"
import { Marker, type LatLng } from "react-native-maps"
import { fr } from "../../i18n"
import { markerStyles } from "./styles"

export type ClusterMarkerProps = {
  clusterId: number
  coordinate: LatLng
  count: number
  onPress: (clusterId: number) => void
}

function ClusterMarkerBase({ clusterId, coordinate, count, onPress }: ClusterMarkerProps) {
  const handlePress = useCallback(() => onPress(clusterId), [clusterId, onPress])
  return (
    <Marker
      coordinate={coordinate}
      onPress={handlePress}
      // The bubble never changes once drawn: no per-frame snapshot of the custom view.
      tracksViewChanges={false}
      accessibilityLabel={fr.publicMap.a11y.cluster(count)}
      zIndex={2}
    >
      <View style={markerStyles.clusterBubble}>
        <Text style={markerStyles.clusterText}>{fr.publicMap.cluster.count(count)}</Text>
      </View>
    </Marker>
  )
}

function sameClusterProps(prev: ClusterMarkerProps, next: ClusterMarkerProps): boolean {
  return (
    prev.clusterId === next.clusterId &&
    prev.count === next.count &&
    prev.onPress === next.onPress &&
    prev.coordinate.latitude === next.coordinate.latitude &&
    prev.coordinate.longitude === next.coordinate.longitude
  )
}

/** A group of public surveys (D-05): memoised, and the press reports the cluster id. */
export const ClusterMarker = memo(ClusterMarkerBase, sameClusterProps)
