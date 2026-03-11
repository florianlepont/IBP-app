import { IbpRulesService } from '../src/surveys/ibp-rules.service';

const SCORE_CLASS = {
  0: 'S0',
  1: 'S1',
  2: 'S2',
  5: 'S5'
} as const;

describe('IbpRulesService (unit)', () => {
  const service = new IbpRulesService();

  const draftDefaults = {
    region: 'ACA',
    stage: 'collineen'
  } as const;

  const byFactorCases: Array<{
    name: string;
    factor: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
    raw: unknown;
    expectedScore: 0 | 1 | 2 | 5;
    region?: 'ACA' | 'M';
    stage?: string;
  }> = [
    {
      name: 'A (collineen): native_genus_count=2 -> 1',
      factor: 'A',
      raw: { native_genus_count: 2 },
      expectedScore: 1
    },
    {
      name: 'A (subalpin): native_genus_count=2 -> 2',
      factor: 'A',
      raw: { native_genus_count: 2 },
      expectedScore: 2,
      region: 'ACA',
      stage: 'subalpin'
    },
    {
      name: 'B: strata=5 and cover<50 gets capped to 2',
      factor: 'B',
      raw: { strata_count: 5, covered_autochthonous_percent: 40 },
      expectedScore: 2
    },
    {
      name: 'C: bmg=0 bmm=2 surface=1 -> 1',
      factor: 'C',
      raw: { bmg_count: 0, bmm_count: 2, surface_ha: 1 },
      expectedScore: 1
    },
    {
      name: 'D: bmg=4 bmm=0 surface=1 -> 5',
      factor: 'D',
      raw: { bmg_count: 4, bmm_count: 0, surface_ha: 1 },
      expectedScore: 5
    },
    {
      name: 'E: tgb=0 gb=2 surface=1 -> 1',
      factor: 'E',
      raw: { tgb_count: 0, gb_count: 2, surface_ha: 1 },
      expectedScore: 1
    },
    {
      name: 'F: trees_per_ha=8 -> 5',
      factor: 'F',
      raw: { trees_per_ha: 8 },
      expectedScore: 5
    },
    {
      name: 'G: open_flowering_percent=2 -> 5',
      factor: 'G',
      raw: { open_flowering_percent: 2 },
      expectedScore: 5
    },
    {
      name: 'H: class=partial -> 2',
      factor: 'H',
      raw: { class: 'partial' },
      expectedScore: 2
    },
    {
      name: 'I: type_count=1 -> 2',
      factor: 'I',
      raw: { type_count: 1 },
      expectedScore: 2
    },
    {
      name: 'J: type_count=2 -> 5',
      factor: 'J',
      raw: { type_count: 2 },
      expectedScore: 5
    }
  ];

  it.each(byFactorCases)('$name', ({ factor, raw, expectedScore, region, stage }) => {
    const result = service.validateDraft(
      { [factor]: raw },
      region ?? draftDefaults.region,
      stage ?? draftDefaults.stage
    );

    expect(result.ok).toBe(true);
    expect(result.factor_scores?.[factor]).toBe(expectedScore);
    expect(result.factor_results?.[factor]).toMatchObject({
      factor_id: `factor_${factor.toLowerCase()}`,
      score_points: expectedScore,
      selected_class: SCORE_CLASS[expectedScore]
    });
  });

  it('returns warning when factor F dmh_group_counts are capped', () => {
    const result = service.validateDraft(
      {
        F: {
          dmh_group_counts: [3, 3, 3, 3]
        }
      },
      'ACA',
      'collineen'
    );

    expect(result.ok).toBe(true);
    expect(result.factor_scores?.F).toBe(5);
    expect(result.issues.some((i) => i.code === 'factor_f_group_capped' && i.blocking === false)).toBe(true);
    expect(result.factor_results?.F.warnings.join(' | ')).toContain('capped to 2 trees/ha');
  });

  it('returns non-blocking consistency warnings and propagates to canonical factors', () => {
    const result = service.validateDraft(
      {
        A: 0,
        B: 2,
        E: 0,
        F: 5
      },
      'ACA',
      'collineen'
    );

    expect(result.ok).toBe(true);
    expect(result.warnings.join(' | ')).toContain('factor_b indicates complex strata while factor_a is very low');
    expect(result.warnings.join(' | ')).toContain('factor_f is high while factor_e is 0');

    expect(result.factor_results?.A.warnings.join(' | ')).toContain('factor_b indicates complex strata');
    expect(result.factor_results?.F.warnings.join(' | ')).toContain('factor_f is high while factor_e is 0');
  });

  it('rejects invalid direct score for factor I (must be 0,2,5)', () => {
    const result = service.validateDraft(
      {
        I: 1
      },
      'ACA',
      'collineen'
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' | ')).toContain('factor I must resolve to one of [0,2,5]');
  });

  it('validateSubmit blocks expired surveys and missing required factors', () => {
    const result = service.validateSubmit({
      region_version: 'ACA',
      vegetation_stage: 'collineen',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      factors: { A: 1 }
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' | ')).toContain('survey is expired and cannot be submitted');
    expect(result.errors.join(' | ')).toContain('factor B is required');
  });

  it('validateSubmit succeeds with complete valid payload and computes aggregate scores', () => {
    const result = service.validateSubmit({
      region_version: 'ACA',
      vegetation_stage: 'collineen',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      factors: {
        A: 1,
        B: 1,
        C: 1,
        D: 1,
        E: 1,
        F: 1,
        G: 1,
        H: 2,
        I: 2,
        J: 5
      }
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.scores).toEqual({
      ibp_peuplement_gestion: 7,
      ibp_contexte: 9,
      ibp_total: 16
    });
  });

  it('validateSubmit rejects missing parcel-independent required fields', () => {
    const result = service.validateSubmit({
      region_version: 'ACA',
      vegetation_stage: '',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      factors: {
        A: 1,
        B: 1,
        C: 1,
        D: 1,
        E: 1,
        F: 1,
        G: 1,
        H: 2,
        I: 2,
        J: 5
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' | ')).toContain('vegetation_stage is required');
  });

  it('validateSubmit accepts payload without location metadata', () => {
    const result = service.validateSubmit({
      region_version: 'ACA',
      vegetation_stage: 'collineen',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      factors: {
        A: 1,
        B: 1,
        C: 1,
        D: 1,
        E: 1,
        F: 1,
        G: 1,
        H: 2,
        I: 2,
        J: 5
      }
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
