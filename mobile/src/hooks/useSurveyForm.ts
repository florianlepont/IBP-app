import { useMemo, useState } from 'react';
import { DEFAULT_SURVEY_FORM, defaultVegetationStageForRegion, normalizeVegetationStageForRegion } from '../app/constants';
import { computeRetainedScoresFromRawFactors } from '../app/ibp-scoring';
import { parseFiniteNumberInput } from '../app/number-utils';
import {
  FactorField,
  FactorRetainedScore,
  FactorKey,
  RegionVersion,
  VegetationStage
} from '../app/types';

const toTextNum = (value: unknown, fallback = ''): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback;
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const normalizeParcelIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const output: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const normalized = candidate.trim().toUpperCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
};

const toFiniteNumberInRange = (value: string, options?: { min?: number; max?: number; integer?: boolean }): number | null => {
  const parsed = parseFiniteNumberInput(value);
  if (parsed === null) return null;
  if (options?.integer && !Number.isInteger(parsed)) return null;
  if (typeof options?.min === 'number' && parsed < options.min) return null;
  if (typeof options?.max === 'number' && parsed > options.max) return null;
  return parsed;
};

type GpsFormValue = typeof DEFAULT_SURVEY_FORM.gpsLocation;
type FieldError = string | null;

type SurveyFormErrors = {
  siteName: FieldError;
};

const requiredError = (value: string, label: string): FieldError => (value.trim().length === 0 ? `${label} is required` : null);

const numberError = (value: string, label: string, options?: { min?: number; max?: number; integer?: boolean }): FieldError => {
  if (value.trim().length === 0) return `${label} is required`;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return `${label} must be a number`;
  if (options?.integer && !Number.isInteger(parsed)) return `${label} must be an integer`;
  if (typeof options?.min === 'number' && parsed < options.min) return `${label} must be >= ${options.min}`;
  if (typeof options?.max === 'number' && parsed > options.max) return `${label} must be <= ${options.max}`;
  return null;
};

const oneOfError = (value: string, label: string, allowed: number[]): FieldError => {
  const base = numberError(value, label, { integer: true });
  if (base) return base;
  const parsed = Number(value);
  if (!allowed.includes(parsed)) {
    return `${label} must be one of: ${allowed.join(', ')}`;
  }
  return null;
};

export function useSurveyForm() {
  const [siteName, setSiteName] = useState(DEFAULT_SURVEY_FORM.siteName);
  const [regionVersion, setRegionVersion] = useState<RegionVersion>(DEFAULT_SURVEY_FORM.regionVersion);
  const [vegetationStage, setVegetationStage] = useState<VegetationStage>(DEFAULT_SURVEY_FORM.vegetationStage);
  const [gpsLocation, setGpsLocation] = useState<GpsFormValue>(DEFAULT_SURVEY_FORM.gpsLocation);
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);

  const [factorA, setFactorA] = useState(DEFAULT_SURVEY_FORM.factorA);
  const [factorB, setFactorB] = useState(DEFAULT_SURVEY_FORM.factorB);
  const [factorC, setFactorC] = useState(DEFAULT_SURVEY_FORM.factorC);
  const [factorD, setFactorD] = useState(DEFAULT_SURVEY_FORM.factorD);
  const [factorE, setFactorE] = useState(DEFAULT_SURVEY_FORM.factorE);
  const [factorF, setFactorF] = useState(DEFAULT_SURVEY_FORM.factorF);
  const [factorG, setFactorG] = useState(DEFAULT_SURVEY_FORM.factorG);
  const [factorH, setFactorH] = useState(DEFAULT_SURVEY_FORM.factorH);
  const [factorI, setFactorI] = useState(DEFAULT_SURVEY_FORM.factorI);
  const [factorJ, setFactorJ] = useState(DEFAULT_SURVEY_FORM.factorJ);

  const handleRegionChange = (nextRegion: RegionVersion): void => {
    setRegionVersion(nextRegion);
    setVegetationStage((current) => normalizeVegetationStageForRegion(nextRegion, current));
  };

  const applyGpsLocation = (location: { lat: number; lng: number; collected_at?: string }): void => {
    setGpsLocation({
      lat: String(location.lat),
      lng: String(location.lng),
      collected_at: location.collected_at ?? new Date().toISOString()
    });
  };

  const toggleParcelSelection = (parcelIdRaw: string): void => {
    const parcelId = parcelIdRaw.trim().toUpperCase();
    if (!parcelId) {
      return;
    }
    setSelectedParcelIds((current) => (current.includes(parcelId) ? current.filter((id) => id !== parcelId) : [...current, parcelId]));
  };

  const buildFactorsPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};

    const a = toFiniteNumberInRange(factorA.native_genus_count, { min: 0, integer: true });
    if (a !== null) payload.A = { native_genus_count: a };

    const bStrata = toFiniteNumberInRange(factorB.strata_count, { min: 0, integer: true });
    const bCover = toFiniteNumberInRange(factorB.covered_autochthonous_percent, { min: 0, max: 100 });
    if (bStrata !== null && bCover !== null) payload.B = { strata_count: bStrata, covered_autochthonous_percent: bCover };

    const cBmg = toFiniteNumberInRange(factorC.bmg_count, { min: 0, integer: true });
    const cBmm = toFiniteNumberInRange(factorC.bmm_count, { min: 0, integer: true });
    const cSurface = toFiniteNumberInRange(factorC.surface_ha, { min: 0.000001 });
    if (cBmg !== null && cBmm !== null && cSurface !== null) payload.C = { bmg_count: cBmg, bmm_count: cBmm, surface_ha: cSurface };

    const dBmg = toFiniteNumberInRange(factorD.bmg_count, { min: 0, integer: true });
    const dBmm = toFiniteNumberInRange(factorD.bmm_count, { min: 0, integer: true });
    const dSurface = toFiniteNumberInRange(factorD.surface_ha, { min: 0.000001 });
    if (dBmg !== null && dBmm !== null && dSurface !== null) payload.D = { bmg_count: dBmg, bmm_count: dBmm, surface_ha: dSurface };

    const eTgb = toFiniteNumberInRange(factorE.tgb_count, { min: 0, integer: true });
    const eGb = toFiniteNumberInRange(factorE.gb_count, { min: 0, integer: true });
    const eSurface = toFiniteNumberInRange(factorE.surface_ha, { min: 0.000001 });
    if (eTgb !== null && eGb !== null && eSurface !== null) payload.E = { tgb_count: eTgb, gb_count: eGb, surface_ha: eSurface };

    const f = toFiniteNumberInRange(factorF.trees_per_ha, { min: 0 });
    if (f !== null) payload.F = { trees_per_ha: f };

    const g = toFiniteNumberInRange(factorG.open_flowering_percent, { min: 0, max: 100 });
    if (g !== null) payload.G = { open_flowering_percent: g };

    const h = toFiniteNumberInRange(factorH.class_score, { integer: true });
    if (h !== null && [0, 2, 5].includes(h)) payload.H = { class_score: h };

    const i = toFiniteNumberInRange(factorI.type_count, { min: 0, integer: true });
    if (i !== null) payload.I = { type_count: i };

    const j = toFiniteNumberInRange(factorJ.type_count, { min: 0, integer: true });
    if (j !== null) payload.J = { type_count: j };

    return payload;
  };

  const applyDraftToForm = (draftValue: unknown): void => {
    const draft = asObject(draftValue);
    setSiteName(typeof draft.site_name === 'string' ? draft.site_name : DEFAULT_SURVEY_FORM.siteName);
    const nextRegion: RegionVersion = draft.region_version === 'M' ? 'M' : 'ACA';
    setRegionVersion(nextRegion);
    setVegetationStage(normalizeVegetationStageForRegion(nextRegion, draft.vegetation_stage));

    const factors = asObject(draft.factors);
    const factorAObj = asObject(factors.A);
    const factorBObj = asObject(factors.B);
    const factorCObj = asObject(factors.C);
    const factorDObj = asObject(factors.D);
    const factorEObj = asObject(factors.E);
    const factorFObj = asObject(factors.F);
    const factorGObj = asObject(factors.G);
    const factorHObj = asObject(factors.H);
    const factorIObj = asObject(factors.I);
    const factorJObj = asObject(factors.J);
    const parsedParcelIds = normalizeParcelIds(draft.parcel_ids);

    setFactorA({ native_genus_count: toTextNum(factorAObj.native_genus_count) });
    setFactorB({
      strata_count: toTextNum(factorBObj.strata_count),
      covered_autochthonous_percent: toTextNum(factorBObj.covered_autochthonous_percent)
    });
    setFactorC({
      bmg_count: toTextNum(factorCObj.bmg_count),
      bmm_count: toTextNum(factorCObj.bmm_count),
      surface_ha: toTextNum(factorCObj.surface_ha)
    });
    setFactorD({
      bmg_count: toTextNum(factorDObj.bmg_count),
      bmm_count: toTextNum(factorDObj.bmm_count),
      surface_ha: toTextNum(factorDObj.surface_ha)
    });
    setFactorE({
      tgb_count: toTextNum(factorEObj.tgb_count),
      gb_count: toTextNum(factorEObj.gb_count),
      surface_ha: toTextNum(factorEObj.surface_ha)
    });
    setFactorF({ trees_per_ha: toTextNum(factorFObj.trees_per_ha) });
    setFactorG({ open_flowering_percent: toTextNum(factorGObj.open_flowering_percent) });
    setFactorH({ class_score: toTextNum(factorHObj.class_score) });
    setFactorI({ type_count: toTextNum(factorIObj.type_count) });
    setFactorJ({ type_count: toTextNum(factorJObj.type_count) });

    setGpsLocation(DEFAULT_SURVEY_FORM.gpsLocation);
    setSelectedParcelIds(parsedParcelIds);
  };

  const factorRetainedScores = useMemo<Record<FactorKey, FactorRetainedScore | null>>(
    () =>
      computeRetainedScoresFromRawFactors(
        {
          A: { native_genus_count: factorA.native_genus_count },
          B: {
            strata_count: factorB.strata_count,
            covered_autochthonous_percent: factorB.covered_autochthonous_percent
          },
          C: {
            bmg_count: factorC.bmg_count,
            bmm_count: factorC.bmm_count,
            surface_ha: factorC.surface_ha
          },
          D: {
            bmg_count: factorD.bmg_count,
            bmm_count: factorD.bmm_count,
            surface_ha: factorD.surface_ha
          },
          E: {
            tgb_count: factorE.tgb_count,
            gb_count: factorE.gb_count,
            surface_ha: factorE.surface_ha
          },
          F: { trees_per_ha: factorF.trees_per_ha },
          G: { open_flowering_percent: factorG.open_flowering_percent },
          H: { class_score: factorH.class_score },
          I: { type_count: factorI.type_count },
          J: { type_count: factorJ.type_count }
        },
        regionVersion,
        vegetationStage
      ),
    [factorA, factorB, factorC, factorD, factorE, factorF, factorG, factorH, factorI, factorJ, regionVersion, vegetationStage]
  );

  const formErrors = useMemo<SurveyFormErrors>(
    () => ({
      siteName: requiredError(siteName, 'Site name')
    }),
    [siteName]
  );

  const resetSurveyForm = (): void => {
    setSiteName(DEFAULT_SURVEY_FORM.siteName);
    setRegionVersion(DEFAULT_SURVEY_FORM.regionVersion);
    setVegetationStage(defaultVegetationStageForRegion(DEFAULT_SURVEY_FORM.regionVersion));
    setGpsLocation(DEFAULT_SURVEY_FORM.gpsLocation);
    setSelectedParcelIds([]);
    setFactorA(DEFAULT_SURVEY_FORM.factorA);
    setFactorB(DEFAULT_SURVEY_FORM.factorB);
    setFactorC(DEFAULT_SURVEY_FORM.factorC);
    setFactorD(DEFAULT_SURVEY_FORM.factorD);
    setFactorE(DEFAULT_SURVEY_FORM.factorE);
    setFactorF(DEFAULT_SURVEY_FORM.factorF);
    setFactorG(DEFAULT_SURVEY_FORM.factorG);
    setFactorH(DEFAULT_SURVEY_FORM.factorH);
    setFactorI(DEFAULT_SURVEY_FORM.factorI);
    setFactorJ(DEFAULT_SURVEY_FORM.factorJ);
  };

  const factorSections = useMemo<Record<FactorKey, FactorField[]>>(
    () => ({
      A: [
        {
          label: 'native_genus_count',
          value: factorA.native_genus_count,
          onChange: (value) => setFactorA({ native_genus_count: value }),
          required: true,
          error: numberError(factorA.native_genus_count, 'native_genus_count', { min: 0, integer: true })
        }
      ],
      B: [
        {
          label: 'strata_count',
          value: factorB.strata_count,
          onChange: (value) => setFactorB((prev) => ({ ...prev, strata_count: value })),
          required: true,
          error: numberError(factorB.strata_count, 'strata_count', { min: 0, integer: true })
        },
        {
          label: 'covered_autochthonous_percent',
          value: factorB.covered_autochthonous_percent,
          onChange: (value) => setFactorB((prev) => ({ ...prev, covered_autochthonous_percent: value })),
          required: true,
          error: numberError(factorB.covered_autochthonous_percent, 'covered_autochthonous_percent', { min: 0, max: 100 })
        }
      ],
      C: [
        {
          label: 'bmg_count',
          value: factorC.bmg_count,
          onChange: (value) => setFactorC((prev) => ({ ...prev, bmg_count: value })),
          required: true,
          error: numberError(factorC.bmg_count, 'bmg_count', { min: 0, integer: true })
        },
        {
          label: 'bmm_count',
          value: factorC.bmm_count,
          onChange: (value) => setFactorC((prev) => ({ ...prev, bmm_count: value })),
          required: true,
          error: numberError(factorC.bmm_count, 'bmm_count', { min: 0, integer: true })
        },
        {
          label: 'surface_ha',
          value: factorC.surface_ha,
          onChange: (value) => setFactorC((prev) => ({ ...prev, surface_ha: value })),
          required: true,
          error: numberError(factorC.surface_ha, 'surface_ha', { min: 0.000001 })
        }
      ],
      D: [
        {
          label: 'bmg_count',
          value: factorD.bmg_count,
          onChange: (value) => setFactorD((prev) => ({ ...prev, bmg_count: value })),
          required: true,
          error: numberError(factorD.bmg_count, 'bmg_count', { min: 0, integer: true })
        },
        {
          label: 'bmm_count',
          value: factorD.bmm_count,
          onChange: (value) => setFactorD((prev) => ({ ...prev, bmm_count: value })),
          required: true,
          error: numberError(factorD.bmm_count, 'bmm_count', { min: 0, integer: true })
        },
        {
          label: 'surface_ha',
          value: factorD.surface_ha,
          onChange: (value) => setFactorD((prev) => ({ ...prev, surface_ha: value })),
          required: true,
          error: numberError(factorD.surface_ha, 'surface_ha', { min: 0.000001 })
        }
      ],
      E: [
        {
          label: 'tgb_count',
          value: factorE.tgb_count,
          onChange: (value) => setFactorE((prev) => ({ ...prev, tgb_count: value })),
          required: true,
          error: numberError(factorE.tgb_count, 'tgb_count', { min: 0, integer: true })
        },
        {
          label: 'gb_count',
          value: factorE.gb_count,
          onChange: (value) => setFactorE((prev) => ({ ...prev, gb_count: value })),
          required: true,
          error: numberError(factorE.gb_count, 'gb_count', { min: 0, integer: true })
        },
        {
          label: 'surface_ha',
          value: factorE.surface_ha,
          onChange: (value) => setFactorE((prev) => ({ ...prev, surface_ha: value })),
          required: true,
          error: numberError(factorE.surface_ha, 'surface_ha', { min: 0.000001 })
        }
      ],
      F: [
        {
          label: 'trees_per_ha',
          value: factorF.trees_per_ha,
          onChange: (value) => setFactorF({ trees_per_ha: value }),
          required: true,
          error: numberError(factorF.trees_per_ha, 'trees_per_ha', { min: 0 })
        }
      ],
      G: [
        {
          label: 'open_flowering_percent',
          value: factorG.open_flowering_percent,
          onChange: (value) => setFactorG({ open_flowering_percent: value }),
          required: true,
          error: numberError(factorG.open_flowering_percent, 'open_flowering_percent', { min: 0, max: 100 })
        }
      ],
      H: [
        {
          label: 'class_score (0|2|5)',
          value: factorH.class_score,
          onChange: (value) => setFactorH({ class_score: value }),
          required: true,
          error: oneOfError(factorH.class_score, 'class_score', [0, 2, 5])
        }
      ],
      I: [
        {
          label: 'type_count',
          value: factorI.type_count,
          onChange: (value) => setFactorI({ type_count: value }),
          required: true,
          error: numberError(factorI.type_count, 'type_count', { min: 0, integer: true })
        }
      ],
      J: [
        {
          label: 'type_count',
          value: factorJ.type_count,
          onChange: (value) => setFactorJ({ type_count: value }),
          required: true,
          error: numberError(factorJ.type_count, 'type_count', { min: 0, integer: true })
        }
      ]
    }),
    [factorA, factorB, factorC, factorD, factorE, factorF, factorG, factorH, factorI, factorJ]
  );

  const draftInput = useMemo(
    () => ({
      site_name: siteName.trim() || 'Unnamed site',
      region_version: regionVersion,
      vegetation_stage: vegetationStage,
      factors: buildFactorsPayload(),
      parcel_ids: selectedParcelIds
    }),
    [siteName, regionVersion, vegetationStage, factorA, factorB, factorC, factorD, factorE, factorF, factorG, factorH, factorI, factorJ, selectedParcelIds]
  );

  const buildDraftInput = () => draftInput;

  return {
    siteName,
    setSiteName,
    regionVersion,
    vegetationStage,
    setVegetationStage,
    gpsLocation,
    selectedParcelIds,
    setSelectedParcelIds,
    toggleParcelSelection,
    applyGpsLocation,
    handleRegionChange,
    factorSections,
    factorRetainedScores,
    formErrors,
    draftInput,
    applyDraftToForm,
    resetSurveyForm,
    buildDraftInput
  };
}
