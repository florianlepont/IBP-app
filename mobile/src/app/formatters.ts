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
  if (deltaMs <= 0) return "expired"

  const totalMinutes = Math.floor(deltaMs / (60 * 1000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h remaining`
  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}
