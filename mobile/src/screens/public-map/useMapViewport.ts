import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Details, Region } from "react-native-maps"
import { areRegionsNearlyEqual, computeRegionBbox, computeRegionZoom } from "../../app/map-viewport"
import type { PublicMapItem } from "../../app/types"
import { useDebouncedValue } from "../../hooks/useDebouncedValue"
import type { LoadPublicMapOptions } from "../../hooks/usePublicMapExplorer"
import { useLatestCallback } from "../../state/useLatestCallback"

export const DEFAULT_MAP_REGION: Region = {
  latitude: 46.603354,
  longitude: 1.888334,
  latitudeDelta: 7,
  longitudeDelta: 7,
}

/** Wait after the last region change before loading (D-05). */
export const VIEWPORT_DEBOUNCE_MS = 400
/** The cadastre layer is only drawn and loaded from this zoom. */
export const PARCEL_MIN_ZOOM = 15
const FIT_DURATION_MS = 520

/** The region that frames every item with a margin, or France without items. */
export function computeRegionFromItems(items: PublicMapItem[]): Region {
  let minLat = Number.POSITIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  let minLng = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY

  for (const item of items) {
    const { lat, lng } = item.display_location
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue
    }
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) {
    return DEFAULT_MAP_REGION
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.08, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.08, (maxLng - minLng) * 1.4),
  }
}

/**
 * The region centred on `center` whose zoom (computeRegionZoom) is `zoom`,
 * keeping the aspect of the current region. Used to open a cluster.
 */
export function regionForZoom(
  center: { latitude: number; longitude: number },
  zoom: number,
  current: Region,
): Region {
  const longitudeDelta = 360 / 2 ** zoom
  const aspect = current.longitudeDelta > 0 ? current.latitudeDelta / current.longitudeDelta : 1
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: longitudeDelta * aspect,
    longitudeDelta,
  }
}

export type UseMapViewportArgs = {
  items: PublicMapItem[]
  showParcelLayer: boolean
  loadPublicMap: (options?: LoadPublicMapOptions) => Promise<void>
  loadParcels: (input: { bbox: string; zoom: number }) => Promise<void>
  animateToRegion: (region: Region, durationMs: number) => void
  /** Told the bbox of each viewport load, so a tab-press reload can reuse it. */
  onViewportBboxChange?: (bbox: string) => void
}

/**
 * Viewport-driven loading for the public map (D-05, Pitfall 6).
 *
 * - The region follows onRegionChangeComplete; a region nearly equal to the
 *   current one (the end of a programmatic move) is ignored.
 * - After the region has settled for 400 ms, the items of its bbox are loaded
 *   (usePublicMapExplorer also skips a request equal to the last one), and the
 *   cadastre parcels when the layer is shown at zoom 15+.
 * - The camera fits the items only after the first load and after an explicit
 *   filter apply, never after a viewport load: fitting after every load would
 *   move the camera, change the bbox and load again, forever.
 */
export function useMapViewport({
  items,
  showParcelLayer,
  loadPublicMap,
  loadParcels,
  animateToRegion,
  onViewportBboxChange,
}: UseMapViewportArgs) {
  const [region, setRegion] = useState<Region>(DEFAULT_MAP_REGION)
  const debouncedRegion = useDebouncedValue(region, VIEWPORT_DEBOUNCE_MS)
  const fitRef = useRef({ armed: true, baseline: items })
  const lastParcelsKeyRef = useRef("")

  const loadItems = useLatestCallback(loadPublicMap)
  const loadParcelsLatest = useLatestCallback(loadParcels)
  const animate = useLatestCallback(animateToRegion)
  const reportBbox = useLatestCallback((bbox: string) => onViewportBboxChange?.(bbox))

  const zoom = useMemo(() => computeRegionZoom(region), [region])
  const parcelLayerRenderable = showParcelLayer && zoom >= PARCEL_MIN_ZOOM
  const viewportBbox = useMemo(() => computeRegionBbox(debouncedRegion), [debouncedRegion])
  const viewportZoom = useMemo(() => computeRegionZoom(debouncedRegion), [debouncedRegion])
  const parcelsWanted = showParcelLayer && viewportZoom >= PARCEL_MIN_ZOOM

  const onRegionChangeComplete = useCallback((next: Region, details?: Details) => {
    if (details?.isGesture === true) {
      // The user took the camera: a late first load must not pull it away.
      fitRef.current.armed = false
    }
    setRegion((current) => (areRegionsNearlyEqual(current, next) ? current : next))
  }, [])

  useEffect(() => {
    reportBbox(viewportBbox)
    void loadItems({ bbox: viewportBbox })
  }, [loadItems, reportBbox, viewportBbox])

  useEffect(() => {
    if (!parcelsWanted) {
      lastParcelsKeyRef.current = ""
      return
    }
    const key = `${viewportZoom}:${viewportBbox}`
    if (lastParcelsKeyRef.current === key) {
      return
    }
    lastParcelsKeyRef.current = key
    void loadParcelsLatest({ bbox: viewportBbox, zoom: viewportZoom })
  }, [loadParcelsLatest, parcelsWanted, viewportBbox, viewportZoom])

  /** Animates to `target` if a fit is pending (first load or filter apply); true when it did. */
  const fitOnce = useCallback(
    (target: Region): boolean => {
      if (!fitRef.current.armed) {
        return false
      }
      fitRef.current.armed = false
      animate(target, FIT_DURATION_MS)
      return true
    },
    [animate],
  )

  useEffect(() => {
    const fit = fitRef.current
    if (!fit.armed || items === fit.baseline) {
      return
    }
    if (items.length === 0) {
      fit.armed = false
      return
    }
    fitOnce(computeRegionFromItems(items))
  }, [fitOnce, items])

  const moveTo = useCallback(
    (target: Region, durationMs: number) => animate(target, durationMs),
    [animate],
  )

  /** Explicit refresh: the current viewport, even when it was just loaded. */
  const reload = useLatestCallback(() => {
    const bbox = computeRegionBbox(region)
    void loadItems({ bbox, force: true })
    if (parcelLayerRenderable) {
      void loadParcelsLatest({ bbox, zoom })
    }
  })

  /** Filter apply: every item matching the filters, then one fit on the result. */
  const applyFilters = useLatestCallback(() => {
    fitRef.current = { armed: true, baseline: items }
    void loadItems({ force: true })
  })

  return {
    region,
    zoom,
    parcelLayerRenderable,
    onRegionChangeComplete,
    fitOnce,
    moveTo,
    reload,
    applyFilters,
  }
}
