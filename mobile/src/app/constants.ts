import { Platform } from "react-native"
import { fr } from "../i18n"
import { FactorKey, RegionVersion, VegetationStage } from "./types"
import {
  REGION_OPTIONS,
  VEGETATION_STAGE_OPTIONS_BY_REGION,
  defaultVegetationStageForRegion,
  normalizeVegetationStageForRegion,
} from "./vegetation"

export const DEFAULT_API_URL = Platform.select({
  ios: "http://localhost:3000/v1",
  android: "http://10.0.2.2:3000/v1",
  default: "http://localhost:3000/v1",
})

export const HELP_BY_FACTOR: Record<FactorKey, string> = fr.labels.factorHelp

export const FACTOR_TITLES: Record<FactorKey, string> = fr.labels.factorTitles

export const FACTOR_INPUT_HINTS_BY_FACTOR: Record<FactorKey, readonly string[]> =
  fr.labels.factorInputHints

export {
  REGION_OPTIONS,
  VEGETATION_STAGE_OPTIONS_BY_REGION,
  defaultVegetationStageForRegion,
  normalizeVegetationStageForRegion,
}

export const DEFAULT_SURVEY_FORM = {
  siteName: "",
  regionVersion: "ACA" as RegionVersion,
  vegetationStage: "collineen" as VegetationStage,
  gpsLocation: {
    lat: "",
    lng: "",
    collected_at: "",
  },
  factorA: { native_genus_count: "" },
  factorB: { strata_count: "", covered_autochthonous_percent: "" },
  factorC: { bmg_count: "", bmm_count: "", surface_ha: "" },
  factorD: { bmg_count: "", bmm_count: "", surface_ha: "" },
  factorE: { tgb_count: "", gb_count: "", surface_ha: "" },
  factorF: { trees_per_ha: "" },
  factorG: { open_flowering_percent: "" },
  factorH: { class_score: "" },
  factorI: { type_count: "" },
  factorJ: { type_count: "" },
}
