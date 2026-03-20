import * as Location from "expo-location"
import { GpsCaptureResult } from "../app/types"
import { useSurveyForm } from "./useSurveyForm"

type UseGpsCaptureParams = {
  surveyForm: ReturnType<typeof useSurveyForm>
  onStatusChange: (msg: string) => void
  onAlert: (title: string, message: string) => void
}

export function useGpsCapture({ surveyForm, onStatusChange, onAlert }: UseGpsCaptureParams) {
  const handleCaptureGpsLocation = async (): Promise<GpsCaptureResult | null> => {
    try {
      const locationServicesEnabled = await Location.hasServicesEnabledAsync()
      if (!locationServicesEnabled) {
        onStatusChange("Location services disabled")
        onAlert(
          "Location disabled",
          "Enable location services to center the map and find nearby parcels.",
        )
        return null
      }

      onStatusChange("Requesting GPS permission...")
      const existingPermission = await Location.getForegroundPermissionsAsync()
      const permission = existingPermission.granted
        ? existingPermission
        : await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        onStatusChange("Location permission denied")
        onAlert(
          "Location disabled",
          "Allow location access to center the map and find nearby parcels.",
        )
        return null
      }

      let fallbackLocation: GpsCaptureResult | null = null
      const lastKnownPosition = await Location.getLastKnownPositionAsync()
      if (lastKnownPosition) {
        fallbackLocation = {
          lat: lastKnownPosition.coords.latitude,
          lng: lastKnownPosition.coords.longitude,
          collected_at: new Date(lastKnownPosition.timestamp).toISOString(),
        }
        surveyForm.applyGpsLocation(fallbackLocation)
        onStatusChange("Approximate location captured. Refining GPS...")
      } else {
        onStatusChange("Capturing GPS location...")
      }

      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })

        const currentLocation: GpsCaptureResult = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          collected_at: new Date(position.timestamp).toISOString(),
        }
        surveyForm.applyGpsLocation(currentLocation)
        onStatusChange("GPS location captured")
        return currentLocation
      } catch (error) {
        if (fallbackLocation) {
          onStatusChange("Approximate location captured")
          return fallbackLocation
        }
        throw error
      }
    } catch (error) {
      onStatusChange(`GPS error: ${(error as Error).message}`)
      onAlert("GPS unavailable", "The device could not provide a GPS position.")
      return null
    }
  }

  return { handleCaptureGpsLocation }
}
