/**
 * Tests for useNearbyParcels.
 *
 * Strategy: mock expo-location and the API client, spy on React.useState /
 * useCallback so the hook can be called directly in Node without a renderer
 * (same pattern as useSurveySyncNetwork.test.ts), then call `load()` and
 * assert the bbox sent to fetchPublicParcelStatuses.
 */

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

import React from "react"
import { useNearbyParcels } from "./useNearbyParcels"

describe("useNearbyParcels", () => {
  let useStateSpy: jest.SpyInstance
  let useCallbackSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchPublicParcelStatuses.mockResolvedValue({ items: [] })
    useStateSpy = jest
      .spyOn(React, "useState")
      .mockImplementation((initial?: unknown) => [initial, jest.fn()] as [unknown, jest.Mock])
    useCallbackSpy = jest.spyOn(React, "useCallback").mockImplementation((fn) => fn as never)
  })

  afterEach(() => {
    useStateSpy.mockRestore()
    useCallbackSpy.mockRestore()
  })

  test("load calls fetchPublicParcelStatuses with the correct bbox order", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 46, longitude: 2 } })

    const hook = useNearbyParcels("http://localhost:3000")
    await hook.load()

    expect(mockFetchPublicParcelStatuses).toHaveBeenCalledWith("http://localhost:3000", {
      bbox: "1.975000,45.975000,2.025000,46.025000",
      zoom: 15,
    })
  })

  test("load does not call fetchPublicParcelStatuses when permission is denied twice", async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: false })
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ granted: false })

    const hook = useNearbyParcels("http://localhost:3000")
    await hook.load()

    expect(mockFetchPublicParcelStatuses).not.toHaveBeenCalled()
  })
})
