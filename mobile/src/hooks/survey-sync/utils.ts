import * as Network from "expo-network"
import { evaluateSubmitReadinessFromDraft } from "../../app/ibp-scoring"

export const guessMimeType = (uri: string): string => {
  const normalized = uri.toLowerCase()
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg"
  if (normalized.endsWith(".png")) return "image/png"
  if (normalized.endsWith(".heic")) return "image/heic"
  if (normalized.endsWith(".webp")) return "image/webp"
  return "application/octet-stream"
}

export const isUnauthorizedResultMessage = (message: string): boolean =>
  /(^|[^0-9])401([^0-9]|$)|unauthorized|auth_required/i.test(message)

export const isOnlineNetworkState = (state: Network.NetworkState): boolean =>
  Boolean(state.isConnected) && (state.isInternetReachable ?? true)

export const formatSubmitReadinessError = (
  surveyId: string,
  readiness: ReturnType<typeof evaluateSubmitReadinessFromDraft>,
): string => {
  if (readiness.expired) {
    return `Survey ${surveyId} is expired and cannot be submitted`
  }

  const parts: string[] = []
  if (readiness.missing_factors.length > 0) {
    parts.push(`missing/invalid factors: ${readiness.missing_factors.join(", ")}`)
  }
  if (readiness.missing_fields.includes("region_version")) {
    parts.push("missing region version")
  }
  if (readiness.missing_fields.includes("vegetation_stage")) {
    parts.push("missing vegetation stage")
  }
  if (readiness.missing_fields.includes("parcel_ids")) {
    parts.push("missing parcel selection")
  }

  if (parts.length === 0) {
    return `Survey ${surveyId} is not ready for submit`
  }

  return `Submit blocked for ${surveyId}: ${parts.join(" | ")}`
}
