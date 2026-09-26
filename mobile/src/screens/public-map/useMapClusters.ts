import { useCallback, useMemo } from "react"
import type { Region } from "react-native-maps"
import Supercluster from "supercluster"
import type { PointFeature } from "supercluster"
import { computeRegionZoom } from "../../app/map-viewport"
import type { PublicMapItem } from "../../app/types"

// Clustering choices (D-05, Claude's discretion): 60 px radius, clusters up to zoom 16.
export const CLUSTER_RADIUS = 60
export const CLUSTER_MAX_ZOOM = 16

type ItemProperties = { item: PublicMapItem }

export type MapClusterEntry =
  | {
      kind: "cluster"
      key: string
      clusterId: number
      count: number
      latitude: number
      longitude: number
    }
  | {
      kind: "item"
      key: string
      item: PublicMapItem
      latitude: number
      longitude: number
    }

/** What a cluster tap should do: zoom in, or list its surveys when zooming cannot split it. */
export type ClusterPressTarget =
  | { kind: "zoom"; zoom: number }
  | { kind: "leaves"; items: PublicMapItem[] }

function toPointFeature(item: PublicMapItem): PointFeature<ItemProperties> {
  return {
    type: "Feature",
    properties: { item },
    geometry: {
      type: "Point",
      coordinates: [item.display_location.lng, item.display_location.lat],
    },
  }
}

/** The region as supercluster's [westLng, southLat, eastLng, northLat], clamped to the world. */
export function computeRegionBboxArray(region: Region): [number, number, number, number] {
  const halfLat = region.latitudeDelta / 2
  const halfLng = region.longitudeDelta / 2
  return [
    Math.max(-180, region.longitude - halfLng),
    Math.max(-90, region.latitude - halfLat),
    Math.min(180, region.longitude + halfLng),
    Math.min(90, region.latitude + halfLat),
  ]
}

/**
 * The zoom used to query clusters. It is capped at CLUSTER_MAX_ZOOM so surveys
 * sharing a rounded display location (Pitfall 7) stay one tappable cluster
 * instead of stacked, unreachable markers.
 */
export function computeClusterZoom(region: Region): number {
  return Math.min(CLUSTER_MAX_ZOOM, Math.max(0, Math.floor(computeRegionZoom(region))))
}

type UseMapClustersArgs = {
  items: PublicMapItem[]
  region: Region
}

/**
 * Supercluster index and the clusters of the current region (D-05). The index
 * is built once per `items` array; a region change only re-queries it.
 */
export function useMapClusters({ items, region }: UseMapClustersArgs) {
  const index = useMemo(() => {
    const cluster = new Supercluster<ItemProperties>({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
    })
    cluster.load(items.map(toPointFeature))
    return cluster
  }, [items])

  const clusters = useMemo<MapClusterEntry[]>(
    () =>
      index
        .getClusters(computeRegionBboxArray(region), computeClusterZoom(region))
        .map((feature) => {
          const [longitude, latitude] = feature.geometry.coordinates as [number, number]
          const properties = feature.properties
          if ("cluster" in properties && properties.cluster) {
            return {
              kind: "cluster",
              key: `cluster-${properties.cluster_id}`,
              clusterId: properties.cluster_id,
              count: properties.point_count,
              latitude,
              longitude,
            }
          }
          // A single point keeps its exact display location (the index projects coordinates).
          const { item } = properties as ItemProperties
          return {
            kind: "item",
            key: `item-${item.survey_id}`,
            item,
            latitude: item.display_location.lat,
            longitude: item.display_location.lng,
          }
        }),
    [index, region],
  )

  const expansionZoom = useCallback(
    (clusterId: number): number => index.getClusterExpansionZoom(clusterId),
    [index],
  )

  const leaves = useCallback(
    (clusterId: number): PublicMapItem[] =>
      index.getLeaves(clusterId, Infinity).map((feature) => feature.properties.item),
    [index],
  )

  const resolveClusterPress = useCallback(
    (clusterId: number): ClusterPressTarget => {
      const zoom = expansionZoom(clusterId)
      if (zoom > CLUSTER_MAX_ZOOM) {
        return { kind: "leaves", items: leaves(clusterId) }
      }
      return { kind: "zoom", zoom }
    },
    [expansionZoom, leaves],
  )

  return { clusters, expansionZoom, leaves, resolveClusterPress }
}
