import { useMemo, useState } from 'react';
import { DEFAULT_SURVEY_FORM, defaultVegetationStageForRegion, normalizeVegetationStageForRegion } from '../app/constants';
import { FactorField, FactorKey, RegionVersion, VegetationStage } from '../app/types';

const toNum = (value: string): number => Number(value || '0');

const toTextNum = (value: unknown, fallback = '0'): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return fallback;
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function useSurveyForm() {
  const [siteName, setSiteName] = useState(DEFAULT_SURVEY_FORM.siteName);
  const [regionVersion, setRegionVersion] = useState<RegionVersion>(DEFAULT_SURVEY_FORM.regionVersion);
  const [vegetationStage, setVegetationStage] = useState<VegetationStage>(DEFAULT_SURVEY_FORM.vegetationStage);

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

  const buildFactorsPayload = (): Record<string, unknown> => ({
    A: { native_genus_count: toNum(factorA.native_genus_count) },
    B: {
      strata_count: toNum(factorB.strata_count),
      covered_autochthonous_percent: toNum(factorB.covered_autochthonous_percent)
    },
    C: {
      bmg_count: toNum(factorC.bmg_count),
      bmm_count: toNum(factorC.bmm_count),
      surface_ha: toNum(factorC.surface_ha)
    },
    D: {
      bmg_count: toNum(factorD.bmg_count),
      bmm_count: toNum(factorD.bmm_count),
      surface_ha: toNum(factorD.surface_ha)
    },
    E: {
      tgb_count: toNum(factorE.tgb_count),
      gb_count: toNum(factorE.gb_count),
      surface_ha: toNum(factorE.surface_ha)
    },
    F: { trees_per_ha: toNum(factorF.trees_per_ha) },
    G: { open_flowering_percent: toNum(factorG.open_flowering_percent) },
    H: { class_score: toNum(factorH.class_score) },
    I: { type_count: toNum(factorI.type_count) },
    J: { type_count: toNum(factorJ.type_count) }
  });

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

    setFactorA({ native_genus_count: toTextNum(factorAObj.native_genus_count) });
    setFactorB({
      strata_count: toTextNum(factorBObj.strata_count),
      covered_autochthonous_percent: toTextNum(factorBObj.covered_autochthonous_percent)
    });
    setFactorC({
      bmg_count: toTextNum(factorCObj.bmg_count),
      bmm_count: toTextNum(factorCObj.bmm_count),
      surface_ha: toTextNum(factorCObj.surface_ha, '1')
    });
    setFactorD({
      bmg_count: toTextNum(factorDObj.bmg_count),
      bmm_count: toTextNum(factorDObj.bmm_count),
      surface_ha: toTextNum(factorDObj.surface_ha, '1')
    });
    setFactorE({
      tgb_count: toTextNum(factorEObj.tgb_count),
      gb_count: toTextNum(factorEObj.gb_count),
      surface_ha: toTextNum(factorEObj.surface_ha, '1')
    });
    setFactorF({ trees_per_ha: toTextNum(factorFObj.trees_per_ha) });
    setFactorG({ open_flowering_percent: toTextNum(factorGObj.open_flowering_percent) });
    setFactorH({ class_score: toTextNum(factorHObj.class_score, '2') });
    setFactorI({ type_count: toTextNum(factorIObj.type_count, '1') });
    setFactorJ({ type_count: toTextNum(factorJObj.type_count, '1') });
  };

  const resetSurveyForm = (): void => {
    setSiteName(DEFAULT_SURVEY_FORM.siteName);
    setRegionVersion(DEFAULT_SURVEY_FORM.regionVersion);
    setVegetationStage(defaultVegetationStageForRegion(DEFAULT_SURVEY_FORM.regionVersion));
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
      A: [{ label: 'native_genus_count', value: factorA.native_genus_count, onChange: (value) => setFactorA({ native_genus_count: value }) }],
      B: [
        { label: 'strata_count', value: factorB.strata_count, onChange: (value) => setFactorB((prev) => ({ ...prev, strata_count: value })) },
        {
          label: 'covered_autochthonous_percent',
          value: factorB.covered_autochthonous_percent,
          onChange: (value) => setFactorB((prev) => ({ ...prev, covered_autochthonous_percent: value }))
        }
      ],
      C: [
        { label: 'bmg_count', value: factorC.bmg_count, onChange: (value) => setFactorC((prev) => ({ ...prev, bmg_count: value })) },
        { label: 'bmm_count', value: factorC.bmm_count, onChange: (value) => setFactorC((prev) => ({ ...prev, bmm_count: value })) },
        { label: 'surface_ha', value: factorC.surface_ha, onChange: (value) => setFactorC((prev) => ({ ...prev, surface_ha: value })) }
      ],
      D: [
        { label: 'bmg_count', value: factorD.bmg_count, onChange: (value) => setFactorD((prev) => ({ ...prev, bmg_count: value })) },
        { label: 'bmm_count', value: factorD.bmm_count, onChange: (value) => setFactorD((prev) => ({ ...prev, bmm_count: value })) },
        { label: 'surface_ha', value: factorD.surface_ha, onChange: (value) => setFactorD((prev) => ({ ...prev, surface_ha: value })) }
      ],
      E: [
        { label: 'tgb_count', value: factorE.tgb_count, onChange: (value) => setFactorE((prev) => ({ ...prev, tgb_count: value })) },
        { label: 'gb_count', value: factorE.gb_count, onChange: (value) => setFactorE((prev) => ({ ...prev, gb_count: value })) },
        { label: 'surface_ha', value: factorE.surface_ha, onChange: (value) => setFactorE((prev) => ({ ...prev, surface_ha: value })) }
      ],
      F: [{ label: 'trees_per_ha', value: factorF.trees_per_ha, onChange: (value) => setFactorF({ trees_per_ha: value }) }],
      G: [{ label: 'open_flowering_percent', value: factorG.open_flowering_percent, onChange: (value) => setFactorG({ open_flowering_percent: value }) }],
      H: [{ label: 'class_score (0|2|5)', value: factorH.class_score, onChange: (value) => setFactorH({ class_score: value }) }],
      I: [{ label: 'type_count', value: factorI.type_count, onChange: (value) => setFactorI({ type_count: value }) }],
      J: [{ label: 'type_count', value: factorJ.type_count, onChange: (value) => setFactorJ({ type_count: value }) }]
    }),
    [factorA, factorB, factorC, factorD, factorE, factorF, factorG, factorH, factorI, factorJ]
  );

  const buildDraftInput = () => ({
    site_name: siteName.trim() || 'Unnamed site',
    region_version: regionVersion,
    vegetation_stage: vegetationStage,
    factors: buildFactorsPayload()
  });

  return {
    siteName,
    setSiteName,
    regionVersion,
    vegetationStage,
    setVegetationStage,
    handleRegionChange,
    factorSections,
    applyDraftToForm,
    resetSurveyForm,
    buildDraftInput
  };
}
