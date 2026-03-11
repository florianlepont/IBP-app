import {
  computeIbpTotalsFromRetainedScores,
  computeRetainedScoresFromRawFactors,
  evaluateSubmitReadinessFromDraft,
  resolveDraftParcelIds
} from './ibp-scoring';

describe('ibp-scoring', () => {
  test('computes retained scores and totals from raw factors', () => {
    const retained = computeRetainedScoresFromRawFactors(
      {
        A: { native_genus_count: 5 },
        B: { strata_count: 3, covered_autochthonous_percent: 60 },
        C: { bmg_count: 2, bmm_count: 2, surface_ha: 1 },
        D: { bmg_count: 0, bmm_count: 2, surface_ha: 1 },
        E: { tgb_count: 6, gb_count: 0, surface_ha: 1 },
        F: { trees_per_ha: 9 },
        G: { open_flowering_percent: 2 },
        H: { class_score: 5 },
        I: { type_count: 1 },
        J: { type_count: 2 }
      },
      'ACA',
      'collineen'
    );

    expect(retained.A?.score).toBe(5);
    expect(retained.D?.score).toBe(1);
    expect(retained.H?.score).toBe(5);
    expect(retained.J?.score).toBe(5);

    const totals = computeIbpTotalsFromRetainedScores(retained);
    expect(totals.completed_factors).toBe(10);
    expect(totals.ibp_peuplement_gestion).toBe(25);
    expect(totals.ibp_contexte).toBe(12);
    expect(totals.ibp_total).toBe(37);
  });

  test('normalizes selected parcel ids from draft payload', () => {
    expect(
      resolveDraftParcelIds({
        parcel_ids: ['75056000AB0001', ' 75056000ab0001 ', '75056000AB0002']
      })
    ).toEqual(['75056000AB0001', '75056000AB0002']);

    expect(
      resolveDraftParcelIds({
        location: {
          selected_parcel_ids: ['33063000A0003']
        }
      })
    ).toEqual(['33063000A0003']);
  });

  test('reports missing factors and fields for submit readiness', () => {
    const readiness = evaluateSubmitReadinessFromDraft({
      region_version: 'ACA',
      vegetation_stage: 'collineen',
      factors: {
        A: { native_genus_count: 2 },
        B: { strata_count: 2, covered_autochthonous_percent: 80 }
      },
      parcel_ids: []
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.expired).toBe(false);
    expect(readiness.missing_fields).toEqual(['parcel_ids']);
    expect(readiness.missing_factors).toEqual(['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  });

  test('marks expired surveys as not ready', () => {
    const readiness = evaluateSubmitReadinessFromDraft({
      region_version: 'ACA',
      vegetation_stage: 'collineen',
      factors: {
        A: { native_genus_count: 2 },
        B: { strata_count: 2, covered_autochthonous_percent: 80 },
        C: { bmg_count: 0, bmm_count: 1, surface_ha: 1 },
        D: { bmg_count: 0, bmm_count: 1, surface_ha: 1 },
        E: { tgb_count: 0, gb_count: 1, surface_ha: 1 },
        F: { trees_per_ha: 2 },
        G: { open_flowering_percent: 2 },
        H: { class_score: 2 },
        I: { type_count: 1 },
        J: { type_count: 1 }
      },
      parcel_ids: ['75056000AB0001'],
      expires_at: '2020-01-01T00:00:00.000Z'
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.expired).toBe(true);
    expect(readiness.missing_factors).toHaveLength(0);
  });
});
