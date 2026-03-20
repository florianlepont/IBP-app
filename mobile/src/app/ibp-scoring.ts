import { FactorKey, FactorRetainedScore } from "./types"

const FACTOR_ORDER: FactorKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
const STANDARD_ALLOWED = new Set([0, 1, 2, 5])
const IJ_ALLOWED = new Set([0, 2, 5])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const pickNumber = (obj: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = asNumber(obj[key])
    if (value !== null) return value
  }
  return null
}

const toClass = (score: 0 | 1 | 2 | 5): "S0" | "S1" | "S2" | "S5" => {
  if (score === 0) return "S0"
  if (score === 1) return "S1"
  if (score === 2) return "S2"
  return "S5"
}

const normalizeRegionVersion = (regionVersion: unknown): "ACA" | "M" | undefined => {
  if (regionVersion === "ACA" || regionVersion === "M") {
    return regionVersion
  }
  return undefined
}

const resolveThresholdRegion = (
  regionVersion: "ACA" | "M" | undefined,
  vegetationStage: string | null | undefined,
): "ACA" | "M" | undefined => {
  if (vegetationStage === "montagnard_mediterraneen") {
    return "ACA"
  }
  return regionVersion
}

const isAllowedFactorScore = (factorKey: FactorKey, score: number): score is 0 | 1 | 2 | 5 => {
  if (factorKey === "I" || factorKey === "J") {
    return IJ_ALLOWED.has(score)
  }
  return STANDARD_ALLOWED.has(score)
}

const scoreFactorA = (
  raw: Record<string, unknown>,
  region?: "ACA" | "M",
  stage?: string | null,
): number | null => {
  const count = pickNumber(raw, ["native_genus_count", "autochthonous_genus_count", "count"])
  if (count === null) return null

  const isSubalpin = region === "ACA" && stage === "subalpin"
  if (isSubalpin) {
    if (count <= 0) return 0
    if (count === 1) return 1
    if (count === 2) return 2
    return 5
  }

  if (count <= 1) return 0
  if (count === 2) return 1
  if (count <= 4) return 2
  return 5
}

const scoreFactorB = (raw: Record<string, unknown>): number | null => {
  const strataCount = pickNumber(raw, ["strata_count", "count"])
  const coverPercent = pickNumber(raw, ["covered_autochthonous_percent", "native_cover_percent"])
  if (strataCount === null || coverPercent === null) return null

  let score = 0
  if (strataCount <= 1) score = 0
  else if (strataCount === 2) score = 1
  else if (strataCount <= 4) score = 2
  else score = 5

  if (coverPercent < 50 && score > 2) {
    score = 2
  }

  return score
}

const scoreFactorCD = (raw: Record<string, unknown>): number | null => {
  const bmgCount = pickNumber(raw, ["bmg_count"])
  const bmmCount = pickNumber(raw, ["bmm_count"])
  const surfaceHa = pickNumber(raw, ["surface_ha"])
  if (bmgCount === null || bmmCount === null || surfaceHa === null || surfaceHa <= 0) return null

  const bmgPerHa = bmgCount / surfaceHa
  const bmmPerHa = bmmCount / surfaceHa
  if (bmgPerHa < 1 && bmmPerHa < 1) return 0
  if (bmgPerHa < 1 && bmmPerHa >= 1) return 1
  if (bmgPerHa < 3) return 2
  return 5
}

const scoreFactorE = (raw: Record<string, unknown>): number | null => {
  const tgbCount = pickNumber(raw, ["tgb_count"])
  const gbCount = pickNumber(raw, ["gb_count"])
  const surfaceHa = pickNumber(raw, ["surface_ha"])
  if (tgbCount === null || gbCount === null || surfaceHa === null || surfaceHa <= 0) return null

  const tgbPerHa = tgbCount / surfaceHa
  const gbPerHa = gbCount / surfaceHa
  if (tgbPerHa < 1 && gbPerHa < 1) return 0
  if (tgbPerHa < 1 && gbPerHa >= 1) return 1
  if (tgbPerHa < 5) return 2
  return 5
}

const scoreFactorF = (raw: Record<string, unknown>): number | null => {
  const treesPerHa = pickNumber(raw, ["trees_per_ha"])
  if (treesPerHa !== null) {
    if (treesPerHa < 2) return 0
    if (treesPerHa < 3) return 1
    if (treesPerHa < 8) return 2
    return 5
  }

  const groups = raw.dmh_group_counts
  if (!Array.isArray(groups)) return null

  let cappedTotal = 0
  for (const group of groups) {
    const n = asNumber(group)
    if (n === null) return null
    cappedTotal += Math.min(2, Math.max(0, n))
  }

  if (cappedTotal < 2) return 0
  if (cappedTotal < 3) return 1
  if (cappedTotal < 8) return 2
  return 5
}

const scoreFactorG = (
  raw: Record<string, unknown>,
  region?: "ACA" | "M",
  stage?: string | null,
): number | null => {
  const directPercent = pickNumber(raw, ["open_flowering_percent", "flowering_percent"])
  let percent = directPercent

  if (percent === null) {
    const openArea = pickNumber(raw, ["flowering_open_area_m2", "open_area_m2"])
    const describedArea = pickNumber(raw, ["described_area_m2"])
    if (openArea !== null && describedArea !== null && describedArea > 0) {
      percent = (openArea / describedArea) * 100
    }
  }

  if (percent === null) return null

  const isSubalpin = region === "ACA" && stage === "subalpin"
  if (percent <= 0) return 0
  if (isSubalpin) {
    return percent < 1 ? 2 : 5
  }
  return percent < 1 || percent > 5 ? 2 : 5
}

const scoreFactorH = (raw: Record<string, unknown>): number | null => {
  const numeric = pickNumber(raw, ["class_score", "score"])
  if (numeric !== null) return numeric

  const cls = typeof raw.class === "string" ? raw.class.trim().toLowerCase() : ""
  if (!cls) return null
  if (["recent", "0"].includes(cls)) return 0
  if (["partial", "2"].includes(cls)) return 2
  if (["ancient", "5"].includes(cls)) return 5
  return null
}

const scoreFactorIJ = (raw: Record<string, unknown>): number | null => {
  const count = pickNumber(raw, ["type_count", "count"])
  if (count === null) return null
  if (count <= 0) return 0
  if (count === 1) return 2
  return 5
}

export const resolveFactorScoreFromRaw = (
  factorKey: FactorKey,
  rawValue: unknown,
  regionVersion?: unknown,
  vegetationStage?: string | null,
): number | null => {
  const direct = asNumber(rawValue)
  if (direct !== null) {
    return direct
  }
  if (!isObject(rawValue)) {
    return null
  }

  const normalizedRegion = normalizeRegionVersion(regionVersion)
  const thresholdRegion = resolveThresholdRegion(normalizedRegion, vegetationStage)

  switch (factorKey) {
    case "A":
      return scoreFactorA(rawValue, thresholdRegion, vegetationStage)
    case "B":
      return scoreFactorB(rawValue)
    case "C":
    case "D":
      return scoreFactorCD(rawValue)
    case "E":
      return scoreFactorE(rawValue)
    case "F":
      return scoreFactorF(rawValue)
    case "G":
      return scoreFactorG(rawValue, thresholdRegion, vegetationStage)
    case "H":
      return scoreFactorH(rawValue)
    case "I":
    case "J":
      return scoreFactorIJ(rawValue)
    default:
      return null
  }
}

export const computeRetainedScoresFromRawFactors = (
  factors: Record<string, unknown> | null | undefined,
  regionVersion?: unknown,
  vegetationStage?: string | null,
): Record<FactorKey, FactorRetainedScore | null> => {
  const rawFactors = isObject(factors) ? factors : {}
  const retainedScores = {} as Record<FactorKey, FactorRetainedScore | null>

  for (const factorKey of FACTOR_ORDER) {
    const score = resolveFactorScoreFromRaw(
      factorKey,
      rawFactors[factorKey],
      regionVersion,
      vegetationStage,
    )
    if (score === null || !isAllowedFactorScore(factorKey, score)) {
      retainedScores[factorKey] = null
      continue
    }

    retainedScores[factorKey] = {
      score,
      selected_class: toClass(score),
    }
  }

  return retainedScores
}

export const computeIbpTotalsFromRetainedScores = (
  scores: Record<FactorKey, FactorRetainedScore | null>,
): {
  ibp_peuplement_gestion: number
  ibp_contexte: number
  ibp_total: number
  completed_factors: number
} => {
  const value = (factorKey: FactorKey): number => scores[factorKey]?.score ?? 0
  const completedFactors = FACTOR_ORDER.filter((factorKey) => Boolean(scores[factorKey])).length
  const ibpPeuplementGestion =
    value("A") + value("B") + value("C") + value("D") + value("E") + value("F") + value("G")
  const ibpContexte = value("H") + value("I") + value("J")

  return {
    ibp_peuplement_gestion: ibpPeuplementGestion,
    ibp_contexte: ibpContexte,
    ibp_total: ibpPeuplementGestion + ibpContexte,
    completed_factors: completedFactors,
  }
}

export const resolveDraftParcelIds = (input: { parcel_ids?: unknown }): string[] => {
  const source = Array.isArray(input.parcel_ids) ? input.parcel_ids : []

  const seen = new Set<string>()
  const output: string[] = []
  for (const value of source) {
    if (typeof value !== "string") {
      continue
    }
    const normalized = value.trim().toUpperCase()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    output.push(normalized)
  }
  return output
}

export type SubmitReadiness = {
  ready: boolean
  expired: boolean
  missing_factors: FactorKey[]
  missing_fields: Array<"region_version" | "vegetation_stage" | "parcel_ids">
}

export const evaluateSubmitReadinessFromDraft = (draft: {
  region_version?: unknown
  vegetation_stage?: unknown
  factors?: unknown
  parcel_ids?: unknown
  expires_at?: unknown
}): SubmitReadiness => {
  const regionVersion = draft.region_version
  const vegetationStage = typeof draft.vegetation_stage === "string" ? draft.vegetation_stage : ""
  const retainedScores = computeRetainedScoresFromRawFactors(
    isObject(draft.factors) ? draft.factors : {},
    regionVersion,
    vegetationStage,
  )

  const missingFactors = FACTOR_ORDER.filter((factorKey) => !retainedScores[factorKey])
  const missingFields: Array<"region_version" | "vegetation_stage" | "parcel_ids"> = []

  if (regionVersion !== "ACA" && regionVersion !== "M") {
    missingFields.push("region_version")
  }
  if (!vegetationStage.trim()) {
    missingFields.push("vegetation_stage")
  }
  if (resolveDraftParcelIds(draft).length === 0) {
    missingFields.push("parcel_ids")
  }

  const expiresAt = typeof draft.expires_at === "string" ? Date.parse(draft.expires_at) : NaN
  const expired = Number.isFinite(expiresAt) ? Date.now() > expiresAt : false

  return {
    ready: !expired && missingFactors.length === 0 && missingFields.length === 0,
    expired,
    missing_factors: missingFactors,
    missing_fields: missingFields,
  }
}
