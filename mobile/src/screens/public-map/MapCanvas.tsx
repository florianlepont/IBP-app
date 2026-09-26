import { memo, useMemo, type RefObject } from "react"
import MapView, { Marker, type Details, type LatLng, type Region } from "react-native-maps"
import type { PublicMapItem, PublicParcelStatusItem } from "../../app/types"
import { IgnCadastreTileOverlay } from "../../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../../components/ParcelOverlayPolygons"
import { fr } from "../../i18n"
import { useLatestCallback } from "../../state/useLatestCallback"
import { ClusterMarker } from "./ClusterMarker"
import { markerColors, screenStyles } from "./styles"
import { SurveyMarker } from "./SurveyMarker"
import { useMapClusters } from "./useMapClusters"
import { DEFAULT_MAP_REGION, regionForZoom } from "./useMapViewport"

const NO_PARCELS: PublicParcelStatusItem[] = []

export type MapCanvasProps = {
  mapRef: RefObject<MapView | null>
  items: PublicMapItem[]
  region: Region
  selectedId: string | null
  parcelStatuses: PublicParcelStatusItem[]
  parcelLayerRenderable: boolean
  currentLocation: LatLng | null
  onRegionChangeComplete: (region: Region, details?: Details) => void
  onSelectSurvey: (id: string) => void
  onZoomTo: (region: Region) => void
  onOpenClusterList: (items: PublicMapItem[]) => void
}

/**
 * The map itself (D-05): the clusters of the current region, memoised markers
 * whose presses report ids, the cadastre overlay and the device position.
 * A cluster press zooms to where it splits, or lists its surveys when it
 * cannot split (Pitfall 7).
 */
export const MapCanvas = memo(function MapCanvas({
  mapRef,
  items,
  region,
  selectedId,
  parcelStatuses,
  parcelLayerRenderable,
  currentLocation,
  onRegionChangeComplete,
  onSelectSurvey,
  onZoomTo,
  onOpenClusterList,
}: MapCanvasProps) {
  const { clusters, resolveClusterPress } = useMapClusters({ items, region })

  const clusterCenters = useMemo(() => {
    const centers = new Map<number, LatLng>()
    for (const entry of clusters) {
      if (entry.kind === "cluster") {
        centers.set(entry.clusterId, { latitude: entry.latitude, longitude: entry.longitude })
      }
    }
    return centers
  }, [clusters])

  const handleClusterPress = useLatestCallback((clusterId: number) => {
    const target = resolveClusterPress(clusterId)
    if (target.kind === "leaves") {
      onOpenClusterList(target.items)
      return
    }
    const center = clusterCenters.get(clusterId)
    if (center) {
      onZoomTo(regionForZoom(center, target.zoom, region))
    }
  })

  return (
    <MapView
      ref={mapRef}
      style={screenStyles.map}
      initialRegion={DEFAULT_MAP_REGION}
      onRegionChangeComplete={onRegionChangeComplete}
    >
      <IgnCadastreTileOverlay enabled={parcelLayerRenderable} zIndex={0} />
      <ParcelOverlayPolygons items={parcelLayerRenderable ? parcelStatuses : NO_PARCELS} />
      {currentLocation ? (
        <Marker
          coordinate={currentLocation}
          pinColor={markerColors.currentPosition}
          title={fr.publicMap.currentPosition}
          zIndex={3}
        />
      ) : null}
      {clusters.map((entry) =>
        entry.kind === "cluster" ? (
          <ClusterMarker
            // The count is part of the key: the custom view is not redrawn (tracksViewChanges false).
            key={`${entry.key}-${entry.count}`}
            clusterId={entry.clusterId}
            coordinate={{ latitude: entry.latitude, longitude: entry.longitude }}
            count={entry.count}
            onPress={handleClusterPress}
          />
        ) : (
          <SurveyMarker
            key={entry.key}
            id={entry.item.survey_id}
            coordinate={{ latitude: entry.latitude, longitude: entry.longitude }}
            ibpTotal={entry.item.ibp_total}
            selected={entry.item.survey_id === selectedId}
            onSelect={onSelectSurvey}
          />
        ),
      )}
    </MapView>
  )
})
