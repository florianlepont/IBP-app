import {
  computeIbpTotalsFromRetainedScores,
  computeRetainedScoresFromRawFactors,
  evaluateSubmitReadinessFromDraft,
  isValidSubmitLocation
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

  test('accepts gps and manual submit locations', () => {
    expect(
      isValidSubmitLocation({
        source: 'gps',
        lat: 43.6,
        lng: 3.8
      })
    ).toBe(true);

    expect(
      isValidSubmitLocation({
        source: 'manual',
        address_line: '12 Rue de la Foret',
        postal_code: '75001',
        city: 'Paris',
        country: 'France'
      })
    ).toBe(true);

    expect(
      isValidSubmitLocation({
        source: 'manual',
        address_line: '12 Rue de la Foret',
        postal_code: '',
        city: 'Paris',
        country: 'France'
      })
    ).toBe(false);
  });

  test('reports missing factors and fields for submit readiness', () => {
    const readiness = evaluateSubmitReadinessFromDraft({
      region_version: 'ACA',
      vegetation_stage: 'collineen',
      factors: {
        A: { native_genus_count: 2 },
        B: { strata_count: 2, covered_autochthonous_percent: 80 }
      },
      location: {}
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.expired).toBe(false);
    expect(readiness.missing_fields).toEqual(['location']);
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
      location: {
        source: 'gps',
        lat: 43.6,
        lng: 3.8
      },
      expires_at: '2020-01-01T00:00:00.000Z'
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.expired).toBe(true);
    expect(readiness.missing_factors).toHaveLength(0);
  });
});
