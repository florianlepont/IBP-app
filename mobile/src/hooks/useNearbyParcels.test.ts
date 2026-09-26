/**
 * Tests for useNearbyParcels.
 *
 * Strategy: mock expo-location and the API client, render the real hook with
 * renderHook (phase 01.9 D-01), then call `load()` inside act and assert the
 * bbox sent to fetchPublicParcelStatuses and the resulting state.
 */

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }))

const mockGetForegroundPermissionsAsync = jest.fn()
const mockRequestForegroundPermissionsAsync = jest.fn()
const mockGetCurrentPositionAsync = jest.fn()

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: mockGetForegroundPermissionsAsync,
  requestForegroundPermissionsAsync: mockRequestForegroundPermissionsAsync,
  getCurrentPositionAsync: mockGetCurrentPositionAsync,
  Accuracy: { Balanced: 3 },
}))

const mockFetchPublicParcelStatuses = jest.fn()

jest.mock("../api/ibp-api", () => ({
  fetchPublicParcelStatuses: mockFetchPublicParcelStatuses,
}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { useNearbyParcels } from "./useNearbyParcels"

const API_URL = "http://localhost:3000"

afterEach(async () => {
  await cleanup()
})

describe("useNearbyParcels", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
  })

  test("load calls fetchPublicParcelStatuses with the correct bbox order", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 46, longitude: 2 } })

    const { result } = await renderHook(() => useNearbyParcels(API_URL))
    await act(async () => {
      await result.current.load()
    })

    expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith(API_URL, {
      bbox: "1.975000,45.975000,2.025000,46.025000",
      zoom: 15,
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.parcels).toEqual([])
    expect(result.current.sectorAvgScore).toBeNull()
  })

  test("load does not call fetchPublicParcelStatuses when permission is denied twice", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: false })
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ granted: false })

    const { result } = await renderHook(() => useNearbyParcels(API_URL))
    await act(async () => {
      await result.current.load()
    })

    expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
    expect(result.current.locationDenied).toBe(true)
    expect(result.current.loading).toBe(false)
  })

  test("load sorts parcels by distance and averages the scored ones", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: false })
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 46, longitude: 2 } })
    const square = (lng: number, lat: number) => [
      [lng, lat],
      [lng + 0.001, lat],
      [lng + 0.001, lat + 0.001],
      [lng, lat + 0.001],
    ]
    mockFetchPublicParcelStatuses.mockResolvedValue({
      items: [
        {
          parcel_id: "far",
          latest_ibp_total: 20,
          latest_observation_year: 2024,
          geometry: { type: "Polygon", coordinates: [square(2.02, 46.02)] },
        },
        {
          parcel_id: "near",
          latest_ibp_total: 11,
          latest_observation_year: null,
          geometry: { type: "MultiPolygon", coordinates: [[square(2, 46)]] },
        },
        { parcel_id: "no-geometry", latest_ibp_total: null, geometry: null },
      ],
    })

    const { result } = await renderHook(() => useNearbyParcels(API_URL))
    await act(async () => {
      await result.current.load()
    })

    expect(result.current.parcels.map((parcel) => parcel.parcel_id)).toEqual([
      "near",
      "far",
      "no-geometry",
    ])
    expect(result.current.parcels[0].surveyCount).toBe(0)
    expect(result.current.parcels[1].surveyCount).toBe(1)
    expect(result.current.parcels[2].distanceKm).toBe(999)
    expect(result.current.sectorAvgScore).toBe(15.5)
    expect(result.current.locationDenied).toBe(false)
  })

  test("load sets error when the request fails", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 46, longitude: 2 } })
    mockFetchPublicParcelStatuses.mockRejectedValue(new Error("offline"))

    const { result } = await renderHook(() => useNearbyParcels(API_URL))
    await act(async () => {
      await result.current.load()
    })

    expect(result.current.error).toBe(true)
    expect(result.current.loading).toBe(false)
  })
})
