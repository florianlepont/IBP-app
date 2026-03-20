import { RegionVersion, VegetationStage } from "./types"

export const REGION_OPTIONS: Array<{ value: RegionVersion; label: string }> = [
  { value: "ACA", label: "Régions atlantique, continentale et alpine" },
  { value: "M", label: "Méditerranéenne" },
]

export const VEGETATION_STAGE_OPTIONS_BY_REGION: Record<
  RegionVersion,
  Array<{ value: VegetationStage; label: string }>
> = {
  ACA: [
    { value: "planitiaire", label: "Planitiaire" },
    { value: "collineen", label: "Collinéen" },
    { value: "montagnard", label: "Montagnard" },
    { value: "subalpin", label: "Subalpin" },
  ],
  M: [
    { value: "thermo_mediterraneen", label: "Thermo-méditerranéen" },
    { value: "meso_mediterraneen", label: "Méso-méditerranéen" },
    { value: "supra_mediterraneen", label: "Supra-méditerranéen" },
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
