import { Platform } from 'react-native';
import { FactorKey, RegionVersion, VegetationStage } from './types';
import {
  REGION_OPTIONS,
  VEGETATION_STAGE_OPTIONS_BY_REGION,
  defaultVegetationStageForRegion,
  normalizeVegetationStageForRegion
} from './vegetation';

export const DEFAULT_API_URL = Platform.select({
  ios: 'http://localhost:3000/v1',
  android: 'http://10.0.2.2:3000/v1',
  default: 'http://localhost:3000/v1'
});

export const HELP_BY_FACTOR: Record<FactorKey, string> = {
  A: 'Native tree taxa. Enter the observed count of native genera in the stand.',
  B: 'Vertical structure. Enter strata_count (1..5) and native cover percentage.',
  C: 'Standing deadwood. Enter BMg/BMm counts and surveyed area in hectares.',
  D: 'Downed deadwood. Enter BMg/BMm counts and surveyed area in hectares.',
  E: 'Very large living trees. Enter TGB/GB counts and surveyed area in hectares.',
  F: 'Dendromicrohabitats. Enter trees_per_ha (already capped if needed by field protocol).',
  G: 'Flowering open habitats. Enter open_flowering_percent for the described area.',
  H: 'Temporal continuity class. Use 0 (recent), 2 (partial), or 5 (ancient).',
  I: 'Aquatic habitats. Enter distinct habitat type_count: 0, 1, or 2+.',
  J: 'Rocky habitats. Enter distinct habitat type_count: 0, 1, or 2+.'
};

export {
  REGION_OPTIONS,
  VEGETATION_STAGE_OPTIONS_BY_REGION,
  defaultVegetationStageForRegion,
  normalizeVegetationStageForRegion
};

export const DEFAULT_SURVEY_FORM = {
  siteName: 'Foret de Rambouillet',
  regionVersion: 'ACA' as RegionVersion,
  vegetationStage: 'collineen' as VegetationStage,
  locationSource: 'gps' as const,
  gpsLocation: {
    lat: '',
    lng: '',
    accuracy_m: '',
    collected_at: ''
  },
  manualLocation: {
    address_line: '',
    postal_code: '',
    city: '',
    country: ''
  },
  factorA: { native_genus_count: '2' },
  factorB: { strata_count: '2', covered_autochthonous_percent: '70' },
  factorC: { bmg_count: '0', bmm_count: '0', surface_ha: '1' },
  factorD: { bmg_count: '0', bmm_count: '0', surface_ha: '1' },
  factorE: { tgb_count: '0', gb_count: '0', surface_ha: '1' },
  factorF: { trees_per_ha: '2' },
  factorG: { open_flowering_percent: '2' },
  factorH: { class_score: '2' },
  factorI: { type_count: '1' },
  factorJ: { type_count: '1' }
};
