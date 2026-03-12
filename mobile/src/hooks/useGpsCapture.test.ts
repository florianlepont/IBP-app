/**
 * Tests for useGpsCapture — GPS location capture hook.
 *
 * Strategy: mock expo-location with a factory function (avoids parsing the
 * ESM package) and exercise all branches of the permission + capture flow.
 */

// Variables starting with "mock" can be referenced inside jest.mock factories
// despite hoisting — this is a Jest-specific allowance.
const mockHasServicesEnabledAsync = jest.fn()
const mockGetForegroundPermissionsAsync = jest.fn()
const mockRequestForegroundPermissionsAsync = jest.fn()
const mockGetLastKnownPositionAsync = jest.fn()
const mockGetCurrentPositionAsync = jest.fn()

jest.mock('expo-location', () => ({
  hasServicesEnabledAsync: mockHasServicesEnabledAsync,
  getForegroundPermissionsAsync: mockGetForegroundPermissionsAsync,
  requestForegroundPermissionsAsync: mockRequestForegroundPermissionsAsync,
  getLastKnownPositionAsync: mockGetLastKnownPositionAsync,
  getCurrentPositionAsync: mockGetCurrentPositionAsync,
  Accuracy: { Balanced: 3 },
}))

import { useGpsCapture } from './useGpsCapture'

const TEST_POSITION = {
  coords: { latitude: 48.643, longitude: 1.829 },
  timestamp: 1700000000000,
}

const TEST_FALLBACK = {
  coords: { latitude: 47.0, longitude: 2.0 },
  timestamp: 1699999000000,
}

describe('useGpsCapture', () => {
  let surveyForm: { applyGpsLocation: jest.Mock }
  let onStatusChange: jest.Mock
  let onAlert: jest.Mock
  let handleCaptureGpsLocation: () => Promise<{ lat: number; lng: number; collected_at: string } | null>

  beforeEach(() => {
    jest.clearAllMocks()
    surveyForm = { applyGpsLocation: jest.fn() }
    onStatusChange = jest.fn()
    onAlert = jest.fn()
    const hook = useGpsCapture({ surveyForm: surveyForm as never, onStatusChange, onAlert })
    handleCaptureGpsLocation = hook.handleCaptureGpsLocation
  })

  test('returns false and alerts when location services are disabled', async () => {
    mockHasServicesEnabledAsync.mockResolvedValue(false)

    const result = await handleCaptureGpsLocation()

    expect(result).toBeNull()
    expect(onStatusChange).toHaveBeenCalledWith('Location services disabled')
    expect(onAlert).toHaveBeenCalledWith('Location disabled', expect.any(String))
  })

  test('returns false and alerts when permission is denied', async () => {
    mockHasServicesEnabledAsync.mockResolvedValue(true)
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: false })
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ granted: false })

    const result = await handleCaptureGpsLocation()

    expect(result).toBeNull()
    expect(onAlert).toHaveBeenCalledWith('Location disabled', expect.any(String))
  })

  test('uses existing permission without requesting again', async () => {
    mockHasServicesEnabledAsync.mockResolvedValue(true)
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetLastKnownPositionAsync.mockResolvedValue(null)
    mockGetCurrentPositionAsync.mockResolvedValue(TEST_POSITION)

    await handleCaptureGpsLocation()

    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled()
  })

  test('applies fallback then refines with accurate position', async () => {
    mockHasServicesEnabledAsync.mockResolvedValue(true)
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetLastKnownPositionAsync.mockResolvedValue(TEST_FALLBACK)
    mockGetCurrentPositionAsync.mockResolvedValue(TEST_POSITION)

    const result = await handleCaptureGpsLocation()

    expect(result).toEqual({
      lat: 48.643,
      lng: 1.829,
      collected_at: expect.any(String),
    })
    expect(surveyForm.applyGpsLocation).toHaveBeenCalledTimes(2)
    expect(surveyForm.applyGpsLocation).toHaveBeenNthCalledWith(1, {
      lat: 47.0,
      lng: 2.0,
      collected_at: expect.any(String),
    })
    expect(surveyForm.applyGpsLocation).toHaveBeenNthCalledWith(2, {
      lat: 48.643,
      lng: 1.829,
      collected_at: expect.any(String),
    })
    expect(onStatusChange).toHaveBeenCalledWith('GPS location captured')
  })

  test('returns true using fallback when getCurrentPositionAsync fails', async () => {
    mockHasServicesEnabledAsync.mockResolvedValue(true)
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetLastKnownPositionAsync.mockResolvedValue(TEST_FALLBACK)
    mockGetCurrentPositionAsync.mockRejectedValue(new Error('GPS timeout'))

    const result = await handleCaptureGpsLocation()

    expect(result).toEqual({
      lat: 47.0,
      lng: 2.0,
      collected_at: expect.any(String),
    })
    expect(onStatusChange).toHaveBeenCalledWith('Approximate location captured')
    expect(surveyForm.applyGpsLocation).toHaveBeenCalledTimes(1)
  })

  test('returns false and alerts when no fallback and GPS fails', async () => {
    mockHasServicesEnabledAsync.mockResolvedValue(true)
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetLastKnownPositionAsync.mockResolvedValue(null)
    mockGetCurrentPositionAsync.mockRejectedValue(new Error('GPS unavailable'))

    const result = await handleCaptureGpsLocation()

    expect(result).toBeNull()
    expect(onAlert).toHaveBeenCalledWith('GPS unavailable', expect.any(String))
  })

  test('returns true and applies position when no last known position', async () => {
    mockHasServicesEnabledAsync.mockResolvedValue(true)
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: true })
    mockGetLastKnownPositionAsync.mockResolvedValue(null)
    mockGetCurrentPositionAsync.mockResolvedValue(TEST_POSITION)

    const result = await handleCaptureGpsLocation()

    expect(result).toEqual({
      lat: 48.643,
      lng: 1.829,
      collected_at: expect.any(String),
    })
    expect(surveyForm.applyGpsLocation).toHaveBeenCalledTimes(1)
    expect(surveyForm.applyGpsLocation).toHaveBeenCalledWith({
      lat: 48.643,
      lng: 1.829,
      collected_at: expect.any(String),
    })
    expect(onStatusChange).toHaveBeenCalledWith('GPS location captured')
  })
})
