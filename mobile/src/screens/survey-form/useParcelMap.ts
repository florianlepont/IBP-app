import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import MapView, { Region } from "react-native-maps"
import * as Location from "expo-location"
import {
  DEFAULT_FRANCE_CENTER,
  areRegionsNearlyEqual,
  buildFocusedMapRegion,
  computeRegionZoom,
} from "../../app/map-viewport"
import { AppScreen, GpsCaptureResult } from "../../app/types"
import { useParcelStatuses } from "../../hooks/useParcelStatuses"
import { toAddressLabel } from "../survey-screen-helpers"
import type { WizardStep } from "./components"

type UseParcelMapInput = {
  apiUrl: string
  screen: AppScreen
  editingSurveyId: string | null
  gpsLocation: { lat: string; lng: string; collected_at: string }
  activeStep: WizardStep
  onCaptureGpsLocation: () => Promise<GpsCaptureResult | null>
}

type MapRef = { current: MapView | null }
type FlagRef = { current: boolean }
type RegionRef = { current: Region | null }

const ADDRESS_UNAVAILABLE = "Adresse locale non disponible"
const AUTO_LOCATE_ERROR =
  "Current position unavailable. Open the full-screen map to retry or browse manually."
const MANUAL_LOCATE_ERROR = "Current position unavailable. Browse the map manually or try again."

// Map state of the parcels step: region, parcel overlay, GPS centring and the
// reverse-geocoded address. Shared by the inline map and the full-screen modal.
export function useParcelMap({
  apiUrl,
  screen,
  editingSurveyId,
  gpsLocation,
  activeStep,
  onCaptureGpsLocation,
}: UseParcelMapInput) {
  const inlineMapRef = useRef<MapView | null>(null)
  const fullscreenMapRef = useRef<MapView | null>(null)
  const inlineMapReadyRef = useRef(false)
  const fullscreenMapReadyRef = useRef(false)
  const pendingInlineRegionRef = useRef<Region | null>(null)
  const pendingFullscreenRegionRef = useRef<Region | null>(null)
  const onCaptureGpsLocationRef = useRef(onCaptureGpsLocation)
  const parcelLocateRequestIdRef = useRef(0)
  const lastResolvedCoordinateKeyRef = useRef("")
  const [autoLocateRequested, setAutoLocateRequested] = useState(false)
  const [isAutoLocatingParcels, setIsAutoLocatingParcels] = useState(false)
  const [parcelAutoLocateError, setParcelAutoLocateError] = useState("")
  const [isParcelMapFullscreenVisible, setIsParcelMapFullscreenVisible] = useState(false)
  const [resolvedGpsAddress, setResolvedGpsAddress] = useState("")
  const [isResolvingGpsAddress, setIsResolvingGpsAddress] = useState(false)

  const parsedLat = Number(gpsLocation.lat)
  const parsedLng = Number(gpsLocation.lng)
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER
  const computedMapRegion: Region = hasGpsCoordinates
    ? buildFocusedMapRegion(mapCenter)
    : {
        latitude: mapCenter.lat,
        longitude: mapCenter.lng,
        latitudeDelta: 3.8,
        longitudeDelta: 3.8,
      }
  const [mapRegion, setMapRegion] = useState<Region>(computedMapRegion)
  const mapZoom = useMemo(() => computeRegionZoom(mapRegion), [mapRegion])
  const { items: parcelStatuses, loading: parcelsLoading } = useParcelStatuses({
    apiUrl,
    region: mapRegion,
    enabled: true,
    year: new Date().getFullYear(),
  })

  useEffect(() => {
    onCaptureGpsLocationRef.current = onCaptureGpsLocation
  }, [onCaptureGpsLocation])

  const animateParcelMapRegion = useCallback(
    (
      mapRef: MapRef,
      mapReadyRef: FlagRef,
      pendingRegionRef: RegionRef,
      nextRegion: Region,
      duration = 420,
    ): void => {
      if (!mapReadyRef.current || !mapRef.current) {
        pendingRegionRef.current = nextRegion
        return
      }

      pendingRegionRef.current = null
      mapRef.current.animateToRegion(nextRegion, duration)
    },
    [],
  )

  const syncParcelMapsToRegion = useCallback(
    (nextRegion: Region, duration = 420): void => {
      animateParcelMapRegion(
        inlineMapRef,
        inlineMapReadyRef,
        pendingInlineRegionRef,
        nextRegion,
        duration,
      )
      animateParcelMapRegion(
        fullscreenMapRef,
        fullscreenMapReadyRef,
        pendingFullscreenRegionRef,
        nextRegion,
        duration,
      )
    },
    [animateParcelMapRegion],
  )

  const centerParcelMapsOnLocation = useCallback(
    (location: GpsCaptureResult): void => {
      const nextRegion = buildFocusedMapRegion(location)
      setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
      syncParcelMapsToRegion(nextRegion, 420)
    },
    [syncParcelMapsToRegion],
  )

  const handleInlineMapReady = (): void => {
    inlineMapReadyRef.current = true
    const nextRegion = pendingInlineRegionRef.current ?? mapRegion
    pendingInlineRegionRef.current = null
    requestAnimationFrame(() => {
      inlineMapRef.current?.animateToRegion(nextRegion, 0)
    })
  }

  const handleFullscreenMapReady = (): void => {
    fullscreenMapReadyRef.current = true
    const nextRegion = pendingFullscreenRegionRef.current ?? mapRegion
    pendingFullscreenRegionRef.current = null
    requestAnimationFrame(() => {
      fullscreenMapRef.current?.animateToRegion(nextRegion, 0)
    })
  }

  const setInlineMapInstance = (instance: MapView | null): void => {
    inlineMapRef.current = instance
    inlineMapReadyRef.current = false
  }

  const setFullscreenMapInstance = (instance: MapView | null): void => {
    fullscreenMapRef.current = instance
    fullscreenMapReadyRef.current = false
  }

  useEffect(() => {
    if (!hasGpsCoordinates) {
      return
    }
    const nextRegion = buildFocusedMapRegion({ lat: parsedLat, lng: parsedLng })
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
    syncParcelMapsToRegion(nextRegion, 420)
  }, [gpsLocation.collected_at, hasGpsCoordinates, parsedLat, parsedLng, syncParcelMapsToRegion])

  const requestLocation = useCallback(
    (requestId: number, errorText: string): void => {
      void onCaptureGpsLocationRef
        .current()
        .then((capturedLocation) => {
          if (parcelLocateRequestIdRef.current !== requestId) {
            return
          }
          setIsAutoLocatingParcels(false)
          if (!capturedLocation) {
            setParcelAutoLocateError(errorText)
            return
          }
          centerParcelMapsOnLocation(capturedLocation)
        })
        .catch(() => {
          if (parcelLocateRequestIdRef.current !== requestId) {
            return
          }
          setIsAutoLocatingParcels(false)
          setParcelAutoLocateError(errorText)
        })
    },
    [centerParcelMapsOnLocation],
  )

  useEffect(() => {
    if (activeStep !== "parcels") {
      parcelLocateRequestIdRef.current += 1
      setAutoLocateRequested(false)
      setIsAutoLocatingParcels(false)
      setParcelAutoLocateError("")
      return
    }

    if (hasGpsCoordinates) {
      setIsAutoLocatingParcels(false)
      setParcelAutoLocateError("")
      return
    }

    if (autoLocateRequested) {
      return
    }

    const requestId = parcelLocateRequestIdRef.current + 1
    parcelLocateRequestIdRef.current = requestId
    setAutoLocateRequested(true)
    setIsAutoLocatingParcels(true)
    setParcelAutoLocateError("")
    requestLocation(requestId, AUTO_LOCATE_ERROR)
  }, [activeStep, autoLocateRequested, hasGpsCoordinates, requestLocation])

  useEffect(() => {
    if (!hasGpsCoordinates) {
      setResolvedGpsAddress("")
      setIsResolvingGpsAddress(false)
      return
    }

    const coordinateKey = `${parsedLat.toFixed(5)},${parsedLng.toFixed(5)}`
    if (lastResolvedCoordinateKeyRef.current === coordinateKey) {
      return
    }
    lastResolvedCoordinateKeyRef.current = coordinateKey

    let cancelled = false
    const run = async (): Promise<void> => {
      try {
        setIsResolvingGpsAddress(true)
        const matches = await Location.reverseGeocodeAsync({
          latitude: parsedLat,
          longitude: parsedLng,
        })
        if (cancelled) {
          return
        }
        const first = matches[0] as Record<string, unknown> | undefined
        if (!first) {
          setResolvedGpsAddress(ADDRESS_UNAVAILABLE)
          return
        }
        const label = toAddressLabel(first)
        setResolvedGpsAddress(label || ADDRESS_UNAVAILABLE)
      } catch (_error) {
        if (!cancelled) {
          setResolvedGpsAddress(ADDRESS_UNAVAILABLE)
        }
      } finally {
        if (!cancelled) {
          setIsResolvingGpsAddress(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [hasGpsCoordinates, parsedLat, parsedLng])

  useEffect(() => {
    setAutoLocateRequested(false)
  }, [screen, editingSurveyId])

  const handleLocateParcelsMap = (): void => {
    if (isAutoLocatingParcels) {
      return
    }

    const requestId = parcelLocateRequestIdRef.current + 1
    parcelLocateRequestIdRef.current = requestId
    setIsAutoLocatingParcels(true)
    setParcelAutoLocateError("")
    requestLocation(requestId, MANUAL_LOCATE_ERROR)
  }

  const handleMapRegionChange = (nextRegion: Region): void => {
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
  }

  useEffect(() => {
    if (hasGpsCoordinates) {
      return
    }
    const fallbackRegion: Region = {
      latitude: DEFAULT_FRANCE_CENTER.lat,
      longitude: DEFAULT_FRANCE_CENTER.lng,
      latitudeDelta: 3.8,
      longitudeDelta: 3.8,
    }
    setMapRegion((current) =>
      areRegionsNearlyEqual(current, fallbackRegion) ? current : fallbackRegion,
    )
  }, [hasGpsCoordinates, screen, editingSurveyId])

  useEffect(() => {
    if (isParcelMapFullscreenVisible) {
      return
    }
    syncParcelMapsToRegion(mapRegion, 0)
  }, [isParcelMapFullscreenVisible, mapRegion, syncParcelMapsToRegion])

  const helperText = useMemo(() => {
    if (isAutoLocatingParcels) {
      return "Centering on your current position..."
    }
    if (parcelAutoLocateError) {
      return parcelAutoLocateError
    }
    if (mapZoom >= 15) {
      return parcelsLoading
        ? "Loading parcel overlay..."
        : `${parcelStatuses.length} visible parcel(s) · tap polygons to select or deselect`
    }
    return "Zoom in to unlock parcel selection"
  }, [isAutoLocatingParcels, mapZoom, parcelAutoLocateError, parcelStatuses.length, parcelsLoading])

  return {
    helperText,
    mapRegion,
    mapZoom,
    parcelStatuses,
    parcelsLoading,
    gpsMarker: hasGpsCoordinates ? { latitude: parsedLat, longitude: parsedLng } : null,
    isAutoLocatingParcels,
    parcelAutoLocateError,
    isParcelMapFullscreenVisible,
    closeFullscreenMap: () => setIsParcelMapFullscreenVisible(false),
    resolvedGpsAddress,
    isResolvingGpsAddress,
    setInlineMapInstance,
    setFullscreenMapInstance,
    handleInlineMapReady,
    handleFullscreenMapReady,
    handleMapRegionChange,
    handleLocateParcelsMap,
  }
}

export type ParcelMapState = ReturnType<typeof useParcelMap>
