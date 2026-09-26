import { fr } from "../i18n"
import { RegionVersion, VegetationStage } from "./types"

const regions = fr.labels.regions
const stages = fr.labels.vegetationStages

export const REGION_OPTIONS: Array<{ value: RegionVersion; label: string }> = [
  { value: "ACA", label: regions.ACA },
  { value: "M", label: regions.M },
]

export const VEGETATION_STAGE_OPTIONS_BY_REGION: Record<
  RegionVersion,
  Array<{ value: VegetationStage; label: string }>
> = {
  ACA: [
    { value: "planitiaire", label: stages.planitiaire },
    { value: "collineen", label: stages.collineen },
    { value: "montagnard", label: stages.montagnard },
    { value: "subalpin", label: stages.subalpin },
  ],
  M: [
    { value: "thermo_mediterraneen", label: stages.thermo_mediterraneen },
    { value: "meso_mediterraneen", label: stages.meso_mediterraneen },
    { value: "supra_mediterraneen", label: stages.supra_mediterraneen },
  ],
}

export const defaultVegetationStageForRegion = (region: RegionVersion): VegetationStage =>
  VEGETATION_STAGE_OPTIONS_BY_REGION[region][0].value

export const normalizeVegetationStageForRegion = (
  region: RegionVersion,
  stage: unknown,
): VegetationStage => {
  if (typeof stage !== "string") {
    return defaultVegetationStageForRegion(region)
  }
  if (region === "ACA" && stage === "montagnard_mediterraneen") {
    return "montagnard"
  }
  const match = VEGETATION_STAGE_OPTIONS_BY_REGION[region].find((option) => option.value === stage)
  return match ? match.value : defaultVegetationStageForRegion(region)
}
