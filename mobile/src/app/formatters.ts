export const formatPoints = (value: number): string => `${value} point${value > 1 ? "s" : ""}`

export const formatEventPayload = (payload?: Record<string, unknown> | null): string => {
  if (!payload) return ""
  const json = JSON.stringify(payload)
  if (!json) return ""
  return json.length > 120 ? `${json.slice(0, 117)}...` : json
}

export const formatDateTime = (value?: string | null): string => {
  if (!value) return "n/a"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export const formatShortDateTime = (value?: string | null): string => {
  if (!value) return "n/a"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const SYNC_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /site_name.*required|required.*site_name/i, message: "Le nom du site est manquant" },
  { pattern: /region.*required|required.*region/i, message: "La région est manquante" },
  {
    pattern: /vegetation.*required|required.*vegetation/i,
    message: "Le stade de végétation est manquant",
  },
  { pattern: /HTTP 4\d\d/i, message: "Données invalides — ouvrez le relevé pour corriger" },
  {
    pattern: /HTTP 5\d\d|network|timeout|ECONNREFUSED/i,
    message: "Erreur réseau — réessayez plus tard",
  },
  { pattern: /unauthorized|401|forbidden|403/i, message: "Session expirée — reconnectez-vous" },
]

export const formatSyncErrorForUser = (rawError?: string | null): string | null => {
  if (!rawError?.trim()) return null
  for (const { pattern, message } of SYNC_ERROR_PATTERNS) {
    if (pattern.test(rawError)) return message
  }
  return "Erreur de synchronisation — ouvrez le relevé pour corriger"
}

export const resolveSubmissionDeadline = (
  createdAt?: string | null,
  expiresAt?: string | null,
): string | null => {
  if (expiresAt) return expiresAt
  if (!createdAt) return null
  const createdAtMs = Date.parse(createdAt)
  if (!Number.isFinite(createdAtMs)) return null
  return new Date(createdAtMs + 7 * 24 * 60 * 60 * 1000).toISOString()
}

export const getRemainingTimeMs = (deadlineIso?: string | null): number | null => {
  if (!deadlineIso) return null
  const deadlineMs = Date.parse(deadlineIso)
  if (!Number.isFinite(deadlineMs)) return null
  return deadlineMs - Date.now()
}

export const isLessThan24HoursRemaining = (deadlineIso?: string | null): boolean => {
  const remaining = getRemainingTimeMs(deadlineIso)
  if (remaining === null) return false
  return remaining > 0 && remaining <= 24 * 60 * 60 * 1000
}

export const formatRemainingTime = (deadlineIso?: string | null): string => {
  const deltaMs = getRemainingTimeMs(deadlineIso)
  if (deltaMs === null) return "n/a"
  if (deltaMs <= 0) return "expiré"

  const totalMinutes = Math.floor(deltaMs / (60 * 1000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}j ${hours}h restant`
  if (hours > 0) return `${hours}h ${minutes}m restant`
  return `${minutes}m restant`
}
