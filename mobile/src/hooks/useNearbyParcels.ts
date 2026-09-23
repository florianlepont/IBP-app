import { useCallback, useState } from "react"
import * as Location from "expo-location"
import { fetchPublicParcelStatuses } from "../api/ibp-api"
import { buildBboxAroundPoint } from "../app/map-viewport"
import type { PublicParcelStatusItem } from "../app/types"

const RADIUS_DEG = 0.025 // ~2.5 km at mid-latitudes
const MAX_RESULTS = 5
const ZOOM = 15

export type NearbyParcel = PublicParcelStatusItem & {
  distanceKm: number
  surveyCount: number
}

export type NearbyParcelsState = {
  parcels: NearbyParcel[]
  sectorAvgScore: number | null
  loading: boolean
  locationDenied: boolean
  error: boolean
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getCentroid(item: PublicParcelStatusItem): { lat: number; lng: number } | null {
  if (!item.geometry) return null
  const coords =
    item.geometry.type === "Polygon"
      ? (item.geometry.coordinates as number[][][])[0]
      : (item.geometry.coordinates as number[][][][])[0][0]
  if (!coords?.length) return null
  const sum = coords.reduce((acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }), {
    lat: 0,
    lng: 0,
  })
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length }
}

export function useNearbyParcels(apiUrl: string) {
  const [state, setState] = useState<NearbyParcelsState>({
    parcels: [],
    sectorAvgScore: null,
    loading: false,
    locationDenied: false,
    error: false,
  })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: false }))

    try {
      const permission = await Location.getForegroundPermissionsAsync()
      if (!permission.granted) {
        const requested = await Location.requestForegroundPermissionsAsync()
        if (!requested.granted) {
          setState((s) => ({ ...s, loading: false, locationDenied: true }))
          return
        }
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const { latitude: lat, longitude: lng } = position.coords
      const bbox = buildBboxAroundPoint({ lat, lng }, RADIUS_DEG)

      const { items } = await fetchPublicParcelStatuses(apiUrl, { bbox, zoom: ZOOM })

      const withDistance: NearbyParcel[] = items
        .map((item) => {
          const centroid = getCentroid(item)
          const distanceKm = centroid ? haversineKm(lat, lng, centroid.lat, centroid.lng) : 999
          return { ...item, distanceKm, surveyCount: item.latest_observation_year ? 1 : 0 }
        })
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_RESULTS)

      const scored = withDistance.filter((p) => p.latest_ibp_total != null)
      const sectorAvgScore =
        scored.length > 0
          ? Math.round(
              (scored.reduce((sum, p) => sum + (p.latest_ibp_total ?? 0), 0) / scored.length) * 10,
            ) / 10
          : null

      setState({
        parcels: withDistance,
        sectorAvgScore,
        loading: false,
        locationDenied: false,
        error: false,
      })
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }))
    }
  }, [apiUrl])

  return { ...state, load }
}
